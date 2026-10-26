import os
import tempfile
from pathlib import Path

_root = Path(tempfile.mkdtemp(prefix="signalcheck-test-"))
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_root / 'listings.db'}"
os.environ["LOCAL_UPLOAD_DIR"] = str(_root / "uploads")
os.environ["LLM_PROVIDER"] = "stub"
os.environ["JOB_BACKEND"] = "inprocess"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""

import pytest
from httpx import ASGITransport, AsyncClient


@pytest.fixture
async def client():
    from listing_validator_api.db import init_db
    from listing_validator_api.main import app

    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http
