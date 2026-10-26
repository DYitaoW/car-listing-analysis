# Listing Validator API

FastAPI service for user-assisted vehicle listing risk analysis.

```bash
uv sync
uv run uvicorn listing_validator_api.main:app --reload --host 127.0.0.1 --port 43124
```

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to use Supabase Storage; otherwise images land in `./data/uploads`.
