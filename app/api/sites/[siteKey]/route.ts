import { NextRequest, NextResponse } from 'next/server';
import { updateSite, deleteSite } from '@/lib/supabase';
import { isAuthorized } from '@/lib/admin-auth';
import type { SiteConfig } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { siteKey } = await params;
  const body = (await req.json()) as Partial<SiteConfig>;

  // site_key and created_at are immutable — strip them out.
  const { site_key: _ignore, created_at: _ignore2, ...patch } = body;
  void _ignore;
  void _ignore2;

  const site = await updateSite(siteKey, patch);
  if (!site) return NextResponse.json({ error: 'Could not update site' }, { status: 400 });
  return NextResponse.json({ site });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { siteKey } = await params;
  const ok = await deleteSite(siteKey);
  if (!ok) return NextResponse.json({ error: 'Could not delete site' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
