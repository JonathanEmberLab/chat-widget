import { createClient } from '@supabase/supabase-js';
import type { SiteConfig, ChatMessage, Lead, KnowledgeDoc, Conversation, LeadAnalysis } from './types';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side client with the service role key — never expose this to the browser.
export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

export async function getSiteConfig(siteKey: string): Promise<SiteConfig | null> {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .eq('site_key', siteKey)
    .single();
  if (error) return null;
  return data as SiteConfig;
}

export async function listSites(): Promise<SiteConfig[]> {
  const { data, error } = await supabase
    .from('sites')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as SiteConfig[];
}

export async function createSite(site: Omit<SiteConfig, 'created_at'>): Promise<SiteConfig | null> {
  const { data, error } = await supabase.from('sites').insert(site).select().single();
  if (error) return null;
  return data as SiteConfig;
}

export async function updateSite(
  siteKey: string,
  patch: Partial<Omit<SiteConfig, 'site_key' | 'created_at'>>,
): Promise<SiteConfig | null> {
  const { data, error } = await supabase
    .from('sites')
    .update(patch)
    .eq('site_key', siteKey)
    .select()
    .single();
  if (error) return null;
  return data as SiteConfig;
}

export async function deleteSite(siteKey: string): Promise<boolean> {
  const { error } = await supabase.from('sites').delete().eq('site_key', siteKey);
  return !error;
}

export async function listLeads(siteKey?: string): Promise<Lead[]> {
  let query = supabase.from('leads').select('*').order('created_at', { ascending: false });
  if (siteKey) query = query.eq('site_key', siteKey);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as Lead[];
}

// Funnel order — higher = further along. saveLead never downgrades a lead.
const LEAD_PRIORITY: Record<'chat' | 'booking' | 'whatsapp', number> = { chat: 1, whatsapp: 2, booking: 3 };

export async function saveLead(params: {
  site_key: string;
  name?: string;
  email?: string;
  source: 'chat' | 'booking' | 'whatsapp';
}) {
  const email = params.email?.trim();

  // No email (e.g. legacy) → can't dedupe, plain insert.
  if (!email) {
    await supabase.from('leads').insert(params);
    return;
  }

  const { data: existing } = await supabase
    .from('leads')
    .select('id, source, name')
    .eq('site_key', params.site_key)
    .eq('email', email)
    .maybeSingle();

  if (!existing) {
    await supabase.from('leads').insert({ ...params, email });
    return;
  }

  // One row per person: update name if missing, bump source only if further along.
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.name && !existing.name) patch.name = params.name;
  if (LEAD_PRIORITY[params.source] > LEAD_PRIORITY[existing.source as 'chat' | 'booking' | 'whatsapp']) {
    patch.source = params.source;
  }
  await supabase.from('leads').update(patch).eq('id', existing.id);
}

export async function saveConversation(params: {
  site_key: string;
  conversation_id?: string;
  email?: string;
  messages: ChatMessage[];
}) {
  // With a conversation_id, upsert so the whole chat lives in ONE growing row.
  if (params.conversation_id) {
    await supabase.from('conversations').upsert(
      {
        conversation_id: params.conversation_id,
        site_key: params.site_key,
        email: params.email,
        messages: params.messages,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'conversation_id' },
    );
    return;
  }
  // Fallback (no id): legacy insert.
  await supabase.from('conversations').insert({
    site_key: params.site_key,
    email: params.email,
    messages: params.messages,
  });
}

export async function getConversation(id: number): Promise<Conversation | null> {
  const { data, error } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return data as Conversation;
}

/** Store an AI analysis on the matching lead (by site + email). */
export async function saveLeadAnalysis(siteKey: string, email: string, analysis: LeadAnalysis): Promise<boolean> {
  const { error } = await supabase
    .from('leads')
    .update({
      score: analysis.score,
      temperatura: analysis.temperatura,
      resumen: analysis.resumen,
      analysis,
      analyzed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('site_key', siteKey)
    .eq('email', email);
  return !error;
}

export async function listConversations(siteKey?: string): Promise<Conversation[]> {
  let query = supabase.from('conversations').select('*').order('updated_at', { ascending: false }).limit(500);
  if (siteKey) query = query.eq('site_key', siteKey);
  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as Conversation[];
}

/** Admin view: full knowledge docs (includes content) for one site. */
export async function listKnowledge(siteKey: string): Promise<KnowledgeDoc[]> {
  const { data, error } = await supabase
    .from('knowledge')
    .select('*')
    .eq('site_key', siteKey)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as KnowledgeDoc[];
}

export async function addKnowledge(params: {
  site_key: string;
  source_type: KnowledgeDoc['source_type'];
  title: string;
  content: string;
  source_url?: string;
  template?: string;
  data?: Record<string, unknown>;
}): Promise<KnowledgeDoc | null> {
  const { data, error } = await supabase
    .from('knowledge')
    .insert({ ...params, chars: params.content.length })
    .select()
    .single();
  if (error) return null;
  return data as KnowledgeDoc;
}

export async function updateKnowledge(
  siteKey: string,
  id: number,
  patch: { title: string; content: string; data?: Record<string, unknown> },
): Promise<KnowledgeDoc | null> {
  const { data, error } = await supabase
    .from('knowledge')
    .update({ ...patch, chars: patch.content.length })
    .eq('site_key', siteKey)
    .eq('id', id)
    .select()
    .single();
  if (error) return null;
  return data as KnowledgeDoc;
}

export async function deleteKnowledge(siteKey: string, id: number): Promise<boolean> {
  const { error } = await supabase.from('knowledge').delete().eq('site_key', siteKey).eq('id', id);
  return !error;
}

/** Chat-time read: just the text blocks for a site, oldest first for stable cache keys. */
export async function getSiteKnowledge(
  siteKey: string,
): Promise<Pick<KnowledgeDoc, 'title' | 'content' | 'source_type'>[]> {
  const { data, error } = await supabase
    .from('knowledge')
    .select('title, content, source_type')
    .eq('site_key', siteKey)
    .order('created_at', { ascending: true });
  if (error) return [];
  return (data ?? []) as Pick<KnowledgeDoc, 'title' | 'content' | 'source_type'>[];
}
