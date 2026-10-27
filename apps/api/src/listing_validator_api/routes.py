from __future__ import annotations

import json

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from listing_validator_api.auth import AuthUser, RequireUser
from listing_validator_api.config import get_settings
from listing_validator_api.db import get_session
from listing_validator_api.jobs import enqueue_redis, run_analysis_job
from listing_validator_api.models import Listing, ListingImage
from listing_validator_api.marketplace import (
    MarketplaceImportError,
    download_allowed_images,
    fetch_marketplace_listing,
)
from listing_validator_api.rate_limit import enforce_rate_limit
from listing_validator_api.schemas import (
    AnalysisReport,
    ImageUrlsIn,
    ListingCreate,
    ListingImageOut,
    ListingOut,
    ListingSummaryOut,
    MarketplaceImportOut,
    MarketplaceImportRequest,
    MeOut,
)
from listing_validator_api.storage import get_storage

router = APIRouter(tags=["listings"])
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
        user_id=listing.user_id,
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


def _to_summary(listing: Listing) -> ListingSummaryOut:
    risk_score = None
    if listing.report_json:
        try:
            risk_score = AnalysisReport.model_validate(json.loads(listing.report_json)).risk_score
        except Exception:
            risk_score = None
    return ListingSummaryOut(
        id=listing.id,
        title=listing.title,
        price=listing.price,
        status=listing.status,  # type: ignore[arg-type]
        risk_score=risk_score,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
    )


async def _owned_listing(
    session: AsyncSession,
    listing_id: str,
    user: AuthUser | None,
) -> Listing:
    result = await session.execute(
        select(Listing).where(Listing.id == listing_id).options(selectinload(Listing.images))
    )
    listing = result.scalar_one_or_none()
    if listing is None:
        raise HTTPException(status_code=404, detail="Listing not found")
    if user is None:
        return listing
    if listing.user_id != user.id:
        # Hide both other users' listings and legacy anonymous rows from signed-in users.
        raise HTTPException(status_code=404, detail="Listing not found")
    return listing


@router.post("/import/marketplace", response_model=MarketplaceImportOut)
async def import_marketplace(
    request: Request,
    payload: MarketplaceImportRequest,
    user: RequireUser,
) -> MarketplaceImportOut:
    enforce_rate_limit(request, user.id if user else None)
    try:
        draft = await fetch_marketplace_listing(payload.url)
    except MarketplaceImportError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc
    return MarketplaceImportOut(
        source_url=draft.source_url,
        title=draft.title,
        description=draft.description,
        price=draft.price,
        vin=draft.vin,
        image_urls=draft.image_urls,
        warnings=draft.warnings,
        partial=draft.partial,
    )


@router.get("/me", response_model=MeOut)
async def me(user: RequireUser) -> MeOut:
    settings = get_settings()
    if user is None:
        return MeOut(id="anonymous", email=None, auth_required=settings.require_auth)
    return MeOut(id=user.id, email=user.email, auth_required=settings.require_auth)


@router.delete("/me", status_code=204)
async def delete_account(
    request: Request,
    user: RequireUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in required")
    enforce_rate_limit(request, user.id)
    settings = get_settings()
    await session.execute(delete(Listing).where(Listing.user_id == user.id))
    await session.commit()

    if settings.supabase_url and settings.supabase_service_role_key:
        import httpx

        url = f"{settings.supabase_url.rstrip('/')}/auth/v1/admin/users/{user.id}"
        headers = {
            "apikey": settings.supabase_service_role_key,
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
        }
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.delete(url, headers=headers)
        if response.status_code >= 400 and response.status_code != 404:
            raise HTTPException(
                status_code=502,
                detail=f"Listings were deleted, but Supabase could not remove the auth user ({response.status_code}).",
            )


@router.get("/listings", response_model=list[ListingSummaryOut])
async def list_listings(
    user: RequireUser,
    session: AsyncSession = Depends(get_session),
) -> list[ListingSummaryOut]:
    query = select(Listing).order_by(Listing.created_at.desc())
    if user is not None:
        query = query.where(Listing.user_id == user.id)
    elif get_settings().require_auth:
        raise HTTPException(status_code=401, detail="Sign in required")
    result = await session.execute(query.limit(100))
    return [_to_summary(item) for item in result.scalars().all()]


@router.post("/listings", response_model=ListingOut, status_code=201)
async def create_listing(
    request: Request,
    payload: ListingCreate,
    user: RequireUser,
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    enforce_rate_limit(request, user.id if user else None)
    listing = Listing(
        user_id=user.id if user else None,
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


async def _attach_image_bytes(
    listing: Listing,
    blobs: list[tuple[str, bytes, str]],
) -> int:
    storage = get_storage()
    start = len(listing.images)
    stored = 0
    for filename, data, content_type in blobs:
        if not data:
            continue
        if len(data) > _MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="Each photo must be under 15 MB")
        path = await storage.upload(listing.id, filename, data, content_type)
        listing.images.append(
            ListingImage(
                listing_id=listing.id,
                path=path,
                content_type=content_type,
                sort_order=start + stored,
            )
        )
        stored += 1
    return stored


@router.post("/listings/{listing_id}/images", response_model=ListingOut)
async def upload_images(
    listing_id: str,
    request: Request,
    background: BackgroundTasks,
    user: RequireUser,
    files: list[UploadFile] = File(...),
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    enforce_rate_limit(request, user.id if user else None)
    listing = await _owned_listing(session, listing_id, user)
    if not files:
        raise HTTPException(status_code=400, detail="At least one image is required")

    blobs: list[tuple[str, bytes, str]] = []
    for upload in files:
        data = await upload.read()
        content_type = upload.content_type or "application/octet-stream"
        blobs.append((upload.filename or "photo.jpg", data, content_type))

    stored = await _attach_image_bytes(listing, blobs)
    if stored == 0:
        raise HTTPException(status_code=400, detail="At least one non-empty image is required")

    listing.status = "pending"
    listing.error = None
    await session.commit()
    listing = await _owned_listing(session, listing_id, user)
    _schedule(background, listing.id)
    return _to_out(listing)


@router.post("/listings/{listing_id}/images/from-urls", response_model=ListingOut)
async def upload_images_from_urls(
    listing_id: str,
    request: Request,
    payload: ImageUrlsIn,
    background: BackgroundTasks,
    user: RequireUser,
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    enforce_rate_limit(request, user.id if user else None)
    listing = await _owned_listing(session, listing_id, user)
    blobs = await download_allowed_images(payload.urls)
    if not blobs:
        raise HTTPException(
            status_code=400,
            detail="Could not download any listing photos from Facebook. Upload photos manually.",
        )
    stored = await _attach_image_bytes(listing, blobs)
    if stored == 0:
        raise HTTPException(status_code=400, detail="Could not store downloaded photos")

    listing.status = "pending"
    listing.error = None
    await session.commit()
    listing = await _owned_listing(session, listing_id, user)
    _schedule(background, listing.id)
    return _to_out(listing)


@router.post("/listings/{listing_id}/analyze", response_model=ListingOut)
async def trigger_analyze(
    listing_id: str,
    request: Request,
    background: BackgroundTasks,
    user: RequireUser,
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    enforce_rate_limit(request, user.id if user else None)
    listing = await _owned_listing(session, listing_id, user)
    _schedule(background, listing.id)
    return _to_out(listing)


@router.get("/listings/{listing_id}", response_model=ListingOut)
async def get_listing(
    listing_id: str,
    user: RequireUser,
    session: AsyncSession = Depends(get_session),
) -> ListingOut:
    listing = await _owned_listing(session, listing_id, user)
    return _to_out(listing)
