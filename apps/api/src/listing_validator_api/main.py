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
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(listings_router)

    @app.get("/health", response_model=HealthOut)
    async def health() -> HealthOut:
        return HealthOut(
            status="ok",
            storage="supabase" if settings.supabase_configured else "local",
            llm_provider=settings.llm_provider,
            job_backend=settings.job_backend,
        )

    return app


app = create_app()
