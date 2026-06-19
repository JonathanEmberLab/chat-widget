export interface SiteConfig {
  site_key: string;
  name: string;
  system_prompt: string;
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

export interface LeadAnalysis {
  /** 0–100 lead quality score. */
  score: number;
  temperatura: 'caliente' | 'tibio' | 'frio';
  resumen: string;
  intencion: string;
  interes: string[];
  accion_recomendada: string;
  sentimiento: 'positivo' | 'neutral' | 'negativo';
  objeciones: string[];
}

export interface Lead {
  id: number;
  site_key: string;
  name?: string | null;
  email?: string | null;
  source: 'chat' | 'booking' | 'whatsapp';
  created_at: string;
  updated_at?: string;
  /** AI lead scoring (derived from the conversation). */
  score?: number | null;
  temperatura?: 'caliente' | 'tibio' | 'frio' | null;
  resumen?: string | null;
  analysis?: LeadAnalysis | null;
  analyzed_at?: string | null;
}

export type KnowledgeSourceType = 'text' | 'file' | 'url' | 'template';

export interface KnowledgeDoc {
  id: number;
  site_key: string;
  source_type: KnowledgeSourceType;
  /** Human-friendly label shown in the admin (filename, page title, or a short heading). */
  title: string;
  /** Normalized plain text / markdown fed to the model. */
  content: string;
  /** Original URL when source_type === 'url'. */
  source_url?: string | null;
  /** Template id when source_type === 'template' (e.g. 'horarios'). */
  template?: string | null;
  /** Structured form values for templates — lets the form be re-opened and edited. */
  data?: Record<string, unknown> | null;
  /** Character count, for showing size in the admin. */
  chars: number;
  created_at: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Conversation {
  id: number;
  conversation_id?: string | null;
  site_key: string;
  email?: string | null;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

export type ChatAction =
  | { type: 'whatsapp'; url: string };
