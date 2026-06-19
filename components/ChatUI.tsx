'use client';

import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import type { ChatAction, ChatMessage } from '@/lib/types';

interface PublicConfig {
  site_key: string;
  name: string;
  accent_color: string;
  welcome_message: string;
}

/**
 * Keyframes + hover/transition rules injected into the iframe document.
 * Inline styles can't express @keyframes or :hover, so we ship one <style>
 * block. Self-contained inside the iframe, so it never leaks to the host page.
 */
const WIDGET_CSS = `
@keyframes cw-msg-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes cw-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes cw-dot {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30%           { transform: translateY(-5px); opacity: 1; }
}
.cw-msg { animation: cw-msg-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
.cw-fade { animation: cw-fade-in 0.4s ease both; }
.cw-typing-dot {
  display: inline-block; width: 7px; height: 7px; border-radius: 50%;
  background: #9aa0a6; animation: cw-dot 1.2s infinite ease-in-out;
}
.cw-send-btn { transition: transform 0.15s ease, background 0.2s ease, opacity 0.2s ease; }
.cw-send-btn:not(:disabled):hover { background: #000; transform: scale(1.08); }
.cw-send-btn:not(:disabled):active { transform: scale(0.94); }
.cw-primary-btn { transition: transform 0.15s ease, filter 0.2s ease, opacity 0.2s ease; }
.cw-primary-btn:not(:disabled):hover { filter: brightness(1.08); transform: translateY(-1px); }
.cw-primary-btn:not(:disabled):active { transform: translateY(0); }
.cw-close-btn { transition: color 0.15s ease, transform 0.15s ease; }
.cw-close-btn:hover { color: #fff; transform: rotate(90deg); }
.cw-wa-btn { transition: transform 0.15s ease, filter 0.2s ease; }
.cw-wa-btn:hover { filter: brightness(1.06); transform: translateY(-1px); }
.cw-input { transition: border-color 0.2s ease, box-shadow 0.2s ease; }
`;

/** Three dots that bounce in sequence — the "typing…" indicator. */
function TypingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <span className="cw-typing-dot" style={{ animationDelay: '0s' }} />
      <span className="cw-typing-dot" style={{ animationDelay: '0.18s' }} />
      <span className="cw-typing-dot" style={{ animationDelay: '0.36s' }} />
    </span>
  );
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  // Auto-grow the textarea with its content, up to ~5 lines.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

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
      <style dangerouslySetInnerHTML={{ __html: WIDGET_CSS }} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#1D1D1D', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: accent, boxShadow: `0 0 0 0 ${accent}` }} />
          <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{config?.name ?? 'Chat'}</span>
        </div>
        <button
          onClick={() => window.parent.postMessage({ type: 'chat-widget:close' }, '*')}
          className="cw-close-btn"
          style={{ background: 'none', border: 'none', color: '#bbb', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      {/* Lead gate — must leave name + email before chatting */}
      {!lead ? (
        <div className="cw-fade" style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
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
            className="cw-primary-btn"
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
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div className="cw-msg" style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              fontSize: 14, lineHeight: 1.45, padding: '9px 13px', maxWidth: '85%',
              borderRadius: 16, borderBottomLeftRadius: 4,
              background: '#f1f2f4', color: '#1D1D1D',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)', wordBreak: 'break-word',
            }}>
              ¡Hola {lead.name.split(' ')[0]}! ¿En qué puedo ayudarte?
            </div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          return (
            <div key={i} className="cw-msg" style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <div
                style={{
                  fontSize: 14, lineHeight: 1.45, padding: '9px 13px', maxWidth: '85%',
                  borderRadius: 16,
                  borderBottomRightRadius: isUser ? 4 : 16,
                  borderBottomLeftRadius: isUser ? 16 : 4,
                  background: isUser ? accent : '#f1f2f4',
                  color: isUser ? '#fff' : '#1D1D1D',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  wordBreak: 'break-word',
                  whiteSpace: isUser ? 'pre-wrap' : 'normal',
                }}
              >
                {isUser ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="cw-msg" style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '11px 14px', background: '#f1f2f4', borderRadius: 16, borderBottomLeftRadius: 4,
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}>
              <TypingDots />
            </div>
          </div>
        )}

        {action?.type === 'whatsapp' && !loading && (
          <a href={action.url} target="_blank" rel="noopener noreferrer" className="cw-wa-btn cw-msg"
             style={{ textAlign: 'center', background: '#25D366', color: '#fff', padding: '12px', textDecoration: 'none', fontSize: 14, borderRadius: 10, fontWeight: 600 }}>
            Abrir WhatsApp
          </a>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, borderTop: '1px solid #e5e5e5', padding: '10px 12px', flexShrink: 0 }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage(input);
            }
          }}
          rows={1}
          placeholder="Escribe tu mensaje..."
          className="cw-input"
          style={{
            flex: 1, fontSize: 14, lineHeight: 1.4, padding: '10px 12px',
            border: '1px solid #e0e0e0', borderRadius: 18, outline: 'none',
            resize: 'none', maxHeight: 120, overflowY: 'auto',
            fontFamily: 'inherit',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = accent; e.currentTarget.style.boxShadow = `0 0 0 3px ${accent}22`; }}
          onBlur={e => { e.currentTarget.style.borderColor = '#e0e0e0'; e.currentTarget.style.boxShadow = 'none'; }}
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="cw-send-btn"
          style={{
            width: 40, height: 40, flexShrink: 0, borderRadius: '50%',
            background: input.trim() && !loading ? accent : '#1D1D1D',
            color: '#fff', border: 'none', fontSize: 18, cursor: loading || !input.trim() ? 'default' : 'pointer',
            opacity: loading || !input.trim() ? 0.45 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          →
        </button>
      </div>
      </>
      )}
    </div>
  );
}
