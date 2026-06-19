'use client';

import { useState } from 'react';
import { Table, Button, Space, Tag, Typography, Popconfirm, App, Tooltip } from 'antd';
import { Plus, Copy, Pencil, Trash2, BookOpen } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { SiteConfig } from '@/lib/types';
import type { AdminApi } from '@/lib/admin-api';
import SiteFormDrawer from './SiteFormDrawer';
import KnowledgePanel from './KnowledgePanel';

const WIDGET_ORIGIN =
  process.env.NEXT_PUBLIC_WIDGET_ORIGIN ||
  (typeof window !== 'undefined' ? window.location.origin : '');

function snippetFor(siteKey: string) {
  return `<script src="${WIDGET_ORIGIN}/widget.js" data-site="${siteKey}"></script>`;
}

interface Props {
  api: AdminApi;
  sites: SiteConfig[];
  loading: boolean;
  reload: () => void;
}

export default function SitesView({ api, sites, loading, reload }: Props) {
  const { message } = App.useApp();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<SiteConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [kbSite, setKbSite] = useState<SiteConfig | null>(null);

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }
  function openEdit(site: SiteConfig) {
    setEditing(site);
    setDrawerOpen(true);
  }

  async function handleSubmit(values: Partial<SiteConfig>) {
    setSaving(true);
    try {
      if (editing) {
        await api.updateSite(editing.site_key, values);
        message.success('Sitio actualizado');
      } else {
        await api.createSite(values);
        message.success('Sitio creado');
      }
      setDrawerOpen(false);
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(siteKey: string) {
    try {
      await api.deleteSite(siteKey);
      message.success('Sitio eliminado');
      reload();
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al eliminar');
    }
  }

  function copySnippet(siteKey: string) {
    navigator.clipboard.writeText(snippetFor(siteKey));
    message.success('Snippet copiado');
  }

  const columns: ColumnsType<SiteConfig> = [
    {
      title: 'Negocio',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row) => (
        <Space>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: row.accent_color,
              display: 'inline-block',
              border: '1px solid rgba(0,0,0,0.1)',
            }}
          />
          <strong>{name}</strong>
        </Space>
      ),
    },
    {
      title: 'Site key',
      dataIndex: 'site_key',
      key: 'site_key',
      render: (k: string) => <Typography.Text code>{k}</Typography.Text>,
    },
    {
      title: 'WhatsApp',
      dataIndex: 'whatsapp_number',
      key: 'whatsapp_number',
      render: (w: string) => w || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Dominio',
      dataIndex: 'allowed_domain',
      key: 'allowed_domain',
      render: (d: string) => (d ? <Tag>{d}</Tag> : <Tag color="blue">cualquiera</Tag>),
    },
    {
      title: 'Acciones',
      key: 'actions',
      align: 'right',
      render: (_, row) => (
        <Space>
          <Tooltip title="Copiar snippet">
            <Button size="small" icon={<Copy size={15} />} onClick={() => copySnippet(row.site_key)} />
          </Tooltip>
          <Tooltip title="Base de conocimiento">
            <Button size="small" icon={<BookOpen size={15} />} onClick={() => setKbSite(row)} />
          </Tooltip>
          <Tooltip title="Editar">
            <Button size="small" icon={<Pencil size={15} />} onClick={() => openEdit(row)} />
          </Tooltip>
          <Popconfirm
            title="¿Eliminar este sitio?"
            description="Se borran también sus leads, conversaciones y agendas."
            okText="Eliminar"
            okButtonProps={{ danger: true }}
            cancelText="Cancelar"
            onConfirm={() => handleDelete(row.site_key)}
          >
            <Button size="small" danger icon={<Trash2 size={15} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (kbSite) {
    return <KnowledgePanel api={api} site={kbSite} onBack={() => setKbSite(null)} />;
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Sitios
        </Typography.Title>
        <Button type="primary" icon={<Plus size={16} />} onClick={openCreate}>
          Nuevo sitio
        </Button>
      </div>

      <Table
        rowKey="site_key"
        columns={columns}
        dataSource={sites}
        loading={loading}
        pagination={{ pageSize: 10, hideOnSinglePage: true }}
        expandable={{
          expandedRowRender: (row) => (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="secondary">Snippet de integración:</Typography.Text>
              <Typography.Paragraph
                copyable={{ text: snippetFor(row.site_key) }}
                code
                style={{ margin: 0, wordBreak: 'break-all' }}
              >
                {snippetFor(row.site_key)}
              </Typography.Paragraph>
            </Space>
          ),
        }}
      />

      <SiteFormDrawer
        open={drawerOpen}
        initial={editing}
        loading={saving}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
      />
    </>
  );
}
