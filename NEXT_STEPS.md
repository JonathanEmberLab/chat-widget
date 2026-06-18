# Next steps & roadmap

Status of the **chat-widget** project and what's left. Read `CLAUDE.md` first for
architecture.

---

## ✅ Done (scaffolded & typechecks clean)

- Multi-tenant chat API (`/api/chat?site=KEY`) with Claude tool use:
  - Answer questions (per-site system prompt)
  - Book Google Calendar meetings (`check_availability` + `book_meeting`)
  - WhatsApp contact links (`open_whatsapp`)
- Google Calendar integration: real slots, real events, Google Meet link,
  emails BOTH the visitor + a fixed `responsible_email` (`sendUpdates: 'all'`).
- Date bug fixed (injects current date, reuses exact ISO from availability).
- Supabase layer: config per site + captures leads, conversations, bookings.
- Admin panel (`/admin`, token-gated): create sites, copy embed snippet.
- Embeddable widget: `public/widget.js` + `/embed` iframe page.
- Per-site CORS, allowed-domain support.
- Docs: `README.md` (setup + integration), `CLAUDE.md` (architecture).

> Note: the code typechecks but has **not been run end-to-end yet** — needs env +
> Supabase project (see below).

---

## 🔧 To make it RUN (first session pickup)

1. **Supabase**
   - Create a project at supabase.com
   - SQL Editor → run `supabase/schema.sql`
   - Copy Project URL + `service_role` key
2. **Env** — `cp .env.example .env.local`, fill in:
   - `ANTHROPIC_API_KEY` (reuse from the pixeron-web POC)
   - `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` (reuse from the POC — already working)
   - `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_WIDGET_ORIGIN=http://localhost:3000`
   - `ADMIN_API_TOKEN=<pick one>`
3. `npm run dev` → open `/admin` → enter token → create a test site
4. Test embed: create a throwaway `test.html` with the snippet and open it, OR
   load `/embed?site=<key>` directly.
5. **Verify the full flow:** ask a question → ask to schedule → pick a slot →
   give name/email → confirm event lands in Google Calendar + invite emails arrive.

---

## 🚀 Roadmap (phased)

### Phase 1 — Validate locally (current)
Get it running end-to-end with one real site (e.g. Pixeron). Confirm chat, booking,
and lead capture all work against live Supabase + Google.

### Phase 2 — Deploy to production
- Deploy to Vercel; set all env vars in project settings.
- **Publish the Google OAuth consent screen** (in "Testing" the refresh token
  expires after 7 days — blocker for prod). Use "Internal" if on Google Workspace.
- Point `NEXT_PUBLIC_WIDGET_ORIGIN` to the prod URL.
- Embed on the first real site and validate cross-origin (CORS).

### Phase 3 — Harden
- **Rate limiting per site** (protect Claude costs / abuse). Vercel KV or Upstash
  Redis recommended — NOT Supabase for this.
- **Real admin auth** (replace the shared `ADMIN_API_TOKEN` — Supabase Auth or similar).
- **Per-site Google credentials** (today Google OAuth is global; each client should
  connect their own calendar via OAuth flow rather than sharing one refresh token).
- Edit/delete sites in the admin panel (today only create + list).
- Leads/conversations/bookings dashboard in the admin panel.

### Phase 4 — Distribution polish
- **`@chat-widget/react` npm package** — a native React component wrapper for
  React/Next clients (`<ChatWidget siteKey="..." />`) with props + callbacks
  (`onLeadCaptured`, `onMeetingBooked`). Shares the same backend; it's just a nicer
  shell than the iframe. (Optional — the script tag already works everywhere.)
- Optional: extract shared chat logic into a `core` package if the React package
  and iframe start diverging.

---

## ⚠️ Known limitations / decisions to revisit

- **Admin auth** is a single shared token (POC-level).
- **Google creds are global**, not per-site — fine for Pixeron-owned sites, but a
  real multi-client product needs per-site OAuth (each client connects their own
  Google Calendar).
- **No rate limiting yet** — public `/api/chat` could be abused.
- **Styling is inline** by design (iframe isolation). Don't introduce Tailwind into
  the widget/embed path.
- **"Unknown sender" email warning** — cosmetic; fix by using a recognizable
  organizer account (see CLAUDE.md).
- **Backend framework:** currently Next.js Route Handlers (chosen because we also
  want the admin panel). If it ever becomes API-only, Hono is a leaner alternative —
  but Next.js is the right call while the admin panel lives here.

---

## Origin / context

Extracted from the `pixeron-web` repo (`feature/chatbot-poc` branch), where the
original single-tenant POC still lives in `components/ChatWidget.tsx`,
`app/api/chat/route.ts`, and `lib/google-calendar.ts`. That POC works end-to-end
(chat + booking + emails verified). This project generalizes it to multi-tenant +
embeddable.
