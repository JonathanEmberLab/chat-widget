# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A **multi-tenant, embeddable AI chat widget** product. A single Next.js app that
serves three things:

1. **Backend API** — an AI chat (Claude) that answers questions about a business,
   books Google Calendar meetings, and generates WhatsApp contact links.
2. **Admin panel** — create/configure client "sites" and copy their embed snippet.
3. **Embeddable widget** — a `<script>` tag + iframe that drops the chat into ANY
   website (WordPress, Shopify, plain HTML, React, etc.).

It started as a POC inside the `pixeron-web` marketing site and was extracted here
to become a reusable product that can be embedded across many sites.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript 5**
- **@anthropic-ai/sdk** — Claude with **tool use** (the agentic loop lives in `app/api/chat/route.ts`)
- **googleapis** — Google Calendar (OAuth, impersonates the calendar owner)
- **@supabase/supabase-js** — per-site config + leads + conversations + bookings
- **react-markdown** — renders assistant messages
- No Tailwind. Styling is **inline styles** (keeps the iframe self-contained and
  avoids leaking/clashing CSS with host sites). Keep it that way.

Commands: `npm run dev` · `npm run build` · `npx tsc --noEmit` (typecheck; no test runner configured).

## Architecture

```
Host site ──<script src=widget.js data-site=KEY>──> floating button + iframe
                                                          │
                                              /embed?site=KEY  (app/embed/page.tsx → ChatUI)
                                                          │ fetch /api/chat?site=KEY
                                                          ▼
                              Claude (tool use)  +  Google Calendar  +  Supabase
```

- **One codebase, many tenants.** Each client = one row in the `sites` table.
  The `site_key` (from `data-site`) selects the config: system prompt, calendar,
  WhatsApp number, accent color, allowed domain, welcome message.
- **Secrets never reach the browser.** `ANTHROPIC_API_KEY` and Google creds live
  only in the backend. The widget/iframe only ever calls `/api/chat`. The public
  config endpoint (`/api/sites/[siteKey]/config`) exposes ONLY presentation fields
  (name, accent_color, welcome_message) — never prompts or keys.

## Key files

| File | Role |
|---|---|
| `app/api/chat/route.ts` | Multi-tenant chat. Loads site config, builds system prompt, runs the Claude tool-use loop (max 5 iterations), persists leads/bookings/conversations. CORS-aware. |
| `lib/google-calendar.ts` | `getAvailableSlots(calendarId)` + `createCalendarEvent(...)`. Falls back to mock slots if Google creds are missing. Uses `sendUpdates: 'all'` to email invites. |
| `lib/supabase.ts` | Server-only client (service role key) + helpers: getSiteConfig, listSites, createSite, saveLead, saveConversation, saveBooking, + knowledge (listKnowledge, addKnowledge, deleteKnowledge, getSiteKnowledge). |
| `lib/knowledge.ts` | Ingestion: normalizes any source to plain text. `extractFromUrl` (cheerio), `extractFromFile` (PDF via unpdf, DOCX via mammoth, TXT/MD/CSV). 100k-char cap per doc. |
| `app/api/sites/[siteKey]/knowledge/route.ts` | Admin KB API. GET list, POST (JSON for text/URL, multipart for file uploads). `[id]/route.ts` handles DELETE. Token-gated. |
| `components/admin/KnowledgeDrawer.tsx` | Admin UI to add text/FAQ, upload files, or scrape a URL per site, and list/delete docs. Opened from the 📖 button in `SitesView`. |
| `lib/cors.ts` | Per-site CORS headers (allowed_domain). |
| `lib/types.ts` | `SiteConfig`, `ChatMessage`, `ChatAction`, `KnowledgeDoc`. |
| `components/ChatUI.tsx` | The chat UI rendered inside the iframe. Config-driven. Posts `chat-widget:close` to the parent window. |
| `app/embed/page.tsx` | Iframe content; reads `?site=`. |
| `app/admin/page.tsx` | Admin panel (token-gated). Create sites, copy snippet. |
| `public/widget.js` | Vanilla JS loader. Injects button + iframe, derives backend origin from its own `src`. |
| `supabase/schema.sql` | Tables: sites, leads, conversations, bookings, knowledge. |

## Knowledge base (per-site RAG-lite)

Each site has a `knowledge` table (template/text/file/url docs, all normalized to
plain text/markdown). Clients add content from the admin (📖 button → KnowledgeDrawer):
fill a guided **template**, paste text/FAQ, upload PDF/DOCX/TXT/MD/CSV, or scrape a URL.

- **Templates** (`lib/knowledge-templates.ts`): guided forms (general, horarios,
  ubicacion, servicios, faq). The form's structured values are stored in `data` (jsonb)
  AND rendered to markdown `content`. `data` lets the form be re-opened/edited (PATCH);
  `content` is what the model reads and what the admin shows formatted (react-markdown).
  Rendering lives server-side (`renderTemplate`) so it's authoritative. To add a template:
  extend `TemplateId`, `TEMPLATE_META`, `emptyData`, `renderTemplate`, and add a form
  branch in `components/admin/KnowledgeTemplateForm.tsx`.

- **How it reaches Claude:** `app/api/chat/route.ts` loads `getSiteKnowledge(siteKey)`
  and injects it into the **system prompt**, split into two blocks:
  a **stable block** (persona + behavior + all KB docs) with `cache_control: ephemeral`,
  and a **dynamic block** (current date for scheduling) left uncached. This is
  injection-not-embeddings: simple + cheap thanks to prompt caching. Good up to
  ~100–150 pages per site; migrate to pgvector RAG only if a client outgrows that —
  the admin UI and `knowledge` table stay the same, only the chat-time read changes.
- **Ingestion caps:** 100k chars/doc (`lib/knowledge.ts`). File uploads go straight
  through the route handler, so they're bound by the platform body limit (~4.5 MB on
  Vercel serverless). For bigger files, route through Supabase Storage.

## Conventions & gotchas

- **Dates in scheduling:** Claude must NEVER invent dates. The system prompt injects
  the current date/time, and `book_meeting` must reuse the exact ISO string returned
  by `check_availability`. (This was a real bug — the model booked in the wrong year.)
- **Tool use loop:** the assistant may call tools (`check_availability`, `book_meeting`,
  `open_whatsapp`). The loop feeds `tool_result` back until `end_turn`. The chosen
  `ChatAction` is returned to the UI to render slots / WhatsApp button / confirmation.
- **Google OAuth:** uses a refresh token that impersonates the calendar OWNER. This
  is intentional (service accounts can't invite attendees without Workspace
  Domain-Wide Delegation). The owner becomes the event organizer; the visitor's email
  + `responsible_email` are attendees, both emailed via `sendUpdates: 'all'`.
- **"Invitation from an unknown sender"** in Gmail is expected when the organizer
  account isn't in the recipient's contacts — not a bug. Align the organizer with a
  business account to avoid it.
- **Model:** `claude-haiku-4-5` (fast + cheap for chat). Switch to `claude-sonnet-4-6`
  in `app/api/chat/route.ts` if responses feel too thin.
- **Admin auth is POC-level:** a shared `ADMIN_API_TOKEN` bearer. Replace before prod.

## Env vars

See `.env.example`. Required: `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN`,
`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_WIDGET_ORIGIN`,
`ADMIN_API_TOKEN`.

## Status

See `NEXT_STEPS.md` for what's done, what's pending, and the phased roadmap.
