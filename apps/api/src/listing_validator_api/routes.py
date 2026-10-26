from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from listing_validator_api.config import get_settings
from listing_validator_api.db import get_session
from listing_validator_api.jobs import enqueue_redis, run_analysis_job
from listing_validator_api.models import Listing, ListingImage
from listing_validator_api.schemas import AnalysisReport, ListingCreate, ListingImageOut, ListingOut
from listing_validator_api.storage import get_storage

router = APIRouter(prefix="/listings", tags=["listings"])
_MAX_IMAGE_BYTES = 15 * 1024 * 1024


def _schedule(background: BackgroundTasks, listing_id: str) -> None:
    if get_settings().job_backend == "redis":
        background.add_task(enqueue_redis, listing_id)
    else:
        background.add_task(run_analysis_job, listing_id)


def _to_out(listing: Listing) -> ListingOut:
    report = None
    if listing.report_json:
        report = AnalysisReport.model_validate(json.loads(listing.report_json))
    return ListingOut(
        id=listing.id,
        title=listing.title,
        price=listing.price,
        description=listing.description,
        vin=listing.vin,
        source_url=listing.source_url,
        status=listing.status,  # type: ignore[arg-type]
        error=listing.error,
        images=[
            ListingImageOut(id=img.id, path=img.path, content_type=img.content_type)
            for img in sorted(listing.images, key=lambda i: i.sort_order)
        ],
        report=report,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


@router.post("", response_model=ListingOut, status_code=201)
async def create_listing(
    payload: ListingCreate,
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    listing = Listing(
        title=payload.title.strip(),
        description=payload.description.strip(),
        price=payload.price,
        vin=(payload.vin or None),
        source_url=str(payload.source_url) if payload.source_url else None,
        status="pending",
    )
    if listing.vin:
        listing.vin = listing.vin.strip().upper()
    session.add(listing)
    await session.commit()
    await session.refresh(listing, attribute_names=["images"])
    return _to_out(listing)


@router.post("/{listing_id}/images", response_model=ListingOut)
async def upload_images(
    listing_id: str,
    background: BackgroundTasks,
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    result = await session.execute(
        select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.images))
    )
    listing = result.scalar_one_or_none()
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not files:
        raise HTTPException(status_code=400, detail="At least one image is required")

    storage = get_storage()
    start = len(listing.images)
    stored = 0
    for upload in files:
        data = await upload.read()
        if not data:
            continue
        if len(data) > _MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Each photo must be under 15 MB")
        content_type = upload.content_type or "application/octet-stream"
        path = await storage.upload(listing.id, upload.filename or "photo.jpg", data, content_type)
        listing.images.append(
            ListingImage(
                listing_id=listing.id,
                path=path,
                content_type=content_type,
                sort_order=start + stored,
            )
        )
        stored += 1
    if stored == 0:
        raise HTTPException(status_code=400, detail="At least one non-empty image is required")

    listing.status = "pending"
    listing.error = None
    await session.commit()
    result = await session.execute(
        select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.images))
    )
    listing = result.scalar_one()
    _schedule(background, listing.id)
    return _to_out(listing)


@router.post("/{listing_id}/analyze", response_model=ListingOut)
async def trigger_analyze(
    listing_id: str,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    result = await session.execute(
        select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.images))
    )
    listing = result.scalar_one_or_none()
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    _schedule(background, listing.id)
    return _to_out(listing)


@router.get("/{listing_id}", response_model=ListingOut)
async def get_listing(
    listing_id: str,
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    result = await session.execute(
        select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.images))
    )
    listing = result.scalar_one_or_none()
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    return _to_out(listing)
