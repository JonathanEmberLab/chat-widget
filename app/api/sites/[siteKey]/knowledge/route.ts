import { NextRequest, NextResponse } from 'next/server';
import { listKnowledge, addKnowledge, getSiteConfig } from '@/lib/supabase';
import { extractFromUrl, extractFromFile, normalizeText } from '@/lib/knowledge';
import { renderTemplate, TEMPLATE_TITLE, type TemplateId } from '@/lib/knowledge-templates';
import { isAuthorized } from '@/lib/admin-auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { siteKey } = await params;
  const docs = await listKnowledge(siteKey);
  return NextResponse.json({ docs });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ siteKey: string }> }) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { siteKey } = await params;

  const site = await getSiteConfig(siteKey);
  if (!site) return NextResponse.json({ error: 'Unknown site' }, { status: 404 });

  try {
    const contentType = req.headers.get('content-type') ?? '';

    // File upload (multipart) → extract text from PDF/DOCX/TXT.
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
      const { title, content } = await extractFromFile(file.name, await file.arrayBuffer());
      const doc = await addKnowledge({ site_key: siteKey, source_type: 'file', title, content });
      return doc
        ? NextResponse.json({ doc })
        : NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    }

    // JSON → guided template, pasted text/FAQ, or a URL to scrape.
    const body = (await req.json()) as {
      source_type?: string;
      title?: string;
      content?: string;
      url?: string;
      template?: TemplateId;
      data?: Record<string, unknown>;
    };

    if (body.source_type === 'template') {
      if (!body.template || !(body.template in TEMPLATE_TITLE)) {
        return NextResponse.json({ error: 'Plantilla inválida' }, { status: 400 });
      }
      const content = renderTemplate(body.template, body.data ?? {});
      const doc = await addKnowledge({
        site_key: siteKey,
        source_type: 'template',
        template: body.template,
        title: body.title?.trim() || TEMPLATE_TITLE[body.template],
        content,
        data: body.data ?? {},
      });
      return doc
        ? NextResponse.json({ doc })
        : NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    }

    if (body.source_type === 'url') {
      if (!body.url) return NextResponse.json({ error: 'Falta la URL' }, { status: 400 });
      const { title, content } = await extractFromUrl(body.url);
      const doc = await addKnowledge({
        site_key: siteKey,
        source_type: 'url',
        title: body.title?.trim() || title,
        content,
        source_url: body.url,
      });
      return doc
        ? NextResponse.json({ doc })
        : NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
    }

    // Default: pasted text / FAQ.
    const content = normalizeText(body.content ?? '');
    if (!content) return NextResponse.json({ error: 'El contenido está vacío' }, { status: 400 });
    const doc = await addKnowledge({
      site_key: siteKey,
      source_type: 'text',
      title: body.title?.trim() || 'Texto sin título',
      content,
    });
    return doc
      ? NextResponse.json({ doc })
      : NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error al procesar' }, { status: 400 });
  }
}