# Chat Widget

Multi-tenant embeddable AI chat widget. One backend + admin panel serves an AI
chat (Claude) that answers questions, books Google Calendar meetings, and links
to WhatsApp — embeddable on **any** site with a single `<script>` tag.

## What's inside

| Pieza | Ruta |
|---|---|
| **Backend / API** | `app/api/chat` (multi-tenant), `app/api/sites` (admin CRUD) |
| **Panel admin** | `app/admin` — crear sitios, copiar snippet |
| **Widget (iframe)** | `public/widget.js` + `app/embed` |
| **Datos** | Supabase (`supabase/schema.sql`) |

## Arquitectura

```
Sitio del cliente ──<script>──> widget.js ──iframe──> /embed?site=KEY
                                                          │ fetch
                                                          ▼
                                            /api/chat?site=KEY
                                                          │
                              Claude  +  Google Calendar  +  Supabase
```

Una sola base de código. Cada sitio = una fila en la tabla `sites`. Las llaves
(Anthropic, Google) viven solo en el backend; el widget nunca las ve.

## Setup

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Supabase**
   - Crea un proyecto en supabase.com
   - SQL Editor → pega y corre `supabase/schema.sql`
   - Copia el Project URL y el `service_role` key

3. **Google Calendar (OAuth)**
   - Google Cloud Console → habilita Calendar API
   - Crea un OAuth Client (Web application) con redirect URI
     `https://developers.google.com/oauthplayground`
   - En OAuth Playground (con "Use your own credentials") autoriza el scope
     `https://www.googleapis.com/auth/calendar` con la cuenta dueña del calendario
   - Obtén el refresh token

4. **Variables de entorno** — copia `.env.example` a `.env.local` y llena los valores.

5. **Correr**
   ```bash
   npm run dev
   ```

## Crear un sitio

1. Entra a `/admin` y usa tu `ADMIN_API_TOKEN`
2. Llena el formulario "Nuevo sitio" (nombre, system prompt, calendario, WhatsApp, color…)
3. Copia el snippet generado

## Integración en cualquier sitio

Pega esto antes de `</body>`:

```html
<script src="https://TU-DOMINIO/widget.js" data-site="TU-SITE-KEY"></script>
```

Atributos opcionales:
- `data-accent="#FF0000"` — color del botón flotante

### Sitios React / Next.js

Mismo snippet, dentro de un componente con el `<Script>` de Next o un `useEffect`
que inyecte el tag. (Un paquete npm `@chat-widget/react` es una mejora futura;
hoy el script funciona en cualquier framework.)

## Costos

- Google Calendar API: gratis
- Supabase: plan free suficiente
- Claude (Haiku 4.5): ~$0.01–0.02 USD por conversación

## Pendientes para producción

- [ ] Publicar la pantalla de consentimiento OAuth (en "Testing" el refresh token expira a 7 días)
- [ ] Rate limiting por sitio (control de abuso/costos)
- [ ] Auth real en el panel admin (hoy es un token compartido)
- [ ] Credenciales de Google por-sitio (hoy son globales)
