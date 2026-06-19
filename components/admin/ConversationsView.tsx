'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, Select, Space, Typography, Button, Tag, Modal, Empty, Descriptions, Divider, App } from 'antd';
import { RefreshCw, MessageSquare, User, Bot, Sparkles } from 'lucide-react';
import type { ColumnsType } from 'antd/es/table';
import type { Conversation, ChatMessage, LeadAnalysis, SiteConfig } from '@/lib/types';
import type { AdminApi } from '@/lib/admin-api';
import { formatDateTime, siteOptions } from './shared';

const TEMP_META: Record<string, { color: string; label: string; emoji: string }> = {
  caliente: { color: 'volcano', label: 'Caliente', emoji: '🔥' },
  tibio: { color: 'gold', label: 'Tibio', emoji: '🌤️' },
  frio: { color: 'blue', label: 'Frío', emoji: '❄️' },
};

interface Props {
  api: AdminApi;
  sites: SiteConfig[];
}

function firstUserMessage(messages: ChatMessage[]): string {
  return messages.find((m) => m.role === 'user')?.content ?? '—';
}

export default function ConversationsView({ api, sites }: Props) {
  const { message } = App.useApp();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState<string | undefined>();
  const [open, setOpen] = useState<Conversation | null>(null);
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  function openConversation(row: Conversation) {
    setOpen(row);
    setAnalysis(null);
  }

  async function analyze() {
    if (!open) return;
    setAnalyzing(true);
    try {
      const { analysis: a, saved } = await api.analyzeConversation(open.id);
      setAnalysis(a);
      message.success(saved ? 'Lead analizado y clasificado' : 'Analizado (sin correo para ligar al lead)');
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al analizar');
    } finally {
      setAnalyzing(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConversations(await api.listConversations(site));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al cargar conversaciones');
    } finally {
      setLoading(false);
    }
  }, [api, site, message]);

  useEffect(() => {
    load();
  }, [load]);

  const columns: ColumnsType<Conversation> = [
    {
      title: 'Conversación',
      key: 'preview',
      render: (_, row) => (
        <Space>
          <MessageSquare size={16} color="#6d59a1" />
          <Typography.Text style={{ maxWidth: 360 }} ellipsis>
            {firstUserMessage(row.messages)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: 'Mensajes',
      key: 'count',
      width: 110,
      render: (_, row) => <Tag>{row.messages.length}</Tag>,
      sorter: (a, b) => a.messages.length - b.messages.length,
    },
    {
      title: 'Sitio',
      dataIndex: 'site_key',
      key: 'site_key',
      render: (k: string) => <Typography.Text code>{k}</Typography.Text>,
    },
    {
      title: 'Última actividad',
      dataIndex: 'updated_at',
      key: 'updated_at',
      defaultSortOrder: 'descend',
      sorter: (a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime(),
      render: (d: string) => formatDateTime(d),
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      width: 80,
      render: (_, row) => (
        <Button size="small" onClick={() => openConversation(row)}>
          Abrir
        </Button>
      ),
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Conversaciones
        </Typography.Title>
        <Space wrap>
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
        dataSource={conversations}
        loading={loading}
        onRow={(row) => ({ onClick: () => openConversation(row), style: { cursor: 'pointer' } })}
        pagination={{ pageSize: 15, showSizeChanger: true }}
      />

      <Modal
        title={
          <Space>
            <MessageSquare size={18} color="#6d59a1" />
            Conversación
            {open && <Typography.Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>· {formatDateTime(open.updated_at)}</Typography.Text>}
          </Space>
        }
        open={!!open}
        onCancel={() => setOpen(null)}
        footer={null}
        width={640}
      >
        <div style={{ marginBottom: 12 }}>
          <Button type="primary" icon={<Sparkles size={15} />} loading={analyzing} onClick={analyze}>
            {analysis ? 'Re-analizar' : 'Analizar conversación'}
          </Button>
        </div>

        {analysis && (
          <>
            <div style={{ background: '#faf9fc', border: '1px solid #efedf4', borderRadius: 10, padding: 16, marginBottom: 12 }}>
              <Space align="center" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 26, fontWeight: 700 }}>{analysis.score}</span>
                <span style={{ color: '#8c8496' }}>/100</span>
                {analysis.temperatura && (
                  <Tag color={TEMP_META[analysis.temperatura]?.color}>
                    {TEMP_META[analysis.temperatura]?.emoji} {TEMP_META[analysis.temperatura]?.label}
                  </Tag>
                )}
              </Space>
              <Descriptions size="small" column={1} styles={{ label: { width: 150, fontWeight: 600 } }}>
                <Descriptions.Item label="Resumen">{analysis.resumen}</Descriptions.Item>
                <Descriptions.Item label="Intención">{analysis.intencion}</Descriptions.Item>
                <Descriptions.Item label="Interés">
                  {analysis.interes?.length ? <Space wrap>{analysis.interes.map((i) => <Tag key={i}>{i}</Tag>)}</Space> : '—'}
                </Descriptions.Item>
                <Descriptions.Item label="Acción recomendada">{analysis.accion_recomendada}</Descriptions.Item>
                <Descriptions.Item label="Sentimiento">{analysis.sentimiento}</Descriptions.Item>
                <Descriptions.Item label="Objeciones">
                  {analysis.objeciones?.length ? <Space wrap>{analysis.objeciones.map((o) => <Tag key={o} color="red">{o}</Tag>)}</Space> : 'Ninguna'}
                </Descriptions.Item>
              </Descriptions>
            </div>
            <Divider style={{ margin: '8px 0' }}>Conversación</Divider>
          </>
        )}

        {open && open.messages.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin mensajes" />
        ) : (
          <div style={{ maxHeight: '60vh', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 2px' }}>
            {open?.messages.map((m, i) => {
              const isUser = m.role === 'user';
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start' }}>
                  <Space size={4} style={{ marginBottom: 2 }}>
                    {isUser ? <User size={13} color="#8c8496" /> : <Bot size={13} color="#6d59a1" />}
                    <Typography.Text type="secondary" style={{ fontSize: 11 }}>{isUser ? 'Visitante' : 'Asistente'}</Typography.Text>
                  </Space>
                  <div
                    style={{
                      maxWidth: '80%',
                      padding: '8px 12px',
                      borderRadius: 12,
                      fontSize: 13,
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      background: isUser ? '#6d59a1' : '#f2f0f7',
                      color: isUser ? '#fff' : '#2b2440',
                      borderTopRightRadius: isUser ? 2 : 12,
                      borderTopLeftRadius: isUser ? 12 : 2,
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>
    </>
  );
}
