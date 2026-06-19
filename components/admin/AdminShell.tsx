'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ConfigProvider,
  App,
  Layout,
  Menu,
  Card,
  Input,
  Button,
  Typography,
  theme as antdTheme,
} from 'antd';
import {
  LayoutDashboard,
  AppWindow,
  Users,
  MessageSquare,
  LogOut,
  MessagesSquare,
} from 'lucide-react';
import type { SiteConfig } from '@/lib/types';
import { makeAdminApi, UnauthorizedError } from '@/lib/admin-api';
import DashboardView from './DashboardView';
import SitesView from './SitesView';
import LeadsView from './LeadsView';
import ConversationsView from './ConversationsView';

const { Header, Sider, Content } = Layout;

const MENU = [
  { key: 'dashboard', icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { key: 'sites', icon: <AppWindow size={18} />, label: 'Sitios' },
  { key: 'leads', icon: <Users size={18} />, label: 'Leads' },
  { key: 'conversations', icon: <MessageSquare size={18} />, label: 'Conversaciones' },
];

// Brand palette (provided by the client).
const C = {
  greenLight: '#c7dda3',
  green: '#7fa860',
  purple: '#301f4b',
  purpleDeep: '#241636',
  purpleLight: '#caa4cc',
  purpleSoft: '#6d59a1',
  red: '#e73f40',
  redLight: '#f3a5a6',
  pink: '#e87ca0',
  white: '#edeae7',
  bg: '#f4f2f7',
};

const THEME = {
  token: {
    colorPrimary: C.purpleSoft,
    colorInfo: C.purpleSoft,
    colorError: C.red,
    colorLink: C.purpleSoft,
    colorBgLayout: C.bg,
    borderRadius: 10,
    fontSize: 14,
    fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`,
  },
  components: {
    Menu: {
      darkItemBg: 'transparent',
      darkSubMenuItemBg: 'transparent',
      darkPopupBg: C.purple,
      darkItemColor: 'rgba(255,255,255,0.72)',
      darkItemHoverColor: '#ffffff',
      darkItemHoverBg: 'rgba(255,255,255,0.08)',
      darkItemSelectedBg: C.purpleSoft,
      darkItemSelectedColor: '#ffffff',
      itemBorderRadius: 10,
      itemMarginInline: 10,
      itemHeight: 42,
    },
    Layout: {
      siderBg: 'transparent',
      headerBg: '#ffffff',
      headerHeight: 60,
      triggerBg: C.purpleDeep,
    },
    Card: { borderRadiusLG: 16 },
    Button: { borderRadius: 8, controlHeight: 36, primaryShadow: 'none' },
    Table: { headerBg: '#faf9fc', borderColor: '#f0eef4', headerSplitColor: '#f0eef4' },
    Segmented: { borderRadius: 8, trackBg: '#f0eef4' },
    Input: { borderRadius: 8 },
  },
};

/** Global polish that component tokens don't cover (shadows, scrollbars). */
function GlobalStyle() {
  return (
    <style>{`
      .ant-card { box-shadow: 0 1px 2px rgba(16,12,30,.04), 0 6px 20px rgba(16,12,30,.05); border-color: #efedf4; }
      .ant-card.ant-card-bordered { border-color: #efedf4; }
      .admin-sider { box-shadow: 2px 0 16px rgba(16,12,30,.14); }
      .admin-content::-webkit-scrollbar { width: 10px; height: 10px; }
      .admin-content::-webkit-scrollbar-thumb { background: #d9d4e3; border-radius: 8px; }
    `}</style>
  );
}

function LoginScreen({ onLogin }: { onLogin: (token: string) => Promise<string | null> }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    const err = await onLogin(token);
    setError(err ?? '');
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `radial-gradient(1200px 600px at 50% -10%, ${C.purpleSoft}22, transparent), ${C.bg}`,
        padding: 24,
      }}
    >
      <Card style={{ width: 400 }} styles={{ body: { padding: 32 } }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div
            style={{
              width: 60,
              height: 60,
              margin: '0 auto 16px',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${C.purpleSoft}, ${C.purple})`,
              boxShadow: `0 8px 24px ${C.purpleSoft}55`,
            }}
          >
            <MessagesSquare size={28} color="#fff" />
          </div>
          <Typography.Title level={3} style={{ marginBottom: 0, marginTop: 0 }}>
            Chat Widget
          </Typography.Title>
          <Typography.Text type="secondary">Panel de administración</Typography.Text>
        </div>
        <Input.Password
          placeholder="Admin token"
          value={token}
          size="large"
          onChange={(e) => setToken(e.target.value)}
          onPressEnter={submit}
          status={error ? 'error' : undefined}
        />
        {error && (
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 8, fontSize: 13 }}>
            {error}
          </Typography.Text>
        )}
        <Button type="primary" size="large" block loading={loading} onClick={submit} style={{ marginTop: 16 }}>
          Entrar
        </Button>
      </Card>
    </div>
  );
}

function Dashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const { message } = App.useApp();
  const api = useMemo(() => makeAdminApi(token), [token]);
  const [view, setView] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [sites, setSites] = useState<SiteConfig[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  const reloadSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      setSites(await api.listSites());
    } catch (e) {
      if (e instanceof UnauthorizedError) onLogout();
      else message.error(e instanceof Error ? e.message : 'Error al cargar sitios');
    } finally {
      setLoadingSites(false);
    }
  }, [api, message, onLogout]);

  useEffect(() => {
    reloadSites();
  }, [reloadSites]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        theme="dark"
        className="admin-sider"
        style={{ background: `linear-gradient(180deg, ${C.purple} 0%, ${C.purpleDeep} 100%)` }}
      >
        <div
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? 0 : '0 20px',
            fontWeight: 700,
            fontSize: 16,
            color: C.white,
          }}
        >
          <MessagesSquare size={22} color={C.greenLight} />
          {!collapsed && <span>Chat Widget</span>}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[view]}
          items={MENU}
          onClick={({ key }) => setView(key)}
          style={{ background: 'transparent', borderInlineEnd: 'none', marginTop: 8 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #efedf4',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <Typography.Text strong style={{ fontSize: 16 }}>
            {MENU.find((m) => m.key === view)?.label}
          </Typography.Text>
          <Button icon={<LogOut size={16} />} onClick={onLogout}>
            Salir
          </Button>
        </Header>
        <Content className="admin-content" style={{ margin: 24, overflow: 'auto' }}>
          {view === 'dashboard' && <DashboardView api={api} sites={sites} onNavigate={setView} />}
          {view === 'sites' && (
            <SitesView api={api} sites={sites} loading={loadingSites} reload={reloadSites} />
          )}
          {view === 'leads' && <LeadsView api={api} sites={sites} />}
          {view === 'conversations' && <ConversationsView api={api} sites={sites} />}
        </Content>
      </Layout>
    </Layout>
  );
}

export default function AdminShell() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  // Validate a token by hitting the sites endpoint. Returns an error string or null.
  const validate = useCallback(async (t: string): Promise<string | null> => {
    try {
      await makeAdminApi(t).listSites();
      localStorage.setItem('admin_token', t);
      setToken(t);
      return null;
    } catch (e) {
      if (e instanceof UnauthorizedError) return 'Token inválido';
      return e instanceof Error ? e.message : 'Error de conexión';
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('admin_token');
    if (saved) validate(saved).finally(() => setReady(true));
    else setReady(true);
  }, [validate]);

  function logout() {
    localStorage.removeItem('admin_token');
    setToken(null);
  }

  return (
    <ConfigProvider theme={{ ...THEME, algorithm: antdTheme.defaultAlgorithm }}>
      <App>
        <GlobalStyle />
        {!ready ? null : token ? (
          <Dashboard token={token} onLogout={logout} />
        ) : (
          <LoginScreen onLogin={validate} />
        )}
      </App>
    </ConfigProvider>
  );
}