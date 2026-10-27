# SignalCheck — Vehicle Listing Validator

Open-source-first scaffold for an AI **risk-signal** checker on user-submitted vehicle listings (photos + description + optional VIN). Companion **Next.js** web app and **Expo** mobile app share one TypeScript API contract.

This is **not** a Carfax substitute and does **not** verify titles. Reports always disclose that history/title were not checked.

## Stack

| Layer | Choice |
| --- | --- |
| Web | Next.js + Tailwind (`apps/web`) |
| Mobile | Expo React Native (`apps/mobile`) |
| API | FastAPI + SQLAlchemy (`apps/api`) |
| Shared types | `packages/types`, `packages/api-client` |
| Object storage | **Supabase Storage** (preferred) or local disk stub |
| Jobs | In-process asyncio (default) or Redis + ARQ |
| VIN / recalls | NHTSA vPIC + NHTSA Recalls (free) |
| Vision LLM | Local photo inspection always · `stub` (default) · Gemini · Ollama |

### Why Supabase (not Firebase) for storage

- Open-source Postgres ecosystem; S3-compatible Storage API
- Fits FastAPI + Expo without committing the whole app to Google proprietary SDKs
- Real free tier without requiring Blaze billing for basic Storage experiments
- Same project can host Auth later with RLS on uploads

Firebase is stronger for offline-first Google-native mobile sync — skip it unless that is your primary constraint.

## Monorepo layout

```
apps/api      FastAPI analysis service
apps/web      Next.js UI
apps/mobile   Expo companion
packages/types
packages/api-client
docker-compose.yml   Postgres + Redis (optional)
```

## Quick start

### Prerequisites (once)

- **Node.js 20+** from [nodejs.org](https://nodejs.org/)
- **Python 3.12+** from [python.org](https://www.python.org/downloads/) (on Windows, check **Add python.exe to PATH**)

`uv` and global `pnpm` are optional — the install scripts handle them.

### Windows (simplest)

In File Explorer, open the project folder, then double-click:

1. **`install.cmd`** — installs everything (first time only)
2. **`start.cmd`** — starts the API + website and opens the browser

Or in Command Prompt from the project folder:

```bat
install.cmd
start.cmd
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123) if the browser does not open.

### macOS / Linux / Git Bash

```bash
./install.sh
./start.sh
```

Or:

```bash
pnpm install:app
pnpm start
```

### What you get

- Web: [http://127.0.0.1:43123](http://127.0.0.1:43123) (landing page + `/check`)
- API: [http://127.0.0.1:43124/health](http://127.0.0.1:43124/health)

The browser talks to `/api/lv` on the web origin; the Next server proxies that to the API.

`LLM_PROVIDER=stub` still inspects uploaded photos and, when a VIN is present, calls NHTSA. Set `LLM_PROVIDER=gemini` (with `GEMINI_API_KEY`) or `LLM_PROVIDER=ollama` to compare photos with the description.

Copy `.env.example` to `.env` for optional Supabase / Gemini keys (`install.cmd` / `install.sh` do this automatically).

### API dependency files

| File | Use |
| --- | --- |
| `apps/api/requirements.txt` | `pip install -r requirements.txt` (no uv) |
| `apps/api/requirements-dev.txt` | Tests (`pytest`) |
| `apps/api/pyproject.toml` + `uv.lock` | `uv sync` when you have uv |

### Mobile

```bash
pnpm --filter mobile add expo-image-picker   # if needed
pnpm dev:mobile
```

Point `EXPO_PUBLIC_API_URL`, or the API server field in the app, at your machine's LAN IP when using a physical device. `127.0.0.1` on a phone is the phone itself. Android emulator: `http://10.0.2.2:43124`.

## API surface (MVP)

- `GET /me` — current user (requires Bearer token when auth is on)
- `GET /listings` — listings owned by the signed-in user
- `POST /listings` — create listing metadata
- `POST /listings/{id}/images` — multipart upload; enqueues analysis
- `GET /listings/{id}` — status + report
- `POST /listings/{id}/analyze` — re-run analysis
- `GET /health`

## Supabase setup (Storage + Auth + Google)

1. Create a free Supabase project
2. **Storage** → New bucket `listing-images` (service role uploads can keep RLS locked down)
3. **Authentication → Providers**
   - Enable **Email**
   - Enable **Google**, paste your Google OAuth Client ID and Secret from Google Cloud Console
4. **Authentication → URL configuration**
   - Site URL: `http://127.0.0.1:43123`
   - Redirect URLs: `http://127.0.0.1:43123/auth/callback` (and your production URL when you deploy)
5. Copy keys into `.env`:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_JWT_SECRET=your-jwt-secret
SUPABASE_STORAGE_BUCKET=listing-images
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
AUTH_REQUIRED=true
```

Without Supabase Auth vars, the site still works anonymously and images land under `apps/api/data/uploads`.

With Auth configured, `/check` requires sign-in and listings are saved under **My listings**.

## Optional Docker services

```bash
docker compose up -d postgres redis
```

Then set `DATABASE_URL` to Postgres and `JOB_BACKEND=redis` if you run an ARQ worker.

## Product principles

- User-assisted ingestion only (no Marketplace crawlers)
- Risk score / flags / confidence — never “verified authentic”
- Badges: **History not checked**, **Title not verified**
