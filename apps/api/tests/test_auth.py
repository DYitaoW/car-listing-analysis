import jwt
import pytest
from httpx import ASGITransport, AsyncClient
from listing_validator_api.config import get_settings


JWT_SECRET = "test-jwt-secret-at-least-32-chars!!"


@pytest.fixture
async def auth_client(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon-test-key")
    monkeypatch.setenv("SUPABASE_JWT_SECRET", JWT_SECRET)
    monkeypatch.setenv("AUTH_REQUIRED", "true")
    get_settings.cache_clear()

    from listing_validator_api.db import init_db
    from listing_validator_api.main import create_app

    app = create_app()
    await init_db()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as http:
        yield http

    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.delenv("AUTH_REQUIRED", raising=False)
    get_settings.cache_clear()


def _token(sub: str = "user-123", email: str = "buyer@example.com") -> str:
    return jwt.encode(
        {"sub": sub, "email": email, "aud": "authenticated", "role": "authenticated"},
        JWT_SECRET,
        algorithm="HS256",
    )


@pytest.mark.asyncio
async def test_auth_required_blocks_anonymous(auth_client):
    response = await auth_client.post(
        "/listings",
        json={"title": "Car", "description": "Nice car with photos pending."},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_signed_in_user_owns_listings(auth_client):
    headers = {"Authorization": f"Bearer {_token('user-a', 'a@example.com')}"}
    created = await auth_client.post(
        "/listings",
        headers=headers,
        json={"title": "2018 Civic", "description": "Garage kept, no rust."},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["userId"] == "user-a"

    mine = await auth_client.get("/listings", headers=headers)
    assert mine.status_code == 200
    assert len(mine.json()) == 1
    assert mine.json()[0]["title"] == "2018 Civic"

    other = await auth_client.get(
        "/listings",
        headers={"Authorization": f"Bearer {_token('user-b', 'b@example.com')}"},
    )
    assert other.status_code == 200
    assert other.json() == []

    hidden = await auth_client.get(
        f"/listings/{body['id']}",
        headers={"Authorization": f"Bearer {_token('user-b', 'b@example.com')}"},
    )
    assert hidden.status_code == 404

    me = await auth_client.get("/me", headers=headers)
    assert me.status_code == 200
    assert me.json() == {
        "id": "user-a",
        "email": "a@example.com",
        "authRequired": True,
    }

    health = await auth_client.get("/health")
    assert health.json()["auth"] == "required"
