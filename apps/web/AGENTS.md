# SignalCheck Web (`apps/web`)

Next.js App Router UI for SignalCheck. Read the **repo root** [`AGENTS.md`](../../AGENTS.md) first for product invariants and the analysis pipeline.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Page framework

| Route | Component focus |
|-------|-----------------|
| `/` | Landing — brand hero, demo, `InteractiveDemoScore`, `SignalExplorer` |
| `/check` | Intake — `Checker` form + compact `ReportView` preview |
| `/report/[id]` | Results — full `ReportView` (`demo` id uses fixture) |
| `/checks` | My checks — `ChecksList` |
| `/listings` | Redirect → `/checks` |
| `/about`, `/how-it-works` | Marketing/explainer shells via `AppShell` + `PageHeader` |

Shared pieces live in `src/components/`. Pure report helpers live in `src/lib/report.ts`.

## API access from the browser

Always use `src/lib/api.ts` → `/api/lv` proxy. Never call the FastAPI origin from client code in production-like setups.

## Tests

```bash
pnpm --filter web test
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
```

Vitest covers pure helpers and fixtures under `src/**/*.test.ts`. Prefer adding tests next to changed `lib/` utilities.

## UI conventions for agents

1. Keep teal SignalCheck tokens; do not restyle to purple/cream “AI defaults.”
2. Landing hero stays one composition, brand-first, full-bleed visual.
3. Reuse `AppShell` / `PageHeader` / `ReportView` instead of duplicating chrome.
4. Every report surface must show History not checked / Title not verified.
5. After a real analysis completes, prefer navigating to `/report/[id]`.
