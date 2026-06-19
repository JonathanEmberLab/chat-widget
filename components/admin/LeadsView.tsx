'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Select, Space, Typography, Button, Descriptions, App } from 'antd';
import { RefreshCw } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { Lead, SiteConfig } from '@/lib/types';
import type { AdminApi } from '@/lib/admin-api';
import { formatDateTime, siteOptions } from './shared';

const SOURCE_META: Record<Lead['source'], { color: string; label: string }> = {
  chat: { color: 'blue', label: 'Solo chat' },
  booking: { color: 'green', label: 'Agendó' },
  whatsapp: { color: 'magenta', label: 'WhatsApp' },
};

const TEMP_META: Record<string, { color: string; label: string; emoji: string }> = {
  caliente: { color: 'volcano', label: 'Caliente', emoji: '🔥' },
  tibio: { color: 'gold', label: 'Tibio', emoji: '🌤️' },
  frio: { color: 'blue', label: 'Frío', emoji: '❄️' },
};

interface Props {
  api: AdminApi;
  sites: SiteConfig[];
}

export default function LeadsView({ api, sites }: Props) {
  const { message } = App.useApp();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState<string | undefined>();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setLeads(await api.listLeads(site));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al cargar leads');
    } finally {
      setLoading(false);
    }
  }, [api, site, message]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<Lead> = [
    {
      title: 'Nombre',
      dataIndex: 'name',
      key: 'name',
      render: (n: string | null) => n || <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      render: (e: string | null) =>
        e ? <a href={`mailto:${e}`}>{e}</a> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: 'Estado',
      dataIndex: 'source',
      key: 'source',
      filters: Object.entries(SOURCE_META).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (value, row) => row.source === value,
      render: (s: Lead['source']) => <Tag color={SOURCE_META[s]?.color}>{SOURCE_META[s]?.label ?? s}</Tag>,
    },
    {
      title: 'Calificación',
      key: 'score',
      sorter: (a, b) => (a.score ?? -1) - (b.score ?? -1),
      filters: Object.entries(TEMP_META).map(([k, v]) => ({ text: v.label, value: k })),
      onFilter: (value, row) => row.temperatura === value,
      render: (_, row) => {
        if (row.score == null) return <Typography.Text type="secondary" style={{ fontSize: 12 }}>Sin analizar</Typography.Text>;
        const t = row.temperatura ? TEMP_META[row.temperatura] : undefined;
        return (
          <Space>
            <strong style={{ fontSize: 15 }}>{row.score}</strong>
            {t && <Tag color={t.color}>{t.emoji} {t.label}</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Sitio',
      dataIndex: 'site_key',
      key: 'site_key',
      render: (k: string) => <Typography.Text code>{k}</Typography.Text>,
    },
    {
      title: 'Fecha',
      dataIndex: 'created_at',
      key: 'created_at',
      defaultSortOrder: 'descend',
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      render: (d: string) => formatDateTime(d),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Leads
        </Typography.Title>
        <Space>
          <Select
            allowClear
            placeholder="Todos los sitios"
            style={{ width: 200 }}
            value={site}
            onChange={setSite}
            options={siteOptions(sites)}
          />
          <Button icon={<RefreshCw size={15} />} onClick={load}>
            Actualizar
          </Button>
        </Space>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={leads}
        loading={loading}
        pagination={{ pageSize: 15, showSizeChanger: true }}
        expandable={{
          rowExpandable: (row) => !!row.analysis,
          expandedRowRender: (row) => {
            const a = row.analysis;
            if (!a) return null;
            return (
              <Descriptions size="small" column={1} styles={{ label: { width: 160, fontWeight: 600 } }}>
                <Descriptions.Item label="Resumen">{a.resumen}</Descriptions.Item>
                <Descriptions.Item label="Intención">{a.intencion}</Descriptions.Item>
                <Descriptions.Item label="Interés">
                  {a.interes?.length ? <Space wrap>{a.interes.map((i) => <Tag key={i}>{i}</Tag>)}</Space> : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Acción recomendada">{a.accion_recomendada}</Descriptions.Item>
                <Descriptions.Item label="Sentimiento">{a.sentimiento}</Descriptions.Item>
                <Descriptions.Item label="Objeciones">
                  {a.objeciones?.length ? <Space wrap>{a.objeciones.map((o) => <Tag key={o} color="red">{o}</Tag>)}</Space> : 'Ninguna'}
                </Descriptions.Item>
              </Descriptions>
            );
          },
        }}
      />
    </>
  );
}
