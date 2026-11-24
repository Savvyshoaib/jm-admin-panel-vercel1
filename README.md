# Joseph Mews Admin Panel

Internal admin frontend for **Joseph Mews** — investor operations, properties, developments, enquiries, payments, and content.

Built as a Vite + React SPA with Joseph Mews brand guidelines (logo, New Spirit / Sharp Sans, palette `#FCC11D`, `#1D1D1F`, `#FFF5E9`, `#FFFFFF`).

> Data layer runs in **mock mode** (`USE_MOCK_DATA = true` in `src/services/mockFlags.ts`). Screens use localStorage-backed mock stores — no live API calls. Set `USE_MOCK_DATA` to `false` when re-wiring real endpoints.

## Stack

- **React 19** + **TypeScript** + **Vite 7**
- **Redux Toolkit** + **react-redux** (auth store; feature slices added as APIs land)
- **Tailwind CSS 4** + shadcn/Radix UI primitives
- **wouter** for routing
- **react-hook-form** + **zod** for forms
- **recharts** for dashboard charts
- **sonner** for toasts

## Getting started

```bash
npm install
cp .env.example .env.local   # set VITE_API_BASE_URL
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

**API / CORS (local):**

| `VITE_USE_API_PROXY` | Behaviour |
| --- | --- |
| `true` | Browser hits same-origin `/admin` + `/storage`; Vite proxies to `VITE_API_BASE_URL` (no CORS needed). |
| `false` | Browser calls `VITE_API_BASE_URL` directly; backend must allow `http://localhost:5173` in CORS. |

Restart `npm run dev` after changing the flag.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start local dev server |
| `npm run build` | Typecheck + production build → `dist/` |
| `npm run preview` | Preview the production build |
| `npm run check` | TypeScript only (`tsc --noEmit`) |

## Auth

- `/login` — `POST /admin/auth/login`
- `/forgot-password` — `POST /admin/auth/forgot-password`
- `/forgot-password` — reset request (pending real endpoint)
- `/reset-password` — new password UI (pending real endpoint)

Session is stored in Redux (`auth` slice) and persisted under `jm-admin-session`.

Roles (`super_admin`, `agent`, `viewer`) still gate nav/actions via `src/permissions/can.ts` once a real user is returned from login.

## Features / routes

| Area | Path |
| --- | --- |
| Dashboard | `/` |
| Investors | `/investors`, `/investors/new`, `/investors/invite`, `/investors/:id` |
| Properties | `/properties`, `/properties/new`, `/properties/:id` |
| Developments | `/developments`, `/developments/new`, `/developments/:id` |
| Enquiries | `/enquiries` |
| Intent signals | `/signals` |
| Payments | `/payments` |
| Calculations & assumptions | `/assumptions` |
| Content | `/content` |
| Users & roles | `/users` |
| Activity log | `/activity` |
| Settings | `/settings` |

List screens show empty states until each API is wired in `src/services/api.ts`. Mutations throw a clear “not wired” error until connected.

## Project structure

```
assets/                 Brand fonts + logos
src/
  components/
    admin/              Shell, tables, headers, auth layout
    ui/                 Shared primitives (Button, Select, …)
  contexts/             Auth helpers (wraps Redux auth)
  lib/
    apiClient.ts        Fetch wrapper + ApiError
    ids.ts              Client-side temp ids
  models/               Domain types
  pages/                Route screens
  permissions/          Role checks
  services/api.ts       Domain API functions (wire real endpoints here)
  store/                Redux Toolkit store + slices
```

## API integration (next steps)

1. Set `VITE_API_BASE_URL` in `.env`
2. Share endpoint contracts one by one (method, path, request/response, auth)
3. Implement each function in `src/services/api.ts` (and auth thunks as needed)
4. Add Redux slices for server state where caching/shared state helps

Until then: no dummy/seed data is loaded, so real responses will not conflict with leftovers.

## Branding

Official Joseph Mews assets live under `assets/`:

- Fonts: New Spirit Semibold Condensed, Sharp Sans (Book / Bold + italics)
- Logos: white, black, and yellow wordmarks
- Theme tokens: `src/index.css`

Login uses the yellow wordmark; the admin sidebar uses the white wordmark (collapses to **J** when the sidebar is closed).

## Deploy

Configured for Vercel (`vercel.json`): build with `npm run build`, serve `dist/`, SPA rewrite to `index.html`.

## License

MIT
"# jm-admin-panel-vercel1" 
