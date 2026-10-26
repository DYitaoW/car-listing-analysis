from __future__ import annotations

import json

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from listing_validator_api.db import get_session
from listing_validator_api.jobs import enqueue_analysis
from listing_validator_api.models import Listing, ListingImage
from listing_validator_api.schemas import AnalysisReport, ListingCreate, ListingImageOut, ListingOut
from listing_validator_api.storage import get_storage

router = APIRouter(prefix="/listings", tags=["listings"])


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
    for index, upload in enumerate(files):
        data = await upload.read()
        if not data:
            continue
        content_type = upload.content_type or "application/octet-stream"
        path = await storage.upload(listing.id, upload.filename or "photo.jpg", data, content_type)
        listing.images.append(
            ListingImage(
                listing_id=listing.id,
                path=path,
                content_type=content_type,
                sort_order=start + index,
            )
        )

    listing.status = "pending"
    await session.commit()
    await session.refresh(listing)
    result = await session.execute(
        select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.images))
    )
    listing = result.scalar_one()
    enqueue_analysis(listing.id)
    return _to_out(listing)


@router.post("/{listing_id}/analyze", response_model=ListingOut)
async def trigger_analyze(
    listing_id: str,
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    result = await session.execute(
        select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.images))
    )
    listing = result.scalar_one_or_none()
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    enqueue_analysis(listing.id)
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
