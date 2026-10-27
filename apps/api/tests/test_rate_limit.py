import pytest
from httpx import ASGITransport, AsyncClient

from listing_validator_api.config import get_settings
from listing_validator_api.rate_limit import SlidingWindowLimiter, _LIMITS, _limiter


def test_sliding_window_blocks_after_limit():
    limiter = SlidingWindowLimiter()
    assert limiter.check("k", 2, 60)[0] is True
    assert limiter.check("k", 2, 60)[0] is True
    allowed, retry = limiter.check("k", 2, 60)
    assert allowed is False
    assert retry >= 1


@pytest.mark.asyncio
async def test_create_listing_rate_limit(monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    get_settings.cache_clear()
    _limiter._hits.clear()
    original = _LIMITS["POST /listings"]
    _LIMITS["POST /listings"] = (4, 60)  # anonymous callers get half => 2

    from listing_validator_api.db import init_db
    from listing_validator_api.main import create_app

    try:
        app = create_app()
        await init_db()
        transport = ASGITransport(app=app)
        payload = {"title": "Rate limit car", "description": "Enough text for validation."}
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            assert (await client.post("/listings", json=payload)).status_code == 201
            assert (await client.post("/listings", json=payload)).status_code == 201
            blocked = await client.post("/listings", json=payload)
            assert blocked.status_code == 429
            assert "Retry-After" in blocked.headers
    finally:
        _LIMITS["POST /listings"] = original
        _limiter._hits.clear()
        monkeypatch.delenv("RATE_LIMIT_ENABLED", raising=False)
        get_settings.cache_clear()
