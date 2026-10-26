from __future__ import annotations

import asyncio
import json
import logging

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from listing_validator_api.analysis import analyze_listing
from listing_validator_api.config import get_settings
from listing_validator_api.db import SessionLocal
from listing_validator_api.models import Listing

logger = logging.getLogger(__name__)


async def run_analysis_job(listing_id: str) -> None:
    async with SessionLocal() as session:
        result = await session.execute(
            select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.images))
        )
        listing = result.scalar_one_or_none()
        if listing is None:
            return

        listing.status = "processing"
        await session.commit()

        try:
            report = await analyze_listing(
                title=listing.title,
                description=listing.description,
                price=listing.price,
                vin=listing.vin,
                image_paths=[img.path for img in listing.images],
            )
            listing.report_json = report.model_dump_json()
            listing.status = "completed"
            listing.error = None
        except Exception as exc:
            logger.exception("Analysis failed for %s", listing_id)
            listing.status = "failed"
            listing.error = str(exc)
        await session.commit()


def enqueue_analysis(listing_id: str) -> None:
    settings = get_settings()
    if settings.job_backend == "redis":
        # ARQ worker hook — run `arq listing_validator_api.worker.WorkerSettings`
        try:
            from arq import create_pool
            from arq.connections import RedisSettings

            async def _enqueue() -> None:
                redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
                await redis.enqueue_job("analyze_listing", listing_id)
                await redis.close()

            asyncio.create_task(_enqueue())
            return
        except Exception:
            logger.warning("Redis enqueue failed; falling back to in-process job", exc_info=True)

    asyncio.create_task(run_analysis_job(listing_id))
