'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Table, Select, Space, Typography, Button, Tag, Segmented, Calendar, Badge, Popover, Card, App } from 'antd';
import { RefreshCw, Video, List as ListIcon, CalendarDays } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import type { Booking, SiteConfig } from '@/lib/types';
import type { AdminApi } from '@/lib/admin-api';
import { formatDateTime, siteOptions } from './shared';

interface Props {
  api: AdminApi;
  sites: SiteConfig[];
}

export default function BookingsView({ api, sites }: Props) {
  const { message } = App.useApp();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [site, setSite] = useState<string | undefined>();
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await api.listBookings(site));
    } catch (e) {
      message.error(e instanceof Error ? e.message : 'Error al cargar agendas');
    } finally {
      setLoading(false);
    }
  }, [api, site, message]);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();

  // Group bookings by calendar day for the calendar view.
  const byDay = useMemo(() => {
    const map: Record<string, Booking[]> = {};
    bookings.forEach((b) => {
      const key = dayjs(b.datetime).format('YYYY-MM-DD');
      (map[key] ??= []).push(b);
    });
    Object.values(map).forEach((list) => list.sort((a, b) => +new Date(a.datetime) - +new Date(b.datetime)));
    return map;
  }, [bookings]);

  const columns: ColumnsType<Booking> = [
    {
      title: 'Fecha y hora',
      dataIndex: 'datetime',
      key: 'datetime',
      defaultSortOrder: 'descend',
      sorter: (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime(),
      render: (d: string) => {
        const upcoming = new Date(d).getTime() > now;
        return (
          <Space>
            {formatDateTime(d)}
            {upcoming && <Tag color="green">próxima</Tag>}
          </Space>
        );
      },
    },
    { title: 'Nombre', dataIndex: 'name', key: 'name' },
    { title: 'Email', dataIndex: 'email', key: 'email', render: (e: string) => <a href={`mailto:${e}`}>{e}</a> },
    { title: 'Sitio', dataIndex: 'site_key', key: 'site_key', render: (k: string) => <Typography.Text code>{k}</Typography.Text> },
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

  function cellRender(current: Dayjs, info: { type: string }) {
    if (info.type !== 'date') return null;
    const items = byDay[current.format('YYYY-MM-DD')];
    if (!items?.length) return null;
    return (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {items.slice(0, 3).map((b) => {
          const upcoming = new Date(b.datetime).getTime() > now;
          const content = (
            <div style={{ maxWidth: 240 }}>
              <div><strong>{b.name}</strong></div>
              <div style={{ fontSize: 12, color: '#888' }}>{formatDateTime(b.datetime)}</div>
              <div style={{ fontSize: 12 }}>{b.email}</div>
              {b.meet_link && (
                <Button type="link" size="small" style={{ padding: 0 }} icon={<Video size={14} />} href={b.meet_link} target="_blank">
                  Unirse a Meet
                </Button>
              )}
            </div>
          );
          return (
            <li key={b.id} style={{ marginBottom: 2 }}>
              <Popover content={content} title="Reunión">
                <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <Badge status={upcoming ? 'success' : 'default'} text={<span style={{ fontSize: 11 }}>{dayjs(b.datetime).format('HH:mm')} {b.name}</span>} />
                </span>
              </Popover>
            </li>
          );
        })}
        {items.length > 3 && <li style={{ fontSize: 11, color: '#8c8496' }}>+{items.length - 3} más</li>}
      </ul>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Agendas
        </Typography.Title>
        <Space wrap>
          <Segmented
            value={view}
            onChange={(v) => setView(v as 'list' | 'calendar')}
            options={[
              { label: 'Lista', value: 'list', icon: <ListIcon size={15} /> },
              { label: 'Calendario', value: 'calendar', icon: <CalendarDays size={15} /> },
            ]}
          />
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

      {view === 'list' ? (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={bookings}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true }}
        />
      ) : (
        <Card loading={loading} styles={{ body: { padding: 12 } }}>
          <Calendar cellRender={cellRender} />
        </Card>
      )}
    </>
  );
}
