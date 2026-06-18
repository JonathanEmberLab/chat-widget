'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SiteConfig } from '@/lib/types';

const WIDGET_ORIGIN =
  process.env.NEXT_PUBLIC_WIDGET_ORIGIN ||
  (typeof window !== 'undefined' ? window.location.origin : '');

export default function AdminPage() {
  const [token, setToken] = useState('');
  const [authed, setAuthed] = useState(false);
  const [sites, setSites] = useState<SiteConfig[]>([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    site_key: '', name: '', system_prompt: '', calendar_id: 'primary',
    responsible_email: '', whatsapp_number: '', accent_color: '#4A8F8A',
    allowed_domain: '', welcome_message: 'Hola 👋 ¿En qué puedo ayudarte?',
  });

  const loadSites = useCallback(async (t: string) => {
    const res = await fetch('/api/sites', { headers: { authorization: `Bearer ${t}` } });
    if (res.status === 401) { setError('Token inválido'); setAuthed(false); return; }
    const data = await res.json();
    setSites(data.sites ?? []);
    setAuthed(true);
    setError('');
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('admin_token');
    if (saved) { setToken(saved); loadSites(saved); }
  }, [loadSites]);

  async function handleLogin() {
    localStorage.setItem('admin_token', token);
    await loadSites(token);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/sites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (data.error) { setError(data.error); return; }
    setForm({ ...form, site_key: '', name: '' });
    loadSites(token);
  }

  const input: React.CSSProperties = { width: '100%', padding: 8, marginTop: 4, marginBottom: 12, border: '1px solid #ccc', borderRadius: 4, fontSize: 14, boxSizing: 'border-box' };
  const label: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: '#333' };

  if (!authed) {
    return (
      <main style={{ fontFamily: 'system-ui', maxWidth: 360, margin: '120px auto', padding: 24 }}>
        <h1 style={{ fontSize: 22 }}>Admin</h1>
        <label style={label}>Admin token</label>
        <input style={input} type="password" value={token} onChange={e => setToken(e.target.value)} />
        <button onClick={handleLogin} style={{ padding: '8px 16px', background: '#1D1D1D', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Entrar</button>
        {error && <p style={{ color: 'crimson', fontSize: 13 }}>{error}</p>}
      </main>
    );
  }

  return (
    <main style={{ fontFamily: 'system-ui', maxWidth: 760, margin: '40px auto', padding: 24 }}>
      <h1 style={{ fontSize: 24 }}>Sitios</h1>
      {error && <p style={{ color: 'crimson', fontSize: 13 }}>{error}</p>}

      {/* Existing sites */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 40 }}>
        {sites.length === 0 && <p style={{ color: '#888' }}>Aún no hay sitios.</p>}
        {sites.map(s => {
          const snippet = `<script src="${WIDGET_ORIGIN}/widget.js" data-site="${s.site_key}"></script>`;
          return (
            <div key={s.site_key} style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{s.name}</strong>
                <span style={{ fontSize: 12, color: '#888' }}>{s.site_key}</span>
              </div>
              <p style={{ fontSize: 12, color: '#555', margin: '8px 0 4px' }}>Snippet de integración:</p>
              <code style={{ display: 'block', background: '#f4f4f4', padding: 10, borderRadius: 4, fontSize: 12, wordBreak: 'break-all' }}>{snippet}</code>
              <button onClick={() => navigator.clipboard.writeText(snippet)}
                style={{ marginTop: 8, fontSize: 12, padding: '4px 10px', cursor: 'pointer', border: '1px solid #ccc', borderRadius: 4, background: '#fff' }}>
                Copiar snippet
              </button>
            </div>
          );
        })}
      </div>

      {/* Create new site */}
      <h2 style={{ fontSize: 18 }}>Nuevo sitio</h2>
      <form onSubmit={handleCreate}>
        <label style={label}>Site key (único, sin espacios)</label>
        <input style={input} value={form.site_key} onChange={e => setForm({ ...form, site_key: e.target.value })} required />

        <label style={label}>Nombre</label>
        <input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />

        <label style={label}>System prompt (quién es el negocio, servicios…)</label>
        <textarea style={{ ...input, minHeight: 100 }} value={form.system_prompt} onChange={e => setForm({ ...form, system_prompt: e.target.value })} />

        <label style={label}>Calendar ID (correo dueño del calendario)</label>
        <input style={input} value={form.calendar_id} onChange={e => setForm({ ...form, calendar_id: e.target.value })} />

        <label style={label}>Correo responsable (siempre invitado)</label>
        <input style={input} value={form.responsible_email} onChange={e => setForm({ ...form, responsible_email: e.target.value })} />

        <label style={label}>WhatsApp (solo dígitos, ej. 525668029233)</label>
        <input style={input} value={form.whatsapp_number} onChange={e => setForm({ ...form, whatsapp_number: e.target.value })} />

        <label style={label}>Color de acento</label>
        <input style={input} type="color" value={form.accent_color} onChange={e => setForm({ ...form, accent_color: e.target.value })} />

        <label style={label}>Dominio permitido (vacío = cualquiera)</label>
        <input style={input} value={form.allowed_domain} onChange={e => setForm({ ...form, allowed_domain: e.target.value })} placeholder="ejemplo.com" />

        <label style={label}>Mensaje de bienvenida</label>
        <input style={input} value={form.welcome_message} onChange={e => setForm({ ...form, welcome_message: e.target.value })} />

        <button type="submit" style={{ padding: '10px 20px', background: '#1D1D1D', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
          Crear sitio
        </button>
      </form>
    </main>
  );
}
