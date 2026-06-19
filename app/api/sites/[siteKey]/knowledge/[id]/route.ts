import { NextRequest, NextResponse } from 'next/server';
import { deleteKnowledge, updateKnowledge } from '@/lib/supabase';
import { normalizeText } from '@/lib/knowledge';
import { renderTemplate, TEMPLATE_TITLE, type TemplateId } from '@/lib/knowledge-templates';
import { isAuthorized } from '@/lib/admin-auth';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ siteKey: string; id: string }> },
) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { siteKey, id } = await params;
  const body = (await req.json()) as {
    template?: TemplateId;
    title?: string;
    content?: string;
    data?: Record<string, unknown>;
  };

  // Template doc → re-render markdown from the structured form data.
  if (body.template) {
    if (!(body.template in TEMPLATE_TITLE)) {
      return NextResponse.json({ error: 'Plantilla inválida' }, { status: 400 });
    }
    const content = renderTemplate(body.template, body.data ?? {});
    const doc = await updateKnowledge(siteKey, Number(id), {
      title: body.title?.trim() || TEMPLATE_TITLE[body.template],
      content,
      data: body.data ?? {},
    });
    if (!doc) return NextResponse.json({ error: 'Could not update document' }, { status: 400 });
    return NextResponse.json({ doc });
  }

  // Plain text / file / url doc → update title + content directly.
  if (typeof body.content === 'string') {
    const content = normalizeText(body.content);
    if (!content) return NextResponse.json({ error: 'El contenido está vacío' }, { status: 400 });
    const doc = await updateKnowledge(siteKey, Number(id), {
      title: body.title?.trim() || 'Texto sin título',
      content,
    });
    if (!doc) return NextResponse.json({ error: 'Could not update document' }, { status: 400 });
    return NextResponse.json({ doc });
  }

  return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ siteKey: string; id: string }> },
) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { siteKey, id } = await params;
  const ok = await deleteKnowledge(siteKey, Number(id));
  if (!ok) return NextResponse.json({ error: 'Could not delete document' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
