// Guided knowledge templates. Clients fill a form; we store the structured `data`
// AND a rendered markdown `content` that's fed to the model and shown formatted in the admin.
// Framework-agnostic on purpose — imported by both the API route and the admin UI.

export type TemplateId = 'general' | 'horarios' | 'ubicacion' | 'servicios' | 'faq';

export const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'] as const;

export interface TemplateMeta {
  id: TemplateId;
  label: string;
  description: string;
}

export const TEMPLATE_META: TemplateMeta[] = [
  { id: 'general', label: 'Información general', description: 'Nombre, qué hace el negocio y formas de pago.' },
  { id: 'horarios', label: 'Horarios', description: 'Horario de atención por día de la semana.' },
  { id: 'ubicacion', label: 'Ubicación', description: 'Dirección, cómo llegar y estacionamiento.' },
  { id: 'servicios', label: 'Servicios y precios', description: 'Lista de servicios con precio y duración.' },
  { id: 'faq', label: 'Preguntas frecuentes', description: 'Pares de pregunta y respuesta.' },
];

export const TEMPLATE_TITLE: Record<TemplateId, string> = {
  general: 'Información general',
  horarios: 'Horarios de atención',
  ubicacion: 'Ubicación',
  servicios: 'Servicios y precios',
  faq: 'Preguntas frecuentes',
};

// ─── Default (empty) data per template ───

export interface HorarioDia {
  cerrado: boolean;
  abre: string;
  cierra: string;
}

export function emptyData(id: TemplateId): Record<string, unknown> {
  switch (id) {
    case 'general':
      return { nombre: '', descripcion: '', pagos: '' };
    case 'horarios':
      return {
        dias: Object.fromEntries(
          DAYS.map((d) => [d, { cerrado: false, abre: '09:00', cierra: '18:00' } as HorarioDia]),
        ),
        notas: '',
      };
    case 'ubicacion':
      return { direccion: '', referencias: '', estacionamiento: '', mapa: '' };
    case 'servicios':
      return { items: [{ servicio: '', precio: '', duracion: '', notas: '' }], notas: '' };
    case 'faq':
      return { items: [{ pregunta: '', respuesta: '' }] };
  }
}

// ─── Render structured data → markdown ───

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function renderGeneral(d: Data): string {
  const lines = [`## Información general`];
  if (d.nombre) lines.push(`**Negocio:** ${d.nombre}`);
  if (d.descripcion) lines.push(`\n${d.descripcion}`);
  if (d.pagos) lines.push(`\n**Formas de pago:** ${d.pagos}`);
  return lines.join('\n');
}

function renderHorarios(d: Data): string {
  const lines = [`## Horarios de atención`];
  for (const day of DAYS) {
    const h: HorarioDia | undefined = d.dias?.[day];
    if (!h) continue;
    lines.push(`- **${day}:** ${h.cerrado ? 'Cerrado' : `${h.abre} – ${h.cierra}`}`);
  }
  if (d.notas) lines.push(`\n${d.notas}`);
  return lines.join('\n');
}

function renderUbicacion(d: Data): string {
  const lines = [`## Ubicación`];
  if (d.direccion) lines.push(`**Dirección:** ${d.direccion}`);
  if (d.referencias) lines.push(`**Cómo llegar:** ${d.referencias}`);
  if (d.estacionamiento) lines.push(`**Estacionamiento:** ${d.estacionamiento}`);
  if (d.mapa) lines.push(`**Mapa:** ${d.mapa}`);
  return lines.join('\n');
}

function renderServicios(d: Data): string {
  const items = (d.items ?? []).filter((it: Data) => it.servicio);
  const lines = [`## Servicios y precios`];
  for (const it of items) {
    const detail = [it.precio, it.duracion, it.notas].filter(Boolean).join(' · ');
    lines.push(`- **${it.servicio}**${detail ? ` — ${detail}` : ''}`);
  }
  if (d.notas) lines.push(`\n${d.notas}`);
  return lines.join('\n');
}

function renderFaq(d: Data): string {
  const items = (d.items ?? []).filter((it: Data) => it.pregunta);
  const lines = [`## Preguntas frecuentes`];
  for (const it of items) {
    lines.push(`\n**${it.pregunta}**\n${it.respuesta || ''}`);
  }
  return lines.join('\n');
}

/** Render a template's structured data into markdown for the model + admin display. */
export function renderTemplate(id: TemplateId, data: Data): string {
  switch (id) {
    case 'general':
      return renderGeneral(data);
    case 'horarios':
      return renderHorarios(data);
    case 'ubicacion':
      return renderUbicacion(data);
    case 'servicios':
      return renderServicios(data);
    case 'faq':
      return renderFaq(data);
  }
}