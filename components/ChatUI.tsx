'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatAction, ChatMessage } from '@/lib/types';

interface PublicConfig {
  site_key: string;
  name: string;
  accent_color: string;
  welcome_message: string;
}

/**
 * Self-contained chat UI rendered inside the /embed iframe.
 * Talks to /api/chat?site=<key>. Notifies the parent window (the host page)
 * about open/close so the floating button can resize the iframe.
 */
export function ChatUI({ siteKey }: { siteKey: string }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<ChatAction | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const convIdRef = useRef<string>('');

  // Lead gate: visitors must leave name + email before they can chat.
  const [lead, setLead] = useState<{ name: string; email: string } | null>(null);
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadErr, setLeadErr] = useState('');
  const [leadSaving, setLeadSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`chat-widget:lead:${siteKey}`);
      if (raw) setLead(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, [siteKey]);

  // Stable per-tab conversation id so the backend can upsert one growing row.
  useEffect(() => {
    const key = `chat-widget:conv:${siteKey}`;
    let id = '';
    try {
      id = sessionStorage.getItem(key) ?? '';
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem(key, id);
      }
    } catch {
      id = `${siteKey}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    convIdRef.current = id;
  }, [siteKey]);

  useEffect(() => {
    fetch(`/api/sites/${siteKey}/config`)
      .then(r => r.json())
      .then(d => { if (!d.error) setConfig(d); })
      .catch(() => {});
  }, [siteKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, action, loading]);

  const accent = config?.accent_color ?? '#4A8F8A';

  const submitLead = useCallback(async () => {
    const name = leadName.trim();
    const email = leadEmail.trim();
    if (!name) { setLeadErr('Escribe tu nombre'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setLeadErr('Escribe un correo válido'); return; }
    setLeadErr('');
    setLeadSaving(true);
    try {
      const res = await fetch(`/api/lead?site=${siteKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setLeadErr(d.error || 'No se pudo guardar. Intenta de nuevo.');
        setLeadSaving(false);
        return;
      }
    } catch {
      setLeadErr('Error de conexión. Intenta de nuevo.');
      setLeadSaving(false);
      return;
    }
    const l = { name, email };
    try { sessionStorage.setItem(`chat-widget:lead:${siteKey}`, JSON.stringify(l)); } catch { /* ignore */ }
    setLead(l);
    setLeadSaving(false);
  }, [leadName, leadEmail, siteKey]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setAction(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/chat?site=${siteKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated, conversation_id: convIdRef.current, lead }),
      });
      const data = await res.json();
      if (data.text) setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
      if (data.action) setAction(data.action);
      if (data.error) setMessages(prev => [...prev, { role: 'assistant', content: data.error }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error. Intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, siteKey, lead]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', fontFamily: 'system-ui, sans-serif', background: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1D1D1D', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent }} />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{config?.name ?? 'Chat'}</span>
        </div>
        <button
          onClick={() => window.parent.postMessage({ type: 'chat-widget:close' }, '*')}
          style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Lead gate — must leave name + email before chatting */}
      {!lead ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 14, color: '#1D1D1D', lineHeight: 1.4, margin: 0 }}>
            {config?.welcome_message ?? 'Hola 👋 ¿En qué puedo ayudarte?'}
          </p>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.4, margin: 0 }}>
            Para empezar, déjanos tus datos:
          </p>
          <input
            value={leadName}
            onChange={e => setLeadName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitLead()}
            placeholder="Tu nombre"
            style={{ fontSize: 14, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, outline: 'none' }}
          />
          <input
            value={leadEmail}
            onChange={e => setLeadEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitLead()}
            placeholder="Tu correo"
            type="email"
            style={{ fontSize: 14, padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, outline: 'none' }}
          />
          {leadErr && <span style={{ fontSize: 12, color: '#e73f40' }}>{leadErr}</span>}
          <button
            onClick={submitLead}
            disabled={leadSaving}
            style={{ padding: '11px', background: accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: leadSaving ? 'default' : 'pointer', opacity: leadSaving ? 0.7 : 1 }}
          >
            {leadSaving ? 'Guardando…' : 'Comenzar'}
          </button>
          <span style={{ fontSize: 11, color: '#999', lineHeight: 1.3 }}>
            Usaremos tus datos para darte seguimiento.
          </span>
        </div>
      ) : (
      <>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 14, color: '#1D1D1D', lineHeight: 1.4 }}>
            ¡Hola {lead.name.split(' ')[0]}! ¿En qué puedo ayudarte?
          </p>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              style={{
                fontSize: 14, lineHeight: 1.4, padding: '8px 12px', maxWidth: '85%', borderRadius: 4,
                background: msg.role === 'user' ? accent : '#f4f4f4',
                color: msg.role === 'user' ? '#fff' : '#1D1D1D',
              }}
            >
              {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ fontSize: 14, color: '#888', padding: '8px 12px' }}>···</div>
        )}

        {action?.type === 'whatsapp' && !loading && (
          <a href={action.url} target="_blank" rel="noopener noreferrer"
             style={{ textAlign: 'center', background: '#25D366', color: '#fff', padding: '12px', textDecoration: 'none', fontSize: 14, borderRadius: 4 }}>
            Abrir WhatsApp
          </a>
        )}

        {action?.type === 'slots' && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {action.slots.map((slot, i) => (
              <button key={i} onClick={() => sendMessage(`Quiero el horario: ${slot.label}`)}
                style={{ textAlign: 'left', fontSize: 13, padding: '8px 12px', background: '#f0f7f6', border: `1px solid ${accent}`, borderRadius: 4, cursor: 'pointer', textTransform: 'capitalize' }}>
                {slot.label}
              </button>
            ))}
          </div>
        )}

        {action?.type === 'booked' && !loading && (
          <div style={{ background: '#f0f7f6', border: `1px solid ${accent}`, padding: '12px', borderRadius: 4 }}>
            <p style={{ fontSize: 14, fontWeight: 600, textTransform: 'capitalize' }}>✓ {action.label}</p>
            {action.meetLink && (
              <a href={action.meetLink} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: accent }}>
                Unirse a Google Meet
              </a>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', borderTop: '1px solid #e5e5e5', flexShrink: 0 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
          placeholder="Escribe tu mensaje..."
          style={{ flex: 1, fontSize: 14, padding: '12px', border: 'none', outline: 'none' }}
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          style={{ padding: '0 16px', background: '#1D1D1D', color: '#fff', border: 'none', fontSize: 16, cursor: 'pointer' }}>
          →
        </button>
      </div>
      </>
      )}
    </div>
  );
}
