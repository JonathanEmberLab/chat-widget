-- ─── Chat Widget — Supabase schema ───
-- Run this in the Supabase SQL editor.

-- Per-site configuration (multi-tenancy)
create table if not exists sites (
  site_key          text primary key,
  name              text not null,
  system_prompt     text not null default '',
  calendar_id       text not null default 'primary',
  responsible_email text not null default '',
  whatsapp_number   text not null default '',
  accent_color      text not null default '#4A8F8A',
  allowed_domain    text not null default '',
  welcome_message   text not null default 'Hola 👋 ¿En qué puedo ayudarte?',
  created_at        timestamptz not null default now()
);

-- Captured leads. ONE row per person (deduped by site_key + email).
-- `source` is the funnel STATUS / furthest action: chat < whatsapp < booking.
create table if not exists leads (
  id         bigint generated always as identity primary key,
  site_key   text not null references sites(site_key) on delete cascade,
  name       text,
  email      text,
  source     text not null check (source in ('chat', 'booking', 'whatsapp')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- AI lead scoring (filled from the conversation analysis)
  score        integer,
  temperatura  text,            -- 'caliente' | 'tibio' | 'frio'
  resumen      text,
  analysis     jsonb,           -- full structured analysis
  analyzed_at  timestamptz
);

-- Dedupe key (partial: legacy rows without email are allowed to coexist).
create unique index if not exists leads_site_email_idx on leads(site_key, email) where email is not null;

-- For an EXISTING leads table, run instead:
--   alter table leads add column if not exists updated_at timestamptz not null default now();
--   alter table leads add column if not exists score integer;
--   alter table leads add column if not exists temperatura text;
--   alter table leads add column if not exists resumen text;
--   alter table leads add column if not exists analysis jsonb;
--   alter table leads add column if not exists analyzed_at timestamptz;
--   create unique index if not exists leads_site_email_idx on leads(site_key, email) where email is not null;

-- Full conversation logs (for analytics / improving the bot).
-- One row PER conversation: the widget sends a stable conversation_id and the
-- backend upserts, so the row grows as the chat continues (no duplicate rows).
create table if not exists conversations (
  id              bigint generated always as identity primary key,
  conversation_id text,        -- stable id from the widget (sessionStorage); null for legacy rows
  site_key        text not null references sites(site_key) on delete cascade,
  email           text,        -- visitor email from the gate (links the chat to its lead)
  messages        jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists conversations_conv_id_idx on conversations(conversation_id);

-- For an EXISTING conversations table, run instead:
--   alter table conversations add column if not exists conversation_id text;
--   alter table conversations add column if not exists email text;
--   alter table conversations add column if not exists updated_at timestamptz not null default now();
--   create unique index if not exists conversations_conv_id_idx on conversations(conversation_id);

-- Confirmed bookings (backup of calendar events)
create table if not exists bookings (
  id         bigint generated always as identity primary key,
  site_key   text not null references sites(site_key) on delete cascade,
  name       text not null,
  email      text not null,
  datetime   timestamptz not null,
  meet_link  text,
  created_at timestamptz not null default now()
);

-- Per-site knowledge base (text/FAQ, uploaded files, scraped URLs).
-- All sources are normalized to plain text and injected into the chat system prompt.
create table if not exists knowledge (
  id          bigint generated always as identity primary key,
  site_key    text not null references sites(site_key) on delete cascade,
  source_type text not null check (source_type in ('text', 'file', 'url', 'template')),
  title       text not null,
  content     text not null,   -- rendered plain text / markdown fed to the model
  source_url  text,            -- original URL when source_type = 'url'
  template    text,            -- template id when source_type = 'template'
  data        jsonb,           -- structured form values for templates (re-editable)
  chars       integer not null default 0,
  created_at  timestamptz not null default now()
);

-- For an EXISTING knowledge table, run instead:
--   alter table knowledge add column if not exists template text;
--   alter table knowledge add column if not exists data jsonb;
--   alter table knowledge drop constraint if exists knowledge_source_type_check;
--   alter table knowledge add constraint knowledge_source_type_check
--     check (source_type in ('text', 'file', 'url', 'template'));

create index if not exists knowledge_site_idx on knowledge(site_key);

create index if not exists leads_site_idx on leads(site_key);
create index if not exists conversations_site_idx on conversations(site_key);
create index if not exists bookings_site_idx on bookings(site_key);

-- NOTE: All access goes through the server with the service_role key,
-- so Row Level Security is not required for this server-only setup.
-- If you ever query from the browser, enable RLS and add policies.
