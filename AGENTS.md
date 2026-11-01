# SignalCheck — Agent Guide

This repo is a monorepo for **SignalCheck**: AI risk signals for user-submitted used-car listings (not title/history verification).

## Layout

| Path | Role |
|------|------|
| `apps/web` | Next.js App Router site (port **43123**) |
| `apps/api` | FastAPI analysis API (port **43124**) |
| `apps/mobile` | Expo client (optional) |
| `packages/types` | Shared TypeScript contracts |
| `packages/api-client` | Fetch client with optional bearer token |
| `scripts/` | Install/start helpers (`install.cmd`, `start.cmd`, `*.mjs`) |

Web browsers must call the API through the Next proxy **`/api/lv/*`** (see `apps/web/src/app/api/lv/[...path]/route.ts`). Do not point the browser at `127.0.0.1:43124` directly.

## Product invariants (do not break)

1. **History / title are never verified.** Reports always keep `historyChecked: false` and `titleVerified: false`, plus the disclaimer.
2. **User-assisted listing data.** Prefer paste URL / upload / manual entry. Do not make site-wide scraping the core architecture.
3. **Auth is optional locally.** When Supabase is unset, analysis can run anonymously. When configured, ownership is scoped by `user_id`.
4. **Risk signals ≠ certification.** UI copy must never claim Carfax, clean title, or authenticated ownership.

## Analysis pipeline (API)

On each submission: create listing → upload images → background `run_analysis_job` → `analyze_listing()`:

1. Local photo heuristics (Pillow): resolution, blanks, duplicates, EXIF drift, coverage
2. Regex seller claims (`no rust`, `like new`, …)
3. Price heuristic (`price < 1500` → high flag)
4. NHTSA VIN decode (vPIC) + recalls by Y/M/M; optional complaint hotspots when implemented
5. Optional VLM (`LLM_PROVIDER=gemini|ollama`) for photo↔text / claim / trim-color evidence
6. Score: `8 + Σ severity weights + VLM adjustment` (low 4 / med 12 / high 22), clamp 0–100

Default `LLM_PROVIDER=stub` skips the vision model.

## Web page map

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing (brand-first hero, demo, interactives) |
| `/check` | Listing **intake** (form + short live preview) |
| `/report/[id]` | Full **results** for one check |
| `/checks` | **My checks** list (saved listings) |
| `/listings` | Alias → `/checks` |
| `/about` | Product + honest limits |
| `/how-it-works` | Longer walkthrough |
| `/login`, `/settings`, `/auth/callback` | Supabase auth surfaces |

Shared chrome: `SiteHeader`, `SiteFooter`, `AppShell`, `PageHeader`. Report rendering: `ReportView`.

## Design rules for UI agents

- Preserve existing SignalCheck tokens (`--accent` teal, Fraunces display, DM Sans body). Avoid purple gradients, cream+serif “AI default,” or newspaper layouts.
- Landing hero: one composition, brand-first, full-bleed visual, no card grid in the hero.
- Prefer 2–3 intentional motions; respect `prefers-reduced-motion`.
- Cards only when they contain interaction; otherwise use borders/sections.

## Commands

```bash
# From repo root
pnpm install
pnpm setup:api          # or ./install.sh / install.cmd
pnpm start              # or ./start.sh / start.cmd
pnpm --filter web test  # Vitest
cd apps/api && uv run pytest -q
pnpm --filter web build
```

Ports: web `43123`, API `43124`.

## Env (high level)

- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (optional auth)
- API: `DATABASE_URL`, `LLM_PROVIDER`, `GEMINI_API_KEY` / Ollama settings, `SUPABASE_*`, `RATE_LIMIT_ENABLED`, `AUTH_REQUIRED`

See `.env.example` and `docs/` when present.

## Agent workflow

1. **Orient** — read this file + the touched app’s `AGENTS.md` (Next.js notes under `apps/web`).
2. **Branch** — `cursor/<short-name>-eae2` from the task base branch.
3. **Change the smallest surface** that satisfies the request; keep analysis truthfulness.
4. **Test** — API: `uv run pytest`; Web: `pnpm --filter web test` + `tsc`/`next build` when UI changes.
5. **Commit / push / PR** — descriptive commits; PR body lists user-visible behavior and test proof.
6. **Do not** invent title/history verification, hardcode secrets, or add exploit/scrape playbooks.

## Multi-site import strategy (when touching importers)

Prefer a **provider registry** + URL paste UX. Official APIs (e.g. eBay) > first-party HTML extractors > aggregators by VIN > paid scrape SaaS as escape hatch. Always keep manual paste fallback.

## When unsure

Prefer improving report clarity, intake UX, or tests over adding new auth or scrape surface area unless the user asked for those.
