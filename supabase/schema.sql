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

-- Captured leads (anyone who books or requests contact)
create table if not exists leads (
  id         bigint generated always as identity primary key,
  site_key   text not null references sites(site_key) on delete cascade,
  name       text,
  email      text,
  source     text not null check (source in ('chat', 'booking', 'whatsapp')),
  created_at timestamptz not null default now()
);

-- Full conversation logs (for analytics / improving the bot)
create table if not exists conversations (
  id         bigint generated always as identity primary key,
  site_key   text not null references sites(site_key) on delete cascade,
  messages   jsonb not null,
  created_at timestamptz not null default now()
);

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

create index if not exists leads_site_idx on leads(site_key);
create index if not exists conversations_site_idx on conversations(site_key);
create index if not exists bookings_site_idx on bookings(site_key);

-- NOTE: All access goes through the server with the service_role key,
-- so Row Level Security is not required for this server-only setup.
-- If you ever query from the browser, enable RLS and add policies.
