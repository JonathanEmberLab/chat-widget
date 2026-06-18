export interface SiteConfig {
  site_key: string;
  name: string;
  system_prompt: string;
  /** Google Calendar ID where meetings are booked (e.g. owner email or 'primary'). */
  calendar_id: string;
  /** Fixed responsible email always invited to meetings. */
  responsible_email: string;
  /** WhatsApp number in international format, digits only (e.g. 525668029233). */
  whatsapp_number: string;
  /** Accent color for the widget UI. */
  accent_color: string;
  /** Domain allowed to embed this site (for CORS). Empty = any. */
  allowed_domain: string;
  /** Greeting shown when the chat opens. */
  welcome_message: string;
  created_at?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type ChatAction =
  | { type: 'whatsapp'; url: string }
  | { type: 'slots'; slots: { iso: string; label: string }[] }
  | { type: 'booked'; label: string; meetLink?: string; mock?: boolean };
