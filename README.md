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
| Vision LLM | `stub` (default) · Gemini · Ollama (pluggable) |

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

### 1. Environment

```bash
cp .env.example .env
# Optional: add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
# Create a public or authenticated bucket named listing-images in Supabase
```

### 2. API

```bash
cd apps/api
uv sync
uv run uvicorn listing_validator_api.main:app --reload --host 127.0.0.1 --port 43124
```

Health: [http://127.0.0.1:43124/health](http://127.0.0.1:43124/health)

### 3. Web

```bash
pnpm install
pnpm dev:web
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

### 4. Mobile

```bash
pnpm --filter mobile add expo-image-picker   # if needed
pnpm dev:mobile
```

Point `EXPO_PUBLIC_API_URL` at your machine LAN IP when using a physical device.

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
