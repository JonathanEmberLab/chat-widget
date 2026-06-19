import { NextRequest, NextResponse } from 'next/server';
import { listSites, createSite } from '@/lib/supabase';
import { isAuthorized } from '@/lib/admin-auth';
import type { SiteConfig } from '@/lib/types';

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sites = await listSites();
  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as Partial<SiteConfig>;
  if (!body.site_key || !body.name) {
    return NextResponse.json({ error: 'site_key and name are required' }, { status: 400 });
  }

  const site = await createSite({
    site_key: body.site_key,
    name: body.name,
    system_prompt: body.system_prompt ?? `You are a helpful assistant for ${body.name}.`,
    whatsapp_number: body.whatsapp_number ?? '',
    accent_color: body.accent_color ?? '#4A8F8A',
    allowed_domain: body.allowed_domain ?? '',
    welcome_message: body.welcome_message ?? `Hola 👋 ¿En qué puedo ayudarte?`,
  });

  if (!site) return NextResponse.json({ error: 'Could not create site (duplicate key?)' }, { status: 409 });
  return NextResponse.json({ site });
}
