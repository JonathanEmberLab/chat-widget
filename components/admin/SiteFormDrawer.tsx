'use client';

import { useEffect } from 'react';
import { Drawer, Form, Input, ColorPicker, Button, Space, Typography } from 'antd';
import type { SiteConfig } from '@/lib/types';

interface Props {
  open: boolean;
  /** When set, the drawer is in edit mode. */
  initial?: SiteConfig | null;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: Partial<SiteConfig>) => Promise<void>;
}

const DEFAULTS: Partial<SiteConfig> = {
  accent_color: '#4A8F8A',
  welcome_message: 'Hola 👋 ¿En qué puedo ayudarte?',
};

export default function SiteFormDrawer({ open, initial, loading, onClose, onSubmit }: Props) {
  const [form] = Form.useForm();
  const editing = !!initial;

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(initial ?? DEFAULTS);
  }, [open, initial, form]);

  async function handleOk() {
    const values = await form.validateFields();
    await onSubmit(values);
  }

  return (
    <Drawer
      title={editing ? `Editar — ${initial?.name}` : 'Nuevo sitio'}
      styles={{ wrapper: { width: 520 } }}
      open={open}
      onClose={onClose}
      destroyOnClose
      extra={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="primary" loading={loading} onClick={handleOk}>
            {editing ? 'Guardar' : 'Crear sitio'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Form.Item
          name="site_key"
          label="Site key"
          tooltip="Identificador único, sin espacios. No se puede cambiar después de crear."
          rules={[
            { required: true, message: 'Requerido' },
            { pattern: /^[a-z0-9-]+$/, message: 'Solo minúsculas, números y guiones' },
          ]}
        >
          <Input placeholder="mi-cliente" disabled={editing} />
        </Form.Item>

        <Form.Item name="name" label="Nombre del negocio" rules={[{ required: true, message: 'Requerido' }]}>
          <Input placeholder="Demo Test" />
        </Form.Item>

        <Form.Item
          name="system_prompt"
          label="System prompt"
          tooltip="Quién es el negocio, qué servicios ofrece, tono. Define cómo responde el bot."
        >
          <Input.TextArea rows={5} placeholder="Eres el asistente de..." />
        </Form.Item>

        <Form.Item name="whatsapp_number" label="WhatsApp" tooltip="Solo dígitos, formato internacional.">
          <Input placeholder="525668029233" />
        </Form.Item>

        <Form.Item
          name="accent_color"
          label="Color de acento"
          getValueFromEvent={(color) => (typeof color === 'string' ? color : color?.toHexString())}
        >
          <ColorPicker format="hex" showText />
        </Form.Item>

        <Form.Item name="allowed_domain" label="Dominio permitido" tooltip="Vacío = cualquier dominio (CORS).">
          <Input placeholder="ejemplo.com" />
        </Form.Item>

        <Form.Item name="welcome_message" label="Mensaje de bienvenida">
          <Input />
        </Form.Item>
      </Form>

      {editing && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          El site key no se puede modificar.
        </Typography.Text>
      )}
    </Drawer>
  );
}
