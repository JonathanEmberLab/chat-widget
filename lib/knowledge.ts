import * as cheerio from 'cheerio';
import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';

/** Collapse runs of whitespace/blank lines so stored text stays compact. */
export function normalizeText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Hard cap per document so a single huge upload can't blow up the context window. */
const MAX_CHARS = 100_000;

function clamp(text: string): string {
  return text.length > MAX_CHARS ? `${text.slice(0, MAX_CHARS)}\n\n[…contenido truncado]` : text;
}

export interface Extracted {
  title: string;
  content: string;
}

/** Fetch a public URL and extract its readable text (drops scripts, styles, nav chrome). */
export async function extractFromUrl(url: string): Promise<Extracted> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChatWidgetBot/1.0)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`No se pudo descargar la URL (HTTP ${res.status})`);

  const html = await res.text();
  const $ = cheerio.load(html);
  $('script, style, noscript, svg, iframe, nav, footer, header').remove();

  const title = $('title').first().text().trim() || $('h1').first().text().trim() || url;
  const content = normalizeText($('body').text());
  if (!content) throw new Error('La URL no contiene texto legible');

  return { title, content: clamp(content) };
}

/** Extract plain text from an uploaded file. Supports PDF, DOCX, TXT/MD and plain text. */
export async function extractFromFile(filename: string, buffer: ArrayBuffer): Promise<Extracted> {
  const ext = filename.toLowerCase().split('.').pop() ?? '';
  let content: string;

  if (ext === 'pdf') {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    content = Array.isArray(text) ? text.join('\n') : text;
  } else if (ext === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    content = value;
  } else if (ext === 'txt' || ext === 'md' || ext === 'csv') {
    content = new TextDecoder().decode(buffer);
  } else {
    throw new Error(`Formato no soportado: .${ext} (usa PDF, DOCX, TXT, MD o CSV)`);
  }

  content = normalizeText(content);
  if (!content) throw new Error('El archivo no contiene texto extraíble');

  return { title: filename, content: clamp(content) };
}