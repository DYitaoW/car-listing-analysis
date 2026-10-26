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

### Prerequisites

- **Node.js 20+** and **pnpm** (`npm install -g pnpm`)
- **Python 3.12+** for the API ([python.org](https://www.python.org/downloads/))
- **`uv` is optional.** If it is missing, the repo falls back to `apps/api/requirements.txt` via pip.

### 1. Environment

```bash
cp .env.example .env
# Optional: add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# Create a public or authenticated bucket named listing-images in Supabase
```

On Windows Command Prompt:

```bat
copy .env.example .env
```

### 2. Install + run (recommended)

```bash
pnpm install
pnpm setup:api
pnpm dev
```

Windows Command Prompt:

```bat
scripts\setup-web.cmd
scripts\setup-api.cmd
pnpm dev
```

If `uv` / Node helpers are unavailable, install and run the API with pip only:

```bat
scripts\setup-api-pip.cmd
scripts\run-api-pip.cmd
```

`pnpm setup:api` / `scripts\setup-api.cmd` use `uv sync` when `uv` is installed; otherwise they create `apps/api/.venv` and install from `apps/api/requirements.txt`.

That starts the API on port 43124 and the web app on port 43123. The browser talks to `/api/lv` on the web origin, and the Next server proxies that to the API. Calling `127.0.0.1:43124` from the page fails with Firefox's `NetworkError when attempting to fetch resource` whenever the page is not served from that same machine.

Health: [http://127.0.0.1:43124/health](http://127.0.0.1:43124/health)

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

Web only:

```bash
pnpm dev:web
```

`LLM_PROVIDER=stub` still inspects uploaded photos and, when a VIN is present, calls NHTSA. Set `LLM_PROVIDER=gemini` (with `GEMINI_API_KEY`) or `LLM_PROVIDER=ollama` to compare photos with the description.

### API dependency files

| File | Use |
| --- | --- |
| `apps/api/requirements.txt` | `pip install -r requirements.txt` (no uv) |
| `apps/api/requirements-dev.txt` | Tests (`pytest`) |
| `apps/api/pyproject.toml` + `uv.lock` | `uv sync` when you have uv |

### 3. Mobile

```bash
pnpm --filter mobile add expo-image-picker   # if needed
pnpm dev:mobile
```

Point `EXPO_PUBLIC_API_URL`, or the API server field in the app, at your machine's LAN IP when using a physical device. `127.0.0.1` on a phone is the phone itself. Android emulator: `http://10.0.2.2:43124`.

## API surface (MVP)

- `POST /listings` — create listing metadata
- `POST /listings/{id}/images` — multipart upload; enqueues analysis
- `GET /listings/{id}` — status + report
- `POST /listings/{id}/analyze` — re-run analysis
- `GET /health`

## Supabase setup

1. Create a free Supabase project
2. Storage → New bucket `listing-images`
3. For local server uploads with the service role key, policies can stay locked down (service role bypasses RLS)
4. Set in `.env` / process env:

```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_STORAGE_BUCKET=listing-images
```

Without these vars, images are written under `apps/api/data/uploads`.

## Optional Docker services

```bash
docker compose up -d postgres redis
```

Then set `DATABASE_URL` to Postgres and `JOB_BACKEND=redis` if you run an ARQ worker.

## Product principles

- User-assisted ingestion only (no Marketplace crawlers)
- Risk score / flags / confidence — never “verified authentic”
- Badges: **History not checked**, **Title not verified**
