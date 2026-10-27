from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request

from listing_validator_api.config import get_settings

# path prefix -> (max_requests, window_seconds)
_LIMITS: dict[str, tuple[int, int]] = {
    "POST /listings": (10, 60),
    "POST /listings/*/images": (20, 60),
    "POST /listings/*/analyze": (10, 60),
    "DELETE /me": (3, 3600),
}


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            cutoff = now - window_seconds
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= limit:
                retry = int(max(1, window_seconds - (now - bucket[0])))
                return False, retry
            bucket.append(now)
            return True, 0


_limiter = SlidingWindowLimiter()


def _pattern_for(method: str, path: str) -> str | None:
    normalized = path.rstrip("/") or "/"
    if method == "POST" and normalized == "/listings":
        return "POST /listings"
    if method == "DELETE" and normalized == "/me":
        return "DELETE /me"
    parts = normalized.split("/")
    if method == "POST" and len(parts) == 4 and parts[1] == "listings" and parts[3] == "images":
        return "POST /listings/*/images"
    if method == "POST" and len(parts) == 4 and parts[1] == "listings" and parts[3] == "analyze":
        return "POST /listings/*/analyze"
    return None


def client_key(request: Request, user_id: str | None = None) -> str:
    if user_id:
        return f"user:{user_id}"
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",")[0].strip() if forwarded else ""
    if not ip and request.client:
        ip = request.client.host
    return f"ip:{ip or 'unknown'}"


def enforce_rate_limit(request: Request, user_id: str | None = None) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return
    pattern = _pattern_for(request.method.upper(), request.url.path)
    if pattern is None:
        return
    base_limit, window = _LIMITS[pattern]
    # Slightly stricter for anonymous callers.
    limit = base_limit if user_id else max(1, base_limit // 2)
    key = f"{pattern}|{client_key(request, user_id)}"
    allowed, retry_after = _limiter.check(key, limit, window)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests. Try again in about {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )
