import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots, createCalendarEvent } from '@/lib/google-calendar';
import { getSiteConfig, getSiteKnowledge, saveLead, saveConversation, saveBooking, saveLeadAnalysis } from '@/lib/supabase';
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
- When the user wants to contact a human or needs a personalized quote, use the open_whatsapp tool.
- When the user wants to schedule a meeting, first use check_availability to show options, then collect their name and email, then use book_meeting.`;

  if (knowledge.length) {
    const kb = knowledge.map(d => `### ${d.title}\n${d.content}`).join('\n\n---\n\n');
    prompt += `

## Business knowledge base
Use the information below to answer questions about the business, its products, services, policies, and FAQs. Only use facts stated here — if the answer isn't here, say you don't have that detail and offer to connect them via WhatsApp. Never invent information.

${kb}`;
  }

  return prompt;
}

/** Dynamic part: changes every request (current time + visitor identity), so it must NOT be cached. */
function buildDynamicPrompt(lead?: { name?: string; email?: string }): string {
  const now = new Date().toLocaleString('en-US', {
    timeZone: 'America/Mexico_City',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const identity = lead?.name
    ? `\n## Visitor (already identified)
- You are talking to ${lead.name}${lead.email ? ` (${lead.email})` : ''}. They already gave their contact info — do NOT ask for it again. Reuse it for bookings.\n`
    : '';

  return `${identity}## Scheduling rules (IMPORTANT)
- The current date and time is ${now} (timezone America/Mexico_City).
- NEVER invent or guess dates. When booking, you MUST pass the exact ISO 8601 'iso' value returned by check_availability for the slot the user chose.
- If the user names a day/time not in the available slots, call check_availability again and offer the real options.`;
}

const tools: Anthropic.Tool[] = [
  {
    name: 'check_availability',
    description: 'Check available meeting slots in the next business days. Call when the user wants to schedule a meeting.',
    input_schema: {
      type: 'object',
      properties: { days_ahead: { type: 'number', description: 'How many days ahead to check (default 5)' } },
    },
  },
  {
    name: 'book_meeting',
    description: 'Book a meeting. Only call after you have the user name, email, and a confirmed datetime from check_availability.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string' },
        datetime: { type: 'string', description: 'ISO 8601 datetime from check_availability' },
        topic: { type: 'string' },
      },
      required: ['name', 'email', 'datetime'],
    },
  },
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
    // the dated scheduling rules stay in a separate uncached block.
    const knowledge = await getSiteKnowledge(siteKey);
    const system: Anthropic.TextBlockParam[] = [
      { type: 'text', text: buildStaticPrompt(site, knowledge), cache_control: { type: 'ephemeral' } },
      { type: 'text', text: buildDynamicPrompt(lead) },
    ];

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

        if (toolUse.name === 'check_availability') {
          const slots = await getAvailableSlots(site.calendar_id, (input.days_ahead as number) ?? 5);
          toolResult = JSON.stringify(slots);
          action = { type: 'slots', slots };
        } else if (toolUse.name === 'book_meeting') {
          const result = await createCalendarEvent({
            calendarId: site.calendar_id,
            responsibleEmail: site.responsible_email,
            siteName: site.name,
            name: input.name as string,
            email: input.email as string,
            datetime: input.datetime as string,
            topic: input.topic as string | undefined,
          });
          toolResult = JSON.stringify(result);
          action = { type: 'booked', ...result };
          // Persist lead + booking (tie to the gate identity so it's the same lead row)
          await saveLead({
            site_key: siteKey,
            name: (lead?.name ?? input.name) as string,
            email: (lead?.email ?? input.email) as string,
            source: 'booking',
          });
          if (!result.mock) {
            await saveBooking({
              site_key: siteKey,
              name: input.name as string,
              email: input.email as string,
              datetime: input.datetime as string,
              meet_link: result.meetLink,
            });
          }
        } else if (toolUse.name === 'open_whatsapp') {
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
