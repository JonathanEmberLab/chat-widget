import { NextRequest, NextResponse } from 'next/server';
import { getConversation, getSiteConfig, saveLeadAnalysis } from '@/lib/supabase';
import { analyzeConversation } from '@/lib/lead-analysis';
import { isAuthorized } from '@/lib/admin-auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const conv = await getConversation(Number(id));
  if (!conv) return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });

  const site = await getSiteConfig(conv.site_key);

  let analysis;
  try {
    analysis = await analyzeConversation(conv.messages, site?.name);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al analizar' }, { status: 500 });
  }

  // Persist on the lead if we can link it (conversation has the gate email).
  let saved = false;
  if (conv.email) saved = await saveLeadAnalysis(conv.site_key, conv.email, analysis);

  return NextResponse.json({ analysis, saved });
}
