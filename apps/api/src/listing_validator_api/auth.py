from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated

import httpx
import jwt
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from listing_validator_api.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class AuthUser:
    id: str
    email: str | None = None


async def _user_from_jwt_secret(token: str, settings: Settings) -> AuthUser:
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired access token") from exc
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token is missing a user id")
    email = payload.get("email")
    return AuthUser(id=str(user_id), email=str(email) if email else None)


async def _user_from_supabase_api(token: str, settings: Settings) -> AuthUser:
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.supabase_anon_key or settings.supabase_service_role_key,
    }
    url = f"{settings.supabase_url.rstrip('/')}/auth/v1/user"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Could not reach Supabase Auth ({exc})") from exc
    if response.status_code == 401:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    if response.status_code >= 400:
        raise HTTPException(status_code=401, detail="Could not verify access token")
    body = response.json()
    user_id = body.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Supabase Auth returned no user id")
    email = body.get("email")
    return AuthUser(id=str(user_id), email=str(email) if email else None)


async def resolve_user(token: str, settings: Settings | None = None) -> AuthUser:
    cfg = settings or get_settings()
    if cfg.supabase_jwt_secret:
        return await _user_from_jwt_secret(token, cfg)
    if cfg.supabase_url and (cfg.supabase_anon_key or cfg.supabase_service_role_key):
        return await _user_from_supabase_api(token, cfg)
    raise HTTPException(status_code=503, detail="Authentication is not configured")


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Security(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthUser | None:
    """Require a user when auth is configured; otherwise allow anonymous local use."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        if settings.require_auth:
            raise HTTPException(status_code=401, detail="Sign in required")
        return None
    return await resolve_user(credentials.credentials, settings)


RequireUser = Annotated[AuthUser | None, Depends(get_current_user)]
