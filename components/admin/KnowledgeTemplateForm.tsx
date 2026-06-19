'use client';

import { useState } from 'react';
import { Input, Button, Space, Switch, Typography, Divider } from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import {
  DAYS,
  emptyData,
  TEMPLATE_TITLE,
  type TemplateId,
  type HorarioDia,
} from '@/lib/knowledge-templates';

interface Props {
  templateId: TemplateId;
  initialTitle?: string;
  initialData?: Record<string, unknown>;
  saving: boolean;
  editing: boolean;
  onSave: (title: string, data: Record<string, unknown>) => void;
  onCancel: () => void;
}

type Data = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export default function KnowledgeTemplateForm({
  templateId,
  initialTitle,
  initialData,
  saving,
  editing,
  onSave,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initialTitle ?? TEMPLATE_TITLE[templateId]);
  const [data, setData] = useState<Data>(initialData ?? emptyData(templateId));

  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  // ── List helpers (servicios / faq) ──
  const updateItem = (i: number, key: string, value: string) =>
    setData((d) => {
      const items = [...(d.items ?? [])];
      items[i] = { ...items[i], [key]: value };
      return { ...d, items };
    });
  const addItem = (blank: Data) => setData((d) => ({ ...d, items: [...(d.items ?? []), blank] }));
  const removeItem = (i: number) =>
    setData((d) => ({ ...d, items: (d.items ?? []).filter((_: Data, idx: number) => idx !== i) }));

  // ── Horarios helpers ──
  const updateDay = (day: string, patch: Partial<HorarioDia>) =>
    setData((d) => ({ ...d, dias: { ...d.dias, [day]: { ...d.dias?.[day], ...patch } } }));

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>Título</Typography.Text>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <Divider style={{ margin: 0 }} />

      {templateId === 'general' && (
        <>
          <Field label="Nombre del negocio">
            <Input value={data.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Barbería El Buen Corte" />
          </Field>
          <Field label="¿Qué hace el negocio?">
            <Input.TextArea rows={3} value={data.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Cortes de cabello, barba y afeitado clásico para hombre." />
          </Field>
          <Field label="Formas de pago">
            <Input value={data.pagos} onChange={(e) => set('pagos', e.target.value)} placeholder="Efectivo, tarjeta, transferencia" />
          </Field>
        </>
      )}

      {templateId === 'horarios' && (
        <>
          {DAYS.map((day) => {
            const h: HorarioDia = data.dias?.[day] ?? { cerrado: false, abre: '', cierra: '' };
            return (
              <div key={day} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 90, fontSize: 13 }}>{day}</span>
                <Switch
                  size="small"
                  checked={!h.cerrado}
                  onChange={(open) => updateDay(day, { cerrado: !open })}
                  checkedChildren="Abre"
                  unCheckedChildren="Cerrado"
                />
                {!h.cerrado && (
                  <>
                    <Input style={{ width: 90 }} value={h.abre} onChange={(e) => updateDay(day, { abre: e.target.value })} placeholder="09:00" />
                    <span>–</span>
                    <Input style={{ width: 90 }} value={h.cierra} onChange={(e) => updateDay(day, { cierra: e.target.value })} placeholder="18:00" />
                  </>
                )}
              </div>
            );
          })}
          <Field label="Notas (opcional)">
            <Input value={data.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Cerramos en días festivos." />
          </Field>
        </>
      )}

      {templateId === 'ubicacion' && (
        <>
          <Field label="Dirección">
            <Input value={data.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Av. Reforma 123, Col. Centro, CDMX" />
          </Field>
          <Field label="Cómo llegar / referencias">
            <Input.TextArea rows={2} value={data.referencias} onChange={(e) => set('referencias', e.target.value)} placeholder="A dos cuadras del metro Hidalgo." />
          </Field>
          <Field label="Estacionamiento">
            <Input value={data.estacionamiento} onChange={(e) => set('estacionamiento', e.target.value)} placeholder="Estacionamiento público en la esquina." />
          </Field>
          <Field label="Enlace de mapa (opcional)">
            <Input value={data.mapa} onChange={(e) => set('mapa', e.target.value)} placeholder="https://maps.google.com/..." />
          </Field>
        </>
      )}

      {templateId === 'servicios' && (
        <>
          {(data.items ?? []).map((it: Data, i: number) => (
            <div key={i} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Servicio {i + 1}</Typography.Text>
                <Button size="small" danger type="text" icon={<Trash2 size={15} />} onClick={() => removeItem(i)} />
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={6}>
                <Input value={it.servicio} onChange={(e) => updateItem(i, 'servicio', e.target.value)} placeholder="Corte de cabello" />
                <Space.Compact style={{ width: '100%' }}>
                  <Input value={it.precio} onChange={(e) => updateItem(i, 'precio', e.target.value)} placeholder="$200 MXN" />
                  <Input value={it.duracion} onChange={(e) => updateItem(i, 'duracion', e.target.value)} placeholder="30 min" />
                </Space.Compact>
                <Input value={it.notas} onChange={(e) => updateItem(i, 'notas', e.target.value)} placeholder="Notas (opcional)" />
              </Space>
            </div>
          ))}
          <Button block icon={<Plus size={16} />} onClick={() => addItem({ servicio: '', precio: '', duracion: '', notas: '' })}>
            Agregar servicio
          </Button>
          <Field label="Notas generales (opcional)">
            <Input value={data.notas} onChange={(e) => set('notas', e.target.value)} placeholder="Precios incluyen lavado." />
          </Field>
        </>
      )}

      {templateId === 'faq' && (
        <>
          {(data.items ?? []).map((it: Data, i: number) => (
            <div key={i} style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>Pregunta {i + 1}</Typography.Text>
                <Button size="small" danger type="text" icon={<Trash2 size={15} />} onClick={() => removeItem(i)} />
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={6}>
                <Input value={it.pregunta} onChange={(e) => updateItem(i, 'pregunta', e.target.value)} placeholder="¿Necesito cita?" />
                <Input.TextArea rows={2} value={it.respuesta} onChange={(e) => updateItem(i, 'respuesta', e.target.value)} placeholder="Puedes llegar sin cita, pero con cita evitas la espera." />
              </Space>
            </div>
          ))}
          <Button block icon={<Plus size={16} />} onClick={() => addItem({ pregunta: '', respuesta: '' })}>
            Agregar pregunta
          </Button>
        </>
      )}

      <Space>
        <Button type="primary" loading={saving} onClick={() => onSave(title, data)}>
          {editing ? 'Guardar cambios' : 'Agregar'}
        </Button>
        <Button onClick={onCancel}>Cancelar</Button>
      </Space>
    </Space>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>{label}</Typography.Text>
      {children}
    </div>
  );
}