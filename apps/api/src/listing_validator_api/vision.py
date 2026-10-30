from __future__ import annotations

import hashlib
import io
import json
import re
from dataclasses import dataclass, field
from datetime import datetime

import httpx
from PIL import Image, ImageStat

from listing_validator_api.config import Settings
from listing_validator_api.schemas import AttributeCheck, ClaimCheck, RiskFlag, VinDecoded

VLM_IMAGE_LIMIT = 4
_MAX_SIDE = 1280


class VlmNotConfiguredError(RuntimeError):
    """The selected vision provider is missing credentials or a reachable model."""


@dataclass(frozen=True)
class ImagePayload:
    data: bytes
    content_type: str
    filename: str


@dataclass
class ImageInspection:
    flags: list[RiskFlag] = field(default_factory=list)
    findings: list[str] = field(default_factory=list)
    readable_count: int = 0


@dataclass
class VlmAssessment:
    summary: str
    flags: list[RiskFlag]
    claim_checks: list[ClaimCheck]
    attribute_checks: list[AttributeCheck]
    observed_make: str | None
    observed_model: str | None
    observed_color: str | None
    visible_damage: bool
    photo_text_consistent: bool | None
    risk_adjustment: int


def inspect_images(images: list[ImagePayload]) -> ImageInspection:
    inspection = ImageInspection()
    if not images:
        inspection.findings.append("No photos were available to inspect.")
        return inspection

    hashes: dict[str, int] = {}
    dates: list[datetime] = []
    unreadable = 0

    for image in images:
        finding, digest, taken_at, readable = _inspect_one(image)
        inspection.findings.append(finding)
        if not readable:
            unreadable += 1
            continue
        inspection.readable_count += 1
        if digest:
            hashes[digest] = hashes.get(digest, 0) + 1
        if taken_at:
            dates.append(taken_at)

    if images and inspection.readable_count == 0:
        inspection.flags.append(
            RiskFlag(
                code="unreadable_image",
                severity="high",
                message="None of the uploaded files could be decoded as photos.",
            )
        )
    elif unreadable:
        inspection.flags.append(
            RiskFlag(
                code="some_images_unreadable",
                severity="medium",
                message=f"{unreadable} upload(s) could not be decoded as photos.",
            )
        )

    duplicate_count = sum(count for count in hashes.values() if count > 1)
    if duplicate_count:
        inspection.flags.append(
            RiskFlag(
                code="duplicate_photos",
                severity="medium",
                message=f"{duplicate_count} uploaded photos are exact duplicates.",
            )
        )
        inspection.findings.append(f"{duplicate_count} photos share an identical file hash.")

    if len(dates) >= 2 and (max(dates) - min(dates)).days > 540:
        inspection.flags.append(
            RiskFlag(
                code="photo_dates_diverge",
                severity="medium",
                message="Photo timestamps are more than 18 months apart.",
            )
        )
        inspection.findings.append(
            f"Embedded photo dates span {min(dates).date().isoformat()} to {max(dates).date().isoformat()}."
        )

    return inspection


def _display_name(filename: str) -> str:
    match = re.match(r"^[0-9a-f]{32}_(.+)$", filename)
    return match.group(1) if match else filename or "photo"


def _inspect_one(image: ImagePayload) -> tuple[str, str | None, datetime | None, bool]:
    label = _display_name(image.filename)
    if not image.data:
        return f"{label}: empty file.", None, None, False
    try:
        with Image.open(io.BytesIO(image.data)) as im:
            im.load()
            width, height = im.size
            fmt = im.format or image.content_type or "unknown"
            digest = hashlib.sha256(image.data).hexdigest()
            taken_at = _exif_datetime(im)
            stddev = _detail_score(im)
    except Exception:
        return f"{label}: not a readable image.", None, None, False

    notes: list[str] = [f"{label}: {width}×{height} {fmt}."]
    if min(width, height) < 200 or width * height < 80_000:
        notes.append("Resolution is very low.")
    if stddev < 2:
        notes.append("The frame is nearly a solid color.")
    if taken_at:
        notes.append(f"Embedded timestamp {taken_at.date().isoformat()}.")
    return " ".join(notes), digest, taken_at, True


def _detail_score(im: Image.Image) -> float:
    sample = im.convert("L").resize((64, 64))
    return float(ImageStat.Stat(sample).stddev[0])


def _exif_datetime(im: Image.Image) -> datetime | None:
    raw = im.getexif().get(36867) or im.getexif().get(306)
    if not isinstance(raw, str):
        return None
    for fmt in ("%Y:%m:%d %H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(raw.strip(), fmt)
        except ValueError:
            continue
    return None


def image_quality_flags(images: list[ImagePayload], inspection: ImageInspection) -> list[RiskFlag]:
    flags: list[RiskFlag] = []
    readable = [image for image in images if _is_readable(image)]
    tiny = 0
    blank = 0
    for image in readable:
        try:
            with Image.open(io.BytesIO(image.data)) as im:
                im.load()
                width, height = im.size
                stddev = _detail_score(im)
        except Exception:
            continue
        if min(width, height) < 200 or width * height < 80_000:
            tiny += 1
        if stddev < 2:
            blank += 1
    if tiny:
        flags.append(
            RiskFlag(
                code="tiny_image",
                severity="medium",
                message=f"{tiny} photo(s) are under 200px on a side, so damage and badging are hard to judge.",
            )
        )
    if blank:
        flags.append(
            RiskFlag(
                code="blank_image",
                severity="medium",
                message=f"{blank} photo(s) look like a solid color or placeholder rather than a vehicle.",
            )
        )
    if 0 < inspection.readable_count < 3:
        flags.append(
            RiskFlag(
                code="few_images",
                severity="medium",
                message="Fewer than 3 readable photos; damage and angle coverage may be limited.",
            )
        )
    return flags


def _is_readable(image: ImagePayload) -> bool:
    if not image.data:
        return False
    try:
        with Image.open(io.BytesIO(image.data)) as im:
            im.load()
        return True
    except Exception:
        return False


def prepare_for_vlm(data: bytes) -> tuple[bytes, str] | None:
    try:
        with Image.open(io.BytesIO(data)) as im:
            frame = im.convert("RGB")
            frame.thumbnail((_MAX_SIDE, _MAX_SIDE))
            buffer = io.BytesIO()
            frame.save(buffer, format="JPEG", quality=82)
            return buffer.getvalue(), "image/jpeg"
    except Exception:
        return None


def parse_vlm_payload(raw: str) -> VlmAssessment:
    data = _json_object(raw)
    flags = [_flag(item) for item in data.get("flags") or []]
    flags = [flag for flag in flags if flag is not None]
    checks = [_claim(item) for item in data.get("claim_checks") or []]
    checks = [check for check in checks if check is not None]
    adjustment = data.get("risk_adjustment", 0)
    try:
        adjustment_int = int(adjustment)
    except (TypeError, ValueError):
        adjustment_int = 0
    attrs = [_attribute(item) for item in data.get("attribute_checks") or []]
    attrs = [item for item in attrs if item is not None]
    return VlmAssessment(
        summary=str(data.get("summary") or "").strip(),
        flags=flags,
        claim_checks=checks,
        attribute_checks=attrs,
        observed_make=_optional_str(data.get("observed_make")),
        observed_model=_optional_str(data.get("observed_model")),
        observed_color=_optional_str(data.get("observed_color")),
        visible_damage=bool(data.get("visible_damage")),
        photo_text_consistent=_optional_bool(data.get("photo_text_consistent")),
        risk_adjustment=max(0, min(30, adjustment_int)),
    )


async def analyze_with_vlm(
    *,
    provider: str,
    title: str,
    description: str,
    price: float | None,
    claims: list[str],
    images: list[ImagePayload],
    settings: Settings,
    vin_decoded: VinDecoded | None = None,
    listing_color: str | None = None,
    attribute_checks: list[AttributeCheck] | None = None,
) -> VlmAssessment | None:
    prepared: list[tuple[bytes, str]] = []
    for image in images:
        encoded = prepare_for_vlm(image.data)
        if encoded is None:
            continue
        prepared.append(encoded)
        if len(prepared) >= VLM_IMAGE_LIMIT:
            break
    if not prepared:
        return None

    prompt = _prompt(
        title=title,
        description=description,
        price=price,
        claims=claims,
        shown=len(prepared),
        total=len(images),
        vin_decoded=vin_decoded,
        listing_color=listing_color,
        attribute_checks=attribute_checks or [],
    )
    if provider == "gemini":
        raw = await _gemini(prompt, prepared, settings)
    elif provider == "ollama":
        raw = await _ollama(prompt, prepared, settings)
    else:
        return None
    return parse_vlm_payload(raw)


def _prompt(
    *,
    title: str,
    description: str,
    price: float | None,
    claims: list[str],
    shown: int,
    total: int,
    vin_decoded: VinDecoded | None,
    listing_color: str | None,
    attribute_checks: list[AttributeCheck],
) -> str:
    claim_text = ", ".join(claims) if claims else "none extracted"
    price_text = "unknown" if price is None else str(price)
    vin_lines: list[str] = []
    if vin_decoded:
        for label, value in (
            ("year", vin_decoded.model_year),
            ("make", vin_decoded.make),
            ("model", vin_decoded.model),
            ("trim", vin_decoded.trim),
            ("series", vin_decoded.series),
            ("body", vin_decoded.body_class),
            ("drive", vin_decoded.drive_type),
            ("doors", vin_decoded.doors),
            ("fuel", vin_decoded.fuel_type),
            ("engine_l", vin_decoded.displacement_l),
            ("cylinders", vin_decoded.engine_cylinders),
            ("hp", vin_decoded.engine_hp),
            ("transmission", vin_decoded.transmission),
        ):
            if value:
                vin_lines.append(f"- {label}: {value}")
    vin_block = "\n".join(vin_lines) if vin_lines else "- (no VIN decode available)"
    focus = []
    for check in attribute_checks:
        if check.attribute in {"trim", "color", "body_class", "make", "model"} and check.expected:
            focus.append(f"- {check.attribute}: expected {check.expected} (from {check.source})")
    if listing_color and not any(c.attribute == "color" for c in attribute_checks):
        focus.append(f"- color: expected {listing_color} (from listing)")
    focus_block = "\n".join(focus) if focus else "- none beyond general consistency"

    return f"""You assess risk signals in a user-submitted vehicle listing. You do not verify title, ownership, or vehicle history.

Listing title: {title}
Asking price USD: {price_text}
Description:
{description}

Text claims to judge against the photos: {claim_text}

NHTSA VIN decode (factory attributes — paint color is NEVER in the VIN):
{vin_block}

Attributes that need photo evidence when possible:
{focus_block}

You are seeing {shown} of {total} uploaded photos.

Return ONLY JSON with this shape:
{{
  "summary": "one or two sentences of what the photos show",
  "photo_text_consistent": true,
  "visible_damage": false,
  "observed_make": null,
  "observed_model": null,
  "observed_color": null,
  "risk_adjustment": 0,
  "flags": [{{"code": "snake_case", "severity": "low|medium|high", "message": "what is wrong"}}],
  "claim_checks": [{{"claim": "text", "verdict": "supported|contradicted|unclear", "detail": "what the photos show"}}],
  "attribute_checks": [{{"attribute": "trim|color|body_class|make|model", "expected": "value", "source": "vin|listing", "listing_match": null, "photo_evidence": "supported|contradicted|unclear|not_applicable", "detail": "what the photos show"}}]
}}

Rules:
- Set photo_text_consistent to false only when the photos clearly disagree with the title or description.
- Use claim verdict "supported" only when the photos actually show the claim. Otherwise use "unclear" or "contradicted".
- For trim: look for trim badges, wheels, lighting, or equipment that support or contradict the VIN/listing trim. If nothing is readable, use photo_evidence "unclear".
- For color: compare the exterior paint in the photos to the expected listing color. VIN has no color — never invent a VIN color.
- For body_class/make/model: only mark contradicted when photos clearly show a different class/brand/model.
- risk_adjustment is an integer from 0 to 30.
- Do not say the vehicle is verified, authentic, or title-clean.
"""


async def _gemini(prompt: str, images: list[tuple[bytes, str]], settings: Settings) -> str:
    if not settings.gemini_api_key:
        raise VlmNotConfiguredError("GEMINI_API_KEY is empty")
    import base64

    parts: list[dict[str, object]] = [{"text": prompt}]
    for data, mime in images:
        parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(data).decode("ascii")}})
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.gemini_model}:generateContent"
    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, params={"key": settings.gemini_api_key}, json=payload)
        response.raise_for_status()
        body = response.json()
    candidates = body.get("candidates") or []
    if not candidates:
        raise ValueError("Gemini returned no candidates")
    text_parts = (candidates[0].get("content") or {}).get("parts") or []
    texts = [part.get("text", "") for part in text_parts if isinstance(part, dict) and part.get("text")]
    if not texts:
        raise ValueError("Gemini returned no text")
    return "\n".join(texts)


async def _ollama(prompt: str, images: list[tuple[bytes, str]], settings: Settings) -> str:
    import base64

    payload = {
        "model": settings.ollama_model,
        "stream": False,
        "format": "json",
        "messages": [
            {
                "role": "user",
                "content": prompt,
                "images": [base64.b64encode(data).decode("ascii") for data, _mime in images],
            }
        ],
    }
    base = settings.ollama_base_url.rstrip("/")
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(f"{base}/api/chat", json=payload)
        response.raise_for_status()
        body = response.json()
    content = ((body.get("message") or {}).get("content")) or body.get("response") or ""
    if not str(content).strip():
        raise ValueError("Ollama returned no content")
    return str(content)


def _json_object(raw: str) -> dict:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("Vision model did not return JSON")
    parsed = json.loads(cleaned[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("Vision model JSON was not an object")
    return parsed


def _optional_str(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"null", "none", "unknown", "n/a"}:
        return None
    return text


def _optional_bool(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"true", "yes"}:
            return True
        if lowered in {"false", "no"}:
            return False
    return None


def _flag(item: object) -> RiskFlag | None:
    if not isinstance(item, dict):
        return None
    severity = str(item.get("severity") or "low").lower()
    if severity not in {"low", "medium", "high"}:
        severity = "low"
    code = re.sub(r"[^a-z0-9_]+", "_", str(item.get("code") or "vlm_note").lower()).strip("_")[:48]
    message = str(item.get("message") or "").strip()
    if not message:
        return None
    return RiskFlag(code=code or "vlm_note", severity=severity, message=message)  # type: ignore[arg-type]


def _claim(item: object) -> ClaimCheck | None:
    if not isinstance(item, dict):
        return None
    claim = str(item.get("claim") or "").strip()
    detail = str(item.get("detail") or "").strip()
    verdict = str(item.get("verdict") or "unclear").lower()
    if verdict not in {"supported", "contradicted", "unclear"}:
        verdict = "unclear"
    if not claim or not detail:
        return None
    return ClaimCheck(claim=claim, verdict=verdict, detail=detail)  # type: ignore[arg-type]


def _attribute(item: object) -> AttributeCheck | None:
    if not isinstance(item, dict):
        return None
    attribute = re.sub(r"[^a-z0-9_]+", "_", str(item.get("attribute") or "").lower()).strip("_")
    detail = str(item.get("detail") or "").strip()
    if not attribute or not detail:
        return None
    evidence = str(item.get("photo_evidence") or "unclear").lower()
    if evidence not in {"supported", "contradicted", "unclear", "not_applicable"}:
        evidence = "unclear"
    source = str(item.get("source") or "listing").lower()
    if source not in {"vin", "listing"}:
        source = "listing"
    listing_match = _optional_bool(item.get("listing_match"))
    expected = _optional_str(item.get("expected"))
    return AttributeCheck(
        attribute=attribute[:48],
        expected=expected,
        source=source,  # type: ignore[arg-type]
        listing_match=listing_match,
        photo_evidence=evidence,  # type: ignore[arg-type]
        detail=detail,
    )
