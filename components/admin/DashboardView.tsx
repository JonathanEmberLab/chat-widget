'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Row, Col, Card, Table, Typography, Tag, Empty, Skeleton, Button, App } from 'antd';
import { AppWindow, Users, CalendarDays, Clock, ArrowUpRight, Video, MessageSquare } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import type { Lead, Booking, Conversation, SiteConfig } from '@/lib/types';
import type { AdminApi } from '@/lib/admin-api';
import { formatDateTime } from './shared';

interface Props {
  api: AdminApi;
  sites: SiteConfig[];
  onNavigate: (key: string) => void;
}

const BRAND = { purple: '#6d59a1', pink: '#e87ca0', green: '#7fa860', amber: '#e0a13c' };

const SOURCE_META: Record<Lead['source'], { label: string; color: string }> = {
  chat: { label: 'Solo chat', color: BRAND.purple },
  booking: { label: 'Agendó', color: BRAND.green },
  whatsapp: { label: 'WhatsApp', color: BRAND.pink },
};

const DAYS_BACK = 14;

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function DashboardView({ api, sites, onNavigate }: Props) {
  const { message } = App.useApp();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [l, b, c] = await Promise.all([api.listLeads(), api.listBookings(), api.listConversations()]);
      setLeads(l);
      setBookings(b);
      setConversations(c);
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al cargar el dashboard');
    } finally {
      setLoading(false);
    }
  }, [api, message]);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const upcoming = bookings.filter((b) => new Date(b.datetime).getTime() > now);
  const recentLeads = leads.slice(0, 5);

  // Daily activity for the last N days (leads + bookings created per day).
  const activity = useMemo(() => {
    const buckets: Record<string, { label: string; Leads: number; Agendas: number; Conversaciones: number }> = {};
    const order: string[] = [];
    for (let i = DAYS_BACK - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { label: d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }), Leads: 0, Agendas: 0, Conversaciones: 0 };
      order.push(key);
    }
    leads.forEach((l) => { const k = dayKey(l.created_at); if (buckets[k]) buckets[k].Leads++; });
    bookings.forEach((b) => { const k = dayKey(b.created_at); if (buckets[k]) buckets[k].Agendas++; });
    conversations.forEach((c) => { const k = dayKey(c.created_at); if (buckets[k]) buckets[k].Conversaciones++; });
    return order.map((k) => buckets[k]);
  }, [leads, bookings, conversations]);

  // Leads by source for the donut.
  const bySource = useMemo(
    () =>
      (Object.keys(SOURCE_META) as Lead['source'][])
        .map((s) => ({ name: SOURCE_META[s].label, value: leads.filter((l) => l.source === s).length, color: SOURCE_META[s].color }))
        .filter((d) => d.value > 0),
    [leads],
  );

  const leadCols: ColumnsType<Lead> = [
    { title: 'Nombre', dataIndex: 'name', key: 'name', render: (n) => n || '—' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (e) => e || '—' },
    { title: 'Estado', dataIndex: 'source', key: 'source', render: (s: Lead['source']) => <Tag color={SOURCE_META[s]?.color}>{SOURCE_META[s]?.label ?? s}</Tag> },
    { title: 'Fecha', dataIndex: 'created_at', key: 'created_at', render: (d) => formatDateTime(d) },
  ];

  const bookingCols: ColumnsType<Booking> = [
    { title: 'Cuándo', dataIndex: 'datetime', key: 'datetime', render: (d) => formatDateTime(d) },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Sitio', dataIndex: 'site_key', key: 'site_key', render: (k) => <Typography.Text code>{k}</Typography.Text> },
    {
      title: 'Meet',
      dataIndex: 'meet_link',
      key: 'meet_link',
      render: (link: string | null) =>
        link ? (
          <Button type="link" size="small" icon={<Video size={15} />} href={link} target="_blank">
            Unirse
          </Button>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
  ];

  const stats = [
    { title: 'Sitios', value: sites.length, icon: AppWindow, accent: BRAND.purple, key: 'sites' },
    { title: 'Leads', value: leads.length, icon: Users, accent: BRAND.pink, key: 'leads' },
    { title: 'Agendas', value: bookings.length, icon: CalendarDays, accent: BRAND.green, key: 'bookings' },
    { title: 'Próximas reuniones', value: upcoming.length, icon: Clock, accent: BRAND.amber, key: 'bookings' },
    { title: 'Conversaciones', value: conversations.length, icon: MessageSquare, accent: '#3aa6a0', key: 'conversations' },
  ];

  return (
    <>
      <Typography.Title level={4} style={{ marginTop: 0 }}>
        Resumen
      </Typography.Title>

      <Row gutter={[16, 16]}>
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Col key={s.title} flex="1 1 180px" style={{ minWidth: 160 }}>
              <Card hoverable onClick={() => onNavigate(s.key)} style={{ cursor: 'pointer', height: '100%' }} styles={{ body: { padding: 20 } }}>
                {loading ? (
                  <Skeleton active paragraph={{ rows: 1, width: '60%' }} title={{ width: '40%' }} />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', background: `${s.accent}1a`, color: s.accent, flexShrink: 0,
                      }}
                    >
                      <Icon size={24} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1.1 }}>{s.value}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>{s.title}</Typography.Text>
                    </div>
                  </div>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title={`Actividad — últimos ${DAYS_BACK} días`} loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={activity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={2}>
                <defs>
                  <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND.purple} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={BRAND.purple} stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="gBookings" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={BRAND.green} stopOpacity={0.95} />
                    <stop offset="100%" stopColor={BRAND.green} stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="gConversations" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3aa6a0" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#3aa6a0" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee9f2" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8c8496' }} tickLine={false} axisLine={{ stroke: '#eee9f2' }} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8c8496' }} tickLine={false} axisLine={false} width={28} />
                <RTooltip
                  cursor={{ fill: '#6d59a10d' }}
                  contentStyle={{ borderRadius: 10, border: '1px solid #efedf4', boxShadow: '0 6px 20px rgba(16,12,30,.08)', fontSize: 12 }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Bar dataKey="Leads" fill="url(#gLeads)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Agendas" fill="url(#gBookings)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                <Bar dataKey="Conversaciones" fill="url(#gConversations)" radius={[4, 4, 0, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="Leads por estado" loading={loading} style={{ height: '100%' }}>
            {bySource.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin leads todavía" style={{ padding: '48px 0' }} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={bySource} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={3} stroke="none">
                    {bySource.map((d) => <Cell key={d.name} fill={d.color} />)}
                  </Pie>
                  <RTooltip
                    contentStyle={{ borderRadius: 10, border: '1px solid #efedf4', boxShadow: '0 6px 20px rgba(16,12,30,.08)', fontSize: 12 }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card
            title="Leads recientes"
            loading={loading}
            extra={<a onClick={() => onNavigate('leads')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver todos <ArrowUpRight size={14} /></a>}
          >
            {recentLeads.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin leads todavía" />
            ) : (
              <Table rowKey="id" size="small" columns={leadCols} dataSource={recentLeads} pagination={false} />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Próximas reuniones"
            loading={loading}
            extra={<a onClick={() => onNavigate('bookings')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Ver todas <ArrowUpRight size={14} /></a>}
          >
            {upcoming.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Sin reuniones próximas" />
            ) : (
              <Table rowKey="id" size="small" columns={bookingCols} dataSource={upcoming.slice(0, 5)} pagination={false} />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );
}
