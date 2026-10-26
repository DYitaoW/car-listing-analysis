from __future__ import annotations

import json
import re

from listing_validator_api.config import get_settings
from listing_validator_api.nhtsa import decode_vin, fetch_recalls
from listing_validator_api.schemas import (
    AnalysisReport,
    ClaimCheck,
    RecallsInfo,
    RiskFlag,
    VinMatch,
)


POSITIVE_CLAIM_PATTERNS = [
    (r"\bno\s+rust\b", "no rust"),
    (r"\bperfect\s+(?:condition|interior|exterior)\b", "perfect condition claim"),
    (r"\baccident[-\s]?free\b", "accident-free claim"),
    (r"\blike\s+new\b", "like new claim"),
    (r"\bgavage\s+kept\b|\bgarage\s+kept\b", "garage kept claim"),
]


def _extract_claims(description: str) -> list[str]:
    claims: list[str] = []
    lower = description.lower()
    for pattern, label in POSITIVE_CLAIM_PATTERNS:
        if re.search(pattern, lower):
            claims.append(label)
    return claims


def _title_mentions(title: str, value: str | None) -> bool | None:
    if not value:
        return None
    return value.lower() in title.lower()


async def analyze_listing(
    *,
    title: str,
    description: str,
    price: float | None,
    vin: str | None,
    image_paths: list[str],
) -> AnalysisReport:
    settings = get_settings()
    flags: list[RiskFlag] = []
    claim_checks: list[ClaimCheck] = []
    risk = 20
    confidence = 0.45

    if not image_paths:
        flags.append(
            RiskFlag(
                code="no_images",
                severity="high",
                message="No listing photos were provided; visual validation is incomplete.",
            )
        )
        risk += 35
        confidence = 0.3
    elif len(image_paths) < 3:
        flags.append(
            RiskFlag(
                code="few_images",
                severity="medium",
                message="Fewer than 3 photos uploaded; damage and angle coverage may be limited.",
            )
        )
        risk += 10

    for claim in _extract_claims(description):
        # Without a live VLM, mark optimistic claims as unclear rather than verified.
        claim_checks.append(
            ClaimCheck(
                claim=claim,
                verdict="unclear",
                detail="Photo↔claim verification requires Gemini/Ollama vision; marked unclear in stub mode.",
            )
        )
        risk += 5

    if price is not None and price > 0 and price < 1500:
        flags.append(
            RiskFlag(
                code="price_too_good",
                severity="high",
                message="Asking price is unusually low for a passenger vehicle — treat as a risk signal.",
            )
        )
        risk += 20

    vin_match = VinMatch(checked=False, matches_listing=None, decoded=None)
    recalls = RecallsInfo(checked=False)

    if vin:
        try:
            decoded = await decode_vin(vin)
            if decoded and (decoded.make or decoded.model):
                make_ok = _title_mentions(title + " " + description, decoded.make)
                model_ok = _title_mentions(title + " " + description, decoded.model)
                matches = True
                if make_ok is False or model_ok is False:
                    matches = False
                    flags.append(
                        RiskFlag(
                            code="vin_spec_mismatch",
                            severity="high",
                            message="NHTSA VIN decode does not align with make/model text in the listing.",
                        )
                    )
                    risk += 25
                vin_match = VinMatch(checked=True, matches_listing=matches, decoded=decoded)
                confidence = max(confidence, 0.6)

                if decoded.make and decoded.model and decoded.model_year:
                    try:
                        recalls = await fetch_recalls(decoded.make, decoded.model, decoded.model_year)
                        if recalls.park_it or recalls.park_outside:
                            flags.append(
                                RiskFlag(
                                    code="urgent_recall",
                                    severity="high",
                                    message="NHTSA lists an urgent Park It / Park Outside recall for this vehicle.",
                                )
                            )
                            risk += 15
                        elif recalls.count:
                            flags.append(
                                RiskFlag(
                                    code="open_recalls",
                                    severity="medium",
                                    message=f"NHTSA reports {recalls.count} recall campaign(s) for this make/model/year.",
                                )
                            )
                            risk += 5
                    except Exception:
                        recalls = RecallsInfo(checked=False)
            else:
                flags.append(
                    RiskFlag(
                        code="vin_undecodable",
                        severity="medium",
                        message="VIN could not be decoded via NHTSA vPIC.",
                    )
                )
                vin_match = VinMatch(checked=True, matches_listing=None, decoded=None)
                risk += 8
        except Exception:
            flags.append(
                RiskFlag(
                    code="vin_lookup_failed",
                    severity="low",
                    message="NHTSA VIN lookup failed; specs were not cross-checked.",
                )
            )

    # Optional live VLM path — scaffolded; stub remains default.
    if settings.llm_provider in {"gemini", "ollama"} and image_paths:
        try:
            vlm_report = await _run_vlm(title, description, price, image_paths)
            if vlm_report:
                return vlm_report
        except Exception as exc:
            flags.append(
                RiskFlag(
                    code="vlm_failed",
                    severity="low",
                    message=f"Vision model provider failed ({exc}); falling back to heuristic report.",
                )
            )

    risk = max(0, min(100, risk))
    summary = (
        "Heuristic risk report generated without a live vision model. "
        "Configure LLM_PROVIDER=gemini or ollama for photo↔description discrepancy checks."
        if settings.llm_provider == "stub"
        else "Combined heuristic + provider analysis."
    )

    return AnalysisReport(
        risk_score=risk,
        confidence=confidence,
        summary=summary,
        flags=flags,
        claim_checks=claim_checks,
        vin_match=vin_match,
        recalls=recalls,
    )


async def _run_vlm(
    title: str,
    description: str,
    price: float | None,
    image_paths: list[str],
) -> AnalysisReport | None:
    """Placeholder for Gemini / Ollama structured analysis. Returns None to use heuristics."""
    _ = (title, description, price, image_paths, json.dumps)
    # Wired in Phase 1 follow-up: call provider and parse AnalysisReport.
    return None
