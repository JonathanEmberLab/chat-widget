import { createClient } from '@supabase/supabase-js';
import type { SiteConfig, ChatMessage } from './types';

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

export async function saveLead(params: {
  site_key: string;
  name?: string;
  email?: string;
  source: 'chat' | 'booking' | 'whatsapp';
}) {
  await supabase.from('leads').insert(params);
}

export async function saveConversation(params: {
  site_key: string;
  messages: ChatMessage[];
}) {
  await supabase.from('conversations').insert({
    site_key: params.site_key,
    messages: params.messages,
  });
}

export async function saveBooking(params: {
  site_key: string;
  name: string;
  email: string;
  datetime: string;
  meet_link?: string;
}) {
  await supabase.from('bookings').insert(params);
}
