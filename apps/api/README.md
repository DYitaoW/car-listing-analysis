# Listing Validator API

FastAPI service for user-assisted vehicle listing risk analysis.

## Dependencies

Pinned installs live in:

| File | Purpose |
| --- | --- |
| `requirements.txt` | Runtime packages for `pip` (no `uv` required) |
| `requirements-dev.txt` | Pytest and related tools |
| `pyproject.toml` / `uv.lock` | Source of truth when using `uv` |

Regenerate the pip files after changing `pyproject.toml`:

```bash
uv lock
uv export --no-dev --no-emit-project --frozen --no-hashes -o requirements.txt
uv export --only-group dev --no-emit-project --frozen --no-hashes -o requirements-dev.txt
```

## Setup (Windows Command Prompt)

**Pip only** (no `uv`, no Node — use this if those tools are missing):

```bat
scripts\setup-api-pip.cmd
scripts\run-api-pip.cmd
```

**With Node/pnpm** (uses `uv` when available, otherwise `pip` + `requirements.txt`):

```bat
scripts\setup-api.cmd
scripts\run-api.cmd
```

Or:

```bat
pnpm setup:api
pnpm dev:api
```

## Setup (macOS / Linux / Git Bash)

**With uv (preferred):**

```bash
uv sync
uv run uvicorn listing_validator_api.main:app --reload --host 127.0.0.1 --port 43124
```

**Without uv (pip):**

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -e .
python -m uvicorn listing_validator_api.main:app --reload --host 127.0.0.1 --port 43124
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to use Supabase Storage; otherwise images land in `./data/uploads`.

Analysis always inspects the uploaded photos. `LLM_PROVIDER=gemini` or `ollama` adds a vision-model comparison of those photos to the listing text. VIN decode and recalls use NHTSA.
