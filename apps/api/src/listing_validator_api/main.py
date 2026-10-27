from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from listing_validator_api.config import get_settings
from listing_validator_api.db import init_db
from listing_validator_api.routes import router as listings_router
from listing_validator_api.schemas import HealthOut


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await init_db()
    yield


# Browsers (Firefox in particular) surface a failed CORS check as
# "NetworkError when attempting to fetch resource". Credentials plus a
# mismatched or wildcard origin is a common way to trigger that, and this API
# does not use cookies.
_LOCAL_ORIGIN_REGEX = (
    r"https?://("
    r"localhost|127\.0\.0\.1|\[::1\]|"
    r"10(?:\.\d{1,3}){3}|"
    r"192\.168(?:\.\d{1,3}){2}|"
    r"172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}"
    r")(?::\d+)?$"
)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Listing Validator API",
        description="AI risk signals for user-submitted vehicle listings (not a title/history verification service).",
        version="0.1.0",
        lifespan=lifespan,
    )
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins or ["*"],
        allow_origin_regex=_LOCAL_ORIGIN_REGEX,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(listings_router)

    @app.get("/health", response_model=HealthOut)
    async def health() -> HealthOut:
        if settings.require_auth:
            auth_mode = "required"
        elif settings.auth_configured:
            auth_mode = "optional"
        else:
            auth_mode = "disabled"
        return HealthOut(
            status="ok",
            storage="supabase" if settings.supabase_configured else "local",
            llm_provider=settings.llm_provider,
            job_backend=settings.job_backend,
            auth=auth_mode,
        )

    return app


app = create_app()
