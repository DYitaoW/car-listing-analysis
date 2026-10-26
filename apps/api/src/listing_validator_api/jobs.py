from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from listing_validator_api.analysis import analyze_listing
from listing_validator_api.config import get_settings
from listing_validator_api.db import SessionLocal
from listing_validator_api.models import Listing
from listing_validator_api.storage import get_storage
from listing_validator_api.vision import ImagePayload

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
        listing.error = None
        snapshot = {
            "title": listing.title,
            "description": listing.description,
            "price": listing.price,
            "vin": listing.vin,
        }
        image_rows = sorted(
            ((img.path, img.content_type, img.sort_order) for img in listing.images),
            key=lambda row: row[2],
        )
        await session.commit()

    images: list[ImagePayload] = []
    storage = get_storage()
    for path, content_type, _sort in image_rows:
        try:
            data = await storage.read(path)
        except Exception:
            logger.warning("Could not read image %s for listing %s", path, listing_id, exc_info=True)
            data = b""
        images.append(
            ImagePayload(
                data=data,
                content_type=content_type,
                filename=Path(path).name or "photo",
            )
        )

    report_json: str | None
    try:
        report = await analyze_listing(
            title=snapshot["title"],
            description=snapshot["description"],
            price=snapshot["price"],
            vin=snapshot["vin"],
            images=images,
        )
        status = "completed"
        error = None
        report_json = report.model_dump_json()
    except Exception as exc:
        logger.exception("Analysis failed for %s", listing_id)
        status = "failed"
        error = str(exc)
        report_json = None

    async with SessionLocal() as session:
        result = await session.execute(select(Listing).where(Listing.id == listing_id))
        listing = result.scalar_one_or_none()
        if listing is None:
            return
        listing.status = status
        listing.error = error
        if report_json is not None:
            listing.report_json = report_json
        await session.commit()


async def enqueue_redis(listing_id: str) -> None:
    settings = get_settings()
    try:
        from arq import create_pool
        from arq.connections import RedisSettings

        redis = await create_pool(RedisSettings.from_dsn(settings.redis_url))
        try:
            await redis.enqueue_job("analyze_listing", listing_id)
        finally:
            await redis.close()
    except Exception:
        logger.warning("Redis enqueue failed; running analysis in-process", exc_info=True)
        await run_analysis_job(listing_id)
