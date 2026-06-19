import { NextRequest, NextResponse } from 'next/server';
import { getSiteConfig, saveLead } from '@/lib/supabase';
import { corsHeaders, preflight } from '@/lib/cors';

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
    const { name, email } = (await req.json()) as { name?: string; email?: string };

    const cleanName = (name ?? '').trim();
    const cleanEmail = (email ?? '').trim();
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
    if (!cleanName || !emailOk) {
      return NextResponse.json({ error: 'Nombre y correo válidos son requeridos' }, { status: 400, headers: cors });
    }

    await saveLead({ site_key: siteKey, name: cleanName, email: cleanEmail, source: 'chat' });
    return NextResponse.json({ ok: true }, { headers: cors });
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500, headers: corsHeaders('', origin) });
  }
}
