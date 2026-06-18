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
        body: JSON.stringify({ messages: updated }),
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
  }, [messages, loading, siteKey]);

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

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <p style={{ fontSize: 14, color: '#1D1D1D', lineHeight: 1.4 }}>
            {config?.welcome_message ?? 'Hola 👋 ¿En qué puedo ayudarte?'}
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
    </div>
  );
}
