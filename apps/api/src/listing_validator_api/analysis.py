from __future__ import annotations

import asyncio
import re

from listing_validator_api.config import get_settings
from listing_validator_api.nhtsa import decode_vin, fetch_recalls
from listing_validator_api.schemas import (
    AnalysisReport,
    ClaimCheck,
    RecallsInfo,
    RiskFlag,
    VinDecoded,
    VinMatch,
)
from listing_validator_api.vision import (
    ImageInspection,
    ImagePayload,
    VlmAssessment,
    VlmNotConfiguredError,
    analyze_with_vlm,
    image_quality_flags,
    inspect_images,
)

POSITIVE_CLAIM_PATTERNS = [
    (r"\bno\s+rust\b", "no rust"),
    (r"\bperfect\s+(?:condition|interior|exterior)\b", "perfect condition claim"),
    (r"\baccident[-\s]?free\b", "accident-free claim"),
    (r"\blike\s+new\b", "like new claim"),
    (r"\bgavage\s+kept\b|\bgarage\s+kept\b", "garage kept claim"),
]

_SEVERITY_WEIGHT = {"low": 4, "medium": 12, "high": 22}


def _extract_claims(description: str) -> list[str]:
    claims: list[str] = []
    lower = description.lower()
    for pattern, label in POSITIVE_CLAIM_PATTERNS:
        if re.search(pattern, lower):
            claims.append(label)
    return claims


def _mentions(text: str, value: str | None) -> bool | None:
    if not value:
        return None
    return re.search(rf"\b{re.escape(value.lower())}\b", text.lower()) is not None


async def analyze_listing(
    *,
    title: str,
    description: str,
    price: float | None,
    vin: str | None,
    images: list[ImagePayload],
) -> AnalysisReport:
    settings = get_settings()
    flags: list[RiskFlag] = []
    findings: list[str] = []

    inspection = await asyncio.to_thread(inspect_images, images)
    findings.extend(inspection.findings)
    if not images:
        flags.append(
            RiskFlag(
                code="no_images",
                severity="high",
                message="No listing photos were provided; visual validation is incomplete.",
            )
        )
    else:
        flags.extend(inspection.flags)
        flags.extend(image_quality_flags(images, inspection))

    text_claims = _extract_claims(description)
    vin_match, recall_info, vin_findings = await _vin_and_recalls(title, description, vin)
    flags.extend(_vin_flags(vin_match))
    if vin and not vin_match.checked:
        flags.append(
            RiskFlag(
                code="vin_lookup_failed",
                severity="low",
                message="NHTSA VIN lookup failed; specs were not cross-checked.",
            )
        )
    findings.extend(vin_findings)
    flags.extend(_recall_flags(recall_info))

    if price is not None and 0 < price < 1500:
        flags.append(
            RiskFlag(
                code="price_too_good",
                severity="high",
                message="Asking price is unusually low for a passenger vehicle.",
            )
        )

    vlm: VlmAssessment | None = None
    vlm_error: str | None = None
    if settings.llm_provider in {"gemini", "ollama"} and images:
        try:
            vlm = await analyze_with_vlm(
                provider=settings.llm_provider,
                title=title,
                description=description,
                price=price,
                claims=text_claims,
                images=images,
                settings=settings,
            )
        except VlmNotConfiguredError as exc:
            vlm_error = str(exc)
            flags.append(
                RiskFlag(
                    code="vlm_unconfigured",
                    severity="low",
                    message=f"Vision provider {settings.llm_provider} is not configured ({exc}). Photo checks used local image inspection only.",
                )
            )
        except Exception as exc:
            vlm_error = str(exc)
            flags.append(
                RiskFlag(
                    code="vlm_failed",
                    severity="low",
                    message=f"Vision model provider failed ({exc}). Photo checks used local image inspection only.",
                )
            )

    if vlm:
        flags.extend(vlm.flags)
        flags.extend(_vlm_consistency_flags(vlm, f"{title}\n{description}"))
        if vlm.summary:
            findings.append(vlm.summary)
        observed = " ".join(
            part
            for part in (vlm.observed_color, vlm.observed_make, vlm.observed_model)
            if part
        ).strip()
        if observed:
            findings.append(f"Vision model describes the vehicle as {observed}.")

    claim_checks = _merge_claims(text_claims, vlm.claim_checks if vlm else [], settings.llm_provider, vlm_error)
    flags = _dedupe_flags(flags)
    risk = _score(flags, vlm.risk_adjustment if vlm else 0)
    confidence = _confidence(inspection, vin_match, vlm is not None)
    summary = _summary(settings.llm_provider, vlm, vin_match, vlm_error)

    return AnalysisReport(
        risk_score=risk,
        confidence=confidence,
        summary=summary,
        flags=flags,
        claim_checks=claim_checks,
        vin_match=vin_match,
        recalls=recall_info,
        image_findings=findings,
    )


async def _vin_and_recalls(
    title: str,
    description: str,
    vin: str | None,
) -> tuple[VinMatch, RecallsInfo, list[str]]:
    recalls = RecallsInfo(checked=False)
    if not vin:
        return VinMatch(checked=False, matches_listing=None, decoded=None), recalls, []

    try:
        decoded = await decode_vin(vin)
    except Exception:
        return (
            VinMatch(checked=False, matches_listing=None, decoded=None),
            recalls,
            ["NHTSA VIN lookup failed, so specs were not cross-checked."],
        )

    if decoded is None or not (decoded.make or decoded.model):
        return (
            VinMatch(checked=True, matches_listing=None, decoded=None),
            recalls,
            ["VIN could not be decoded via NHTSA vPIC."],
        )

    text = f"{title} {description}"
    matches = _vin_matches(_mentions(text, decoded.make), _mentions(text, decoded.model))
    findings = [
        "NHTSA decoded the VIN as "
        + " ".join(part for part in (decoded.model_year, decoded.make, decoded.model, decoded.body_class) if part)
        + "."
    ]

    if decoded.make and decoded.model and decoded.model_year:
        try:
            recalls = await fetch_recalls(decoded.make, decoded.model, decoded.model_year)
            if recalls.checked:
                findings.append(f"NHTSA recall campaigns for this make/model/year: {recalls.count}.")
        except Exception:
            recalls = RecallsInfo(checked=False)
            findings.append("NHTSA recall lookup failed.")

    return VinMatch(checked=True, matches_listing=matches, decoded=decoded), recalls, findings


def _vin_matches(make_ok: bool | None, model_ok: bool | None) -> bool | None:
    if model_ok is True:
        return True
    if model_ok is False:
        return False
    if make_ok is True:
        return True
    if make_ok is False:
        return False
    return None


def _vin_flags(vin_match: VinMatch) -> list[RiskFlag]:
    if not vin_match.checked and vin_match.decoded is None:
        return []
    decoded: VinDecoded | None = vin_match.decoded
    if vin_match.checked and decoded is None:
        return [
            RiskFlag(
                code="vin_undecodable",
                severity="medium",
                message="VIN could not be decoded via NHTSA vPIC.",
            )
        ]
    if vin_match.matches_listing is False:
        model_missing = decoded is not None and decoded.model is not None
        return [
            RiskFlag(
                code="vin_spec_mismatch",
                severity="high" if model_missing else "medium",
                message="NHTSA VIN decode does not align with the make/model text in the listing.",
            )
        ]
    return []


def _recall_flags(recalls: RecallsInfo) -> list[RiskFlag]:
    if not recalls.checked:
        return []
    if recalls.park_it or recalls.park_outside:
        return [
            RiskFlag(
                code="urgent_recall",
                severity="high",
                message="NHTSA lists an urgent Park It / Park Outside recall for this vehicle.",
            )
        ]
    if recalls.count:
        return [
            RiskFlag(
                code="open_recalls",
                severity="medium",
                message=f"NHTSA reports {recalls.count} recall campaign(s) for this make/model/year.",
            )
        ]
    return []


def _vlm_consistency_flags(vlm: VlmAssessment, text: str) -> list[RiskFlag]:
    flags: list[RiskFlag] = []
    if vlm.photo_text_consistent is False and not any(flag.code == "photo_text_mismatch" for flag in vlm.flags):
        flags.append(
            RiskFlag(
                code="photo_text_mismatch",
                severity="high",
                message="The vision model reports that the photos do not match the listing text.",
            )
        )
    if vlm.visible_damage and not any("damage" in flag.code for flag in vlm.flags):
        flags.append(
            RiskFlag(
                code="visible_damage",
                severity="medium",
                message="The vision model sees damage in the photos.",
            )
        )
    if vlm.observed_make and _mentions(text, vlm.observed_make) is False:
        flags.append(
            RiskFlag(
                code="vlm_make_not_in_text",
                severity="medium",
                message=f"Photos appear to show a {vlm.observed_make}, which the listing text does not name.",
            )
        )
    return flags


def _merge_claims(
    text_claims: list[str],
    vlm_checks: list[ClaimCheck],
    provider: str,
    vlm_error: str | None,
) -> list[ClaimCheck]:
    by_claim = {check.claim.lower(): check for check in vlm_checks}
    merged: list[ClaimCheck] = []
    seen: set[str] = set()
    for claim in text_claims:
        seen.add(claim.lower())
        match = by_claim.get(claim.lower())
        if match:
            merged.append(match)
            continue
        if provider == "stub":
            detail = "Local analysis recorded the claim. Set LLM_PROVIDER=gemini or ollama to compare it with the photos."
        elif vlm_error:
            detail = "The vision model did not review this claim, so it stays unclear."
        else:
            detail = "The vision model did not return a verdict for this claim."
        merged.append(ClaimCheck(claim=claim, verdict="unclear", detail=detail))
    for check in vlm_checks:
        if check.claim.lower() not in seen:
            merged.append(check)
    return merged


def _dedupe_flags(flags: list[RiskFlag]) -> list[RiskFlag]:
    seen: set[str] = set()
    unique: list[RiskFlag] = []
    for flag in flags:
        if flag.code in seen:
            continue
        seen.add(flag.code)
        unique.append(flag)
    return unique


def _score(flags: list[RiskFlag], risk_adjustment: int) -> int:
    total = 8 + sum(_SEVERITY_WEIGHT[flag.severity] for flag in flags) + risk_adjustment
    return max(0, min(100, total))


def _confidence(inspection: ImageInspection, vin_match: VinMatch, used_vlm: bool) -> float:
    confidence = 0.34
    if inspection.readable_count >= 3:
        confidence += 0.12
    elif inspection.readable_count >= 1:
        confidence += 0.06
    if vin_match.checked and vin_match.decoded and (vin_match.decoded.make or vin_match.decoded.model):
        confidence += 0.18
    if used_vlm:
        confidence += 0.2
    return round(min(0.9, confidence), 2)


def _summary(provider: str, vlm: VlmAssessment | None, vin_match: VinMatch, vlm_error: str | None) -> str:
    parts: list[str] = []
    if vlm and vlm.summary:
        parts.append(vlm.summary)
    elif provider == "stub":
        parts.append(
            "Photos were inspected locally for resolution, duplicates, and placeholders. "
            "Set LLM_PROVIDER=gemini or ollama to compare the photos with the seller's description."
        )
    elif vlm_error:
        parts.append("The vision model was unavailable, so this report uses local image inspection plus NHTSA data.")
    else:
        parts.append("Local image inspection finished. The vision model had no decodable photos to review.")

    decoded = vin_match.decoded
    if vin_match.checked and decoded and (decoded.make or decoded.model):
        label = " ".join(part for part in (decoded.model_year, decoded.make, decoded.model) if part)
        if vin_match.matches_listing is True:
            parts.append(f"The VIN decodes to {label}, which agrees with the listing text.")
        elif vin_match.matches_listing is False:
            parts.append(f"The VIN decodes to {label}, which conflicts with the listing text.")
        else:
            parts.append(f"The VIN decodes to {label}.")
    return " ".join(parts)
