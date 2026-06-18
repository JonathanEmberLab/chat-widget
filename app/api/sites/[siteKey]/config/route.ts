import { NextRequest, NextResponse } from 'next/server';
import { getSiteConfig } from '@/lib/supabase';
import { corsHeaders, preflight } from '@/lib/cors';

/**
 * Public config used by the widget/iframe to render the UI.
 * Only NON-SECRET, presentation fields are exposed here.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  const site = await getSiteConfig(siteKey);
  const origin = req.headers.get('origin');
  if (!site) return NextResponse.json({ error: 'Unknown site' }, { status: 404 });

  return NextResponse.json(
    {
      site_key: site.site_key,
      name: site.name,
      accent_color: site.accent_color,
      welcome_message: site.welcome_message,
    },
    { headers: corsHeaders(site.allowed_domain, origin) },
  );
}

export async function OPTIONS(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  const { siteKey } = await params;
  const site = await getSiteConfig(siteKey);
  return preflight(site?.allowed_domain ?? '', req.headers.get('origin'));
}
