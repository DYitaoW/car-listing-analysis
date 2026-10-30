from __future__ import annotations

import asyncio
import re

from listing_validator_api.config import get_settings
from listing_validator_api.nhtsa import decode_vin, fetch_recalls
from listing_validator_api.schemas import (
    AnalysisReport,
    AttributeCheck,
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

# Common US trim tokens used to detect listing vs VIN conflicts.
_TRIM_TOKENS = (
    "type r",
    "type s",
    "touring",
    "prestige",
    "platinum",
    "limited",
    "lariat",
    "denali",
    "overland",
    "trailhawk",
    "rubicon",
    "sahara",
    "ex-l",
    "si",
    "sport",
    "tour",
    "premium",
    "preferred",
    "luxury",
    "xse",
    "xle",
    "xlt",
    "srt",
    "trd",
    "gt",
    "se",
    "sl",
    "sv",
    "lx",
    "ex",
    "le",
    "s",
)

_COLOR_PATTERNS = [
    (r"\b(?:pearl\s+)?white\b", "white"),
    (r"\b(?:jet\s+|glossy\s+)?black\b", "black"),
    (r"\b(?:space\s+|gunmetal\s+)?gr[ae]y\b", "gray"),
    (r"\bsilver\b", "silver"),
    (r"\b(?:dark\s+|bright\s+|navy\s+)?blue\b", "blue"),
    (r"\b(?:dark\s+|bright\s+)?red\b", "red"),
    (r"\bgreen\b", "green"),
    (r"\bbeige\b|\btan\b|\bchampagne\b", "beige"),
    (r"\bbrown\b|\bbronze\b", "brown"),
    (r"\borange\b", "orange"),
    (r"\byellow\b", "yellow"),
    (r"\bgold\b", "gold"),
    (r"\bcharcoal\b", "charcoal"),
    (r"\bnavy\b", "navy"),
]

_SEVERITY_WEIGHT = {"low": 4, "medium": 12, "high": 22}


def _extract_claims(description: str) -> list[str]:
    claims: list[str] = []
    lower = description.lower()
    for pattern, label in POSITIVE_CLAIM_PATTERNS:
        if re.search(pattern, lower):
            claims.append(label)
    return claims


def _extract_listing_color(text: str) -> str | None:
    lower = text.lower()
    for pattern, label in _COLOR_PATTERNS:
        if re.search(pattern, lower):
            return label
    return None


def _extract_listing_trims(text: str) -> list[str]:
    lower = text.lower()
    found: list[str] = []
    for token in _TRIM_TOKENS:
        if re.search(rf"\b{re.escape(token)}\b", lower):
            found.append(token)
    return found


def _mentions(text: str, value: str | None) -> bool | None:
    if not value:
        return None
    return re.search(rf"\b{re.escape(value.lower())}\b", text.lower()) is not None


def _trim_compatible(vin_trim: str, listing_trims: list[str]) -> bool | None:
    if not listing_trims:
        return None
    vin_l = vin_trim.lower()
    # Direct containment either way (EX-L vs EX, Sport vs Sport).
    for token in listing_trims:
        if token in vin_l or vin_l in token:
            return True
    # VIN trim words overlapping listing tokens.
    vin_parts = [p for p in re.split(r"[^a-z0-9]+", vin_l) if len(p) >= 2]
    for part in vin_parts:
        if part in listing_trims:
            return True
    return False


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
    listing_color = _extract_listing_color(f"{title}\n{description}")
    listing_trims = _extract_listing_trims(f"{title}\n{description}")

    vin_match, recall_info, vin_findings, attribute_checks = await _vin_and_recalls(
        title, description, vin, listing_color, listing_trims
    )
    flags.extend(_vin_flags(vin_match))
    flags.extend(_attribute_flags(attribute_checks))
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
                vin_decoded=vin_match.decoded,
                listing_color=listing_color,
                attribute_checks=attribute_checks,
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
        attribute_checks = _merge_attribute_checks(attribute_checks, vlm.attribute_checks)
        flags.extend(_attribute_flags(attribute_checks))

    if settings.llm_provider == "stub" or vlm_error or vlm is None:
        attribute_checks = _annotate_missing_photo_evidence(
            attribute_checks, settings.llm_provider, vlm_error
        )

    claim_checks = _merge_claims(text_claims, vlm.claim_checks if vlm else [], settings.llm_provider, vlm_error)
    flags = _dedupe_flags(flags)
    risk = _score(flags, vlm.risk_adjustment if vlm else 0)
    confidence = _confidence(inspection, vin_match, vlm is not None)
    summary = _summary(settings.llm_provider, vlm, vin_match, vlm_error)

    vin_match = VinMatch(
        checked=vin_match.checked,
        matches_listing=vin_match.matches_listing,
        decoded=vin_match.decoded,
        attribute_checks=[c for c in attribute_checks if c.source == "vin"],
    )

    return AnalysisReport(
        risk_score=risk,
        confidence=confidence,
        summary=summary,
        flags=flags,
        claim_checks=claim_checks,
        attribute_checks=attribute_checks,
        vin_match=vin_match,
        recalls=recall_info,
        image_findings=findings,
    )


async def _vin_and_recalls(
    title: str,
    description: str,
    vin: str | None,
    listing_color: str | None,
    listing_trims: list[str],
) -> tuple[VinMatch, RecallsInfo, list[str], list[AttributeCheck]]:
    recalls = RecallsInfo(checked=False)
    if not vin:
        return VinMatch(checked=False, matches_listing=None, decoded=None), recalls, [], []

    try:
        decoded = await decode_vin(vin)
    except Exception:
        return (
            VinMatch(checked=False, matches_listing=None, decoded=None),
            recalls,
            ["NHTSA VIN lookup failed, so specs were not cross-checked."],
            [],
        )

    if decoded is None or not (decoded.make or decoded.model):
        return (
            VinMatch(checked=True, matches_listing=None, decoded=None),
            recalls,
            ["VIN could not be decoded via NHTSA vPIC."],
            [],
        )

    text = f"{title} {description}"
    make_ok = _mentions(text, decoded.make)
    model_ok = _mentions(text, decoded.model)
    year_ok = _mentions(text, decoded.model_year)
    matches = _vin_matches(make_ok, model_ok)
    findings = [
        "NHTSA decoded the VIN as "
        + " ".join(
            part
            for part in (
                decoded.model_year,
                decoded.make,
                decoded.model,
                decoded.trim,
                decoded.body_class,
            )
            if part
        )
        + "."
    ]
    if decoded.drive_type or decoded.fuel_type or decoded.transmission:
        findings.append(
            "VIN equipment includes "
            + ", ".join(
                part
                for part in (
                    decoded.drive_type,
                    decoded.fuel_type,
                    f"{decoded.displacement_l}L" if decoded.displacement_l else None,
                    f"{decoded.engine_cylinders}-cyl" if decoded.engine_cylinders else None,
                    decoded.transmission,
                )
                if part
            )
            + "."
        )

    checks: list[AttributeCheck] = []
    for attr, value, listing_hit in (
        ("make", decoded.make, make_ok),
        ("model", decoded.model, model_ok),
        ("model_year", decoded.model_year, year_ok),
        ("body_class", decoded.body_class, _body_mentioned(text, decoded.body_class)),
        ("drive_type", decoded.drive_type, _drive_mentioned(text, decoded.drive_type)),
    ):
        if not value:
            continue
        checks.append(
            AttributeCheck(
                attribute=attr,
                expected=value,
                source="vin",
                listing_match=listing_hit,
                photo_evidence="unclear",
                detail=_listing_detail(attr, value, listing_hit),
            )
        )

    if decoded.trim:
        trim_ok = _trim_compatible(decoded.trim, listing_trims)
        if trim_ok is False:
            detail = (
                f"VIN trim is {decoded.trim}, but the listing text names "
                f"{', '.join(listing_trims)} — those usually conflict."
            )
        elif trim_ok is True:
            detail = f"Listing text is consistent with VIN trim {decoded.trim}."
        else:
            detail = (
                f"VIN trim is {decoded.trim}. The listing does not name a trim; "
                "photos should be checked for badges or equipment that match."
            )
        checks.append(
            AttributeCheck(
                attribute="trim",
                expected=decoded.trim,
                source="vin",
                listing_match=trim_ok,
                photo_evidence="unclear",
                detail=detail,
            )
        )
    elif listing_trims:
        checks.append(
            AttributeCheck(
                attribute="trim",
                expected=None,
                source="listing",
                listing_match=True,
                photo_evidence="unclear",
                detail=(
                    f"Listing claims trim {', '.join(listing_trims)}, but NHTSA did not return a "
                    "trim for this VIN. Photo badges can still be reviewed."
                ),
            )
        )

    if listing_color:
        checks.append(
            AttributeCheck(
                attribute="color",
                expected=listing_color,
                source="listing",
                listing_match=True,
                photo_evidence="unclear",
                detail=(
                    f"Listing text mentions {listing_color}. "
                    "VINs do not encode paint color — only photos can support this."
                ),
            )
        )

    if decoded.make and decoded.model and decoded.model_year:
        try:
            recalls = await fetch_recalls(decoded.make, decoded.model, decoded.model_year)
            if recalls.checked:
                findings.append(f"NHTSA recall campaigns for this make/model/year: {recalls.count}.")
        except Exception:
            recalls = RecallsInfo(checked=False)
            findings.append("NHTSA recall lookup failed.")

    return (
        VinMatch(checked=True, matches_listing=matches, decoded=decoded, attribute_checks=[]),
        recalls,
        findings,
        checks,
    )


def _listing_detail(attr: str, value: str, hit: bool | None) -> str:
    if hit is True:
        return f"Listing text mentions VIN {attr.replace('_', ' ')} ({value})."
    if hit is False:
        return f"VIN {attr.replace('_', ' ')} is {value}, which does not appear in the listing text."
    return f"VIN {attr.replace('_', ' ')} is {value}; listing text does not clearly confirm it."


def _body_mentioned(text: str, body: str | None) -> bool | None:
    if not body:
        return None
    lower = text.lower()
    aliases = {
        "sedan": ["sedan", "saloon", "4-door", "four door"],
        "coupe": ["coupe", "2-door", "two door"],
        "convertible": ["convertible", "cabriolet", "roadster"],
        "hatchback": ["hatchback", "hatch"],
        "suv": ["suv", "crossover", "sport utility"],
        "pickup": ["pickup", "truck", "pick-up"],
        "wagon": ["wagon", "estate"],
        "van": ["van", "minivan"],
    }
    body_l = body.lower()
    for key, words in aliases.items():
        if key in body_l:
            return any(w in lower for w in words)
    return _mentions(text, body.split("/")[0].strip())


def _drive_mentioned(text: str, drive: str | None) -> bool | None:
    if not drive:
        return None
    lower = text.lower()
    drive_l = drive.lower()
    if "4x4" in drive_l or "awd" in drive_l or "all wheel" in drive_l or "4wd" in drive_l:
        return any(tok in lower for tok in ("4x4", "4wd", "awd", "all-wheel", "all wheel"))
    if "4x2" in drive_l or "fwd" in drive_l or "rwd" in drive_l or "2wd" in drive_l:
        # Absence of AWD claim is not a mismatch; only flag if listing claims AWD/4WD.
        if any(tok in lower for tok in ("4x4", "4wd", "awd", "all-wheel", "all wheel")):
            return False
        return None
    return _mentions(text, drive)


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


def _attribute_flags(checks: list[AttributeCheck]) -> list[RiskFlag]:
    flags: list[RiskFlag] = []
    for check in checks:
        if check.attribute == "trim" and check.listing_match is False and check.expected:
            flags.append(
                RiskFlag(
                    code="vin_trim_mismatch",
                    severity="high",
                    message=f"VIN trim ({check.expected}) conflicts with the trim named in the listing.",
                )
            )
        if check.attribute == "model_year" and check.listing_match is False and check.expected:
            flags.append(
                RiskFlag(
                    code="vin_year_mismatch",
                    severity="high",
                    message=f"VIN model year ({check.expected}) is not reflected in the listing text.",
                )
            )
        if check.attribute == "drive_type" and check.listing_match is False and check.expected:
            flags.append(
                RiskFlag(
                    code="vin_drive_mismatch",
                    severity="medium",
                    message=f"Listing drive claims conflict with VIN drive type ({check.expected}).",
                )
            )
        if check.photo_evidence == "contradicted":
            code = f"photo_{check.attribute}_contradicted"
            severity = "high" if check.attribute in {"trim", "color", "make", "model"} else "medium"
            flags.append(
                RiskFlag(
                    code=code[:48],
                    severity=severity,  # type: ignore[arg-type]
                    message=check.detail or f"Photos contradict expected {check.attribute} ({check.expected}).",
                )
            )
    return flags


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


def _merge_attribute_checks(
    base: list[AttributeCheck],
    from_vlm: list[AttributeCheck],
) -> list[AttributeCheck]:
    by_key = {(c.attribute, (c.expected or "").lower()): c for c in base}
    for check in from_vlm:
        key = (check.attribute, (check.expected or "").lower())
        existing = by_key.get(key)
        if existing is None:
            # Match on attribute alone when expected is empty/partial.
            existing = next((c for c in base if c.attribute == check.attribute), None)
        if existing is None:
            by_key[key] = check
            continue
        by_key[(existing.attribute, (existing.expected or "").lower())] = AttributeCheck(
            attribute=existing.attribute,
            expected=existing.expected or check.expected,
            source=existing.source,
            listing_match=existing.listing_match if existing.listing_match is not None else check.listing_match,
            photo_evidence=check.photo_evidence,
            detail=check.detail or existing.detail,
        )
    # Preserve original order, then any brand-new VLM-only checks.
    merged = list(by_key.values())
    return merged


def _annotate_missing_photo_evidence(
    checks: list[AttributeCheck],
    provider: str,
    vlm_error: str | None,
) -> list[AttributeCheck]:
    out: list[AttributeCheck] = []
    for check in checks:
        if check.photo_evidence != "unclear":
            out.append(check)
            continue
        if check.attribute in {"trim", "color", "body_class", "make", "model"}:
            if provider == "stub":
                detail = (
                    check.detail
                    + " Set LLM_PROVIDER=gemini or ollama to look for photo evidence of this attribute."
                )
            elif vlm_error:
                detail = check.detail + " The vision model did not review photo evidence for this attribute."
            else:
                detail = check.detail
            out.append(check.model_copy(update={"detail": detail}))
        else:
            out.append(check)
    return out


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
            "Set LLM_PROVIDER=gemini or ollama to compare the photos with the seller's description "
            "and VIN trim/color cues."
        )
    elif vlm_error:
        parts.append("The vision model was unavailable, so this report uses local image inspection plus NHTSA data.")
    else:
        parts.append("Local image inspection finished. The vision model had no decodable photos to review.")

    decoded = vin_match.decoded
    if vin_match.checked and decoded and (decoded.make or decoded.model):
        label = " ".join(
            part for part in (decoded.model_year, decoded.make, decoded.model, decoded.trim) if part
        )
        if vin_match.matches_listing is True:
            parts.append(f"The VIN decodes to {label}, which agrees with the listing text.")
        elif vin_match.matches_listing is False:
            parts.append(f"The VIN decodes to {label}, which conflicts with the listing text.")
        else:
            parts.append(f"The VIN decodes to {label}.")
    return " ".join(parts)
