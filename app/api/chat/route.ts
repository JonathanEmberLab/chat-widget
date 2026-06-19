import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getSiteConfig, getSiteKnowledge, saveLead, saveConversation, saveLeadAnalysis } from '@/lib/supabase';
import { analyzeConversation } from '@/lib/lead-analysis';
import { corsHeaders, preflight } from '@/lib/cors';
import type { ChatAction, ChatMessage, SiteConfig } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/** Stable part of the system prompt: persona + behavior + knowledge base. Safe to cache. */
function buildStaticPrompt(
  site: SiteConfig,
  knowledge: { title: string; content: string }[],
): string {
  let prompt = `${site.system_prompt}

## Your behavior
- Always respond in the same language the user writes in.
- Keep responses short and conversational — this is a chat widget.
- When the user wants to contact a human or needs a personalized quote, use the open_whatsapp tool.`;

  if (knowledge.length) {
    const kb = knowledge.map(d => `### ${d.title}\n${d.content}`).join('\n\n---\n\n');
    prompt += `

## Business knowledge base
Use the information below to answer questions about the business, its products, services, policies, and FAQs. Only use facts stated here — if the answer isn't here, say you don't have that detail and offer to connect them via WhatsApp. Never invent information.

${kb}`;
  }

  return prompt;
}

/** Dynamic part: per-visitor identity, so it must NOT be cached. Empty when the visitor is anonymous. */
function buildDynamicPrompt(lead?: { name?: string; email?: string }): string {
  if (!lead?.name) return '';
  return `## Visitor (already identified)
- You are talking to ${lead.name}${lead.email ? ` (${lead.email})` : ''}. They already gave their contact info — do NOT ask for it again.`;
}

const tools: Anthropic.Tool[] = [
  {
    name: 'open_whatsapp',
    description: 'Generate a WhatsApp link so the user can contact directly. Use when the user wants a human or a quote.',
    input_schema: {
      type: 'object',
      properties: { message: { type: 'string', description: 'Pre-filled message with conversation context' } },
      required: ['message'],
    },
  },
];

export async function OPTIONS(req: NextRequest) {
  const siteKey = new URL(req.url).searchParams.get('site') ?? '';
  const site = siteKey ? await getSiteConfig(siteKey) : null;
  return preflight(site?.allowed_domain ?? '', req.headers.get('origin'));
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  try {
    const siteKey = new URL(req.url).searchParams.get('site');
    if (!siteKey) return NextResponse.json({ error: 'Missing site key' }, { status: 400 });

    const site = await getSiteConfig(siteKey);
    if (!site) return NextResponse.json({ error: 'Unknown site' }, { status: 404 });

    const cors = corsHeaders(site.allowed_domain, origin);

    const { messages, conversation_id, lead } = (await req.json()) as {
      messages: ChatMessage[];
      conversation_id?: string;
      lead?: { name?: string; email?: string };
    };
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400, headers: cors });
    }

    let currentMessages: Anthropic.MessageParam[] = messages.map(m => ({ role: m.role, content: m.content }));
    let action: ChatAction | null = null;
    let finalText = '';

    // Stable persona + knowledge base goes in a cached block (cheap to resend);
    // per-visitor identity stays in a separate uncached block (omitted when anonymous).
    const knowledge = await getSiteKnowledge(siteKey);
    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: buildStaticPrompt(site, knowledge), cache_control: { type: 'ephemeral' } },
    ];
    const dynamic = buildDynamicPrompt(lead);
    if (dynamic) system.push({ type: 'text', text: dynamic });

    for (let i = 0; i < 5; i++) {
      const response = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        system,
        tools,
        messages: currentMessages,
      });

      const textBlock = response.content.find(b => b.type === 'text');
      if (textBlock?.type === 'text') finalText = textBlock.text;

      if (response.stop_reason === 'end_turn') break;

      if (response.stop_reason === 'tool_use') {
        const toolUse = response.content.find(b => b.type === 'tool_use');
        if (!toolUse || toolUse.type !== 'tool_use') break;

        const input = toolUse.input as Record<string, string | number>;
        let toolResult = '';

        if (toolUse.name === 'open_whatsapp') {
          const url = `https://wa.me/${site.whatsapp_number}?text=${encodeURIComponent(input.message as string)}`;
          toolResult = url;
          action = { type: 'whatsapp', url };
          await saveLead({ site_key: siteKey, name: lead?.name, email: lead?.email, source: 'whatsapp' });
        }

        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: toolResult }] },
        ];
      }
    }

    // Store the conversation (fire-and-forget, non-blocking on failure).
    // conversation_id makes this an upsert → one growing row per chat.
    const fullMessages: ChatMessage[] = [...messages, { role: 'assistant', content: finalText }];
    saveConversation({
      site_key: siteKey,
      conversation_id,
      email: lead?.email,
      messages: fullMessages,
    }).catch(() => {});

    // Auto lead-scoring: once the visitor has engaged (2+ messages), re-analyze
    // the conversation and store the classification on their lead. Fire-and-forget.
    const userMessages = messages.filter(m => m.role === 'user').length;
    if (lead?.email && userMessages >= 2) {
      analyzeConversation(fullMessages, site.name)
        .then(a => saveLeadAnalysis(siteKey, lead.email as string, a))
        .catch(() => {});
    }

    return NextResponse.json({ text: finalText, action }, { headers: cors });
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500, headers: corsHeaders('', origin) },
    );
  }
}
