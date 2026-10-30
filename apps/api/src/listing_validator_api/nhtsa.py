from __future__ import annotations

from collections import Counter

import httpx

from listing_validator_api.schemas import (
    ComplaintComponent,
    ModelIssuesInfo,
    RecallCampaign,
    RecallsInfo,
    VinDecoded,
)


VPIC_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"
RECALLS_URL = "https://api.nhtsa.gov/recalls/recallsByVehicle"
COMPLAINTS_URL = "https://api.nhtsa.gov/complaints/complaintsByVehicle"
_HEADERS = {"User-Agent": "SignalCheck/0.1 (vehicle listing risk signals)", "Accept": "application/json"}


def _clean(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"not applicable", "null", "none", "0"}:
        return None
    return text


async def decode_vin(vin: str) -> VinDecoded | None:
    vin = vin.strip().upper()
    if len(vin) < 11:
        return None
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(VPIC_URL.format(vin=vin), headers=_HEADERS)
        resp.raise_for_status()
        results = resp.json().get("Results") or []
        if not results:
            return None
        row = results[0]
        return VinDecoded(
            make=_clean(row.get("Make")),
            model=_clean(row.get("Model")),
            model_year=_clean(row.get("ModelYear")),
            body_class=_clean(row.get("BodyClass")),
            trim=_clean(row.get("Trim")),
            series=_clean(row.get("Series")),
            drive_type=_clean(row.get("DriveType")),
            doors=_clean(row.get("Doors")),
            fuel_type=_clean(row.get("FuelTypePrimary")),
            displacement_l=_clean(row.get("DisplacementL")),
            engine_cylinders=_clean(row.get("EngineCylinders")),
            engine_hp=_clean(row.get("EngineHP")),
            transmission=_clean(row.get("TransmissionStyle")),
            plant_city=_clean(row.get("PlantCity")),
            plant_state=_clean(row.get("PlantState")),
            plant_country=_clean(row.get("PlantCountry")),
            vehicle_type=_clean(row.get("VehicleType")),
            error_text=_clean(row.get("ErrorText")),
        )


async def fetch_recalls(make: str, model: str, model_year: str) -> RecallsInfo:
    params = {"make": make, "model": model, "modelYear": model_year}
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.get(RECALLS_URL, params=params, headers=_HEADERS)
        resp.raise_for_status()
        payload = resp.json()
        results = payload.get("results") or payload.get("Results") or []
        campaigns: list[RecallCampaign] = []
        park_it = False
        park_outside = False
        for row in results:
            is_park = bool(row.get("parkIt"))
            is_outside = bool(row.get("parkOutSide") or row.get("parkOutside"))
            park_it = park_it or is_park
            park_outside = park_outside or is_outside
            summary = _clean(row.get("Summary"))
            if summary and len(summary) > 220:
                summary = summary[:217].rstrip() + "…"
            campaigns.append(
                RecallCampaign(
                    campaign_number=_clean(row.get("NHTSACampaignNumber")),
                    component=_clean(row.get("Component")),
                    summary=summary,
                    consequence=_clean(row.get("Consequence")),
                    park_it=is_park,
                    park_outside=is_outside,
                )
            )
        # Prefer urgent campaigns first, then keep a short list for the UI.
        campaigns.sort(key=lambda c: (not c.park_it, not c.park_outside, c.component or ""))
        return RecallsInfo(
            checked=True,
            count=len(results),
            park_it=park_it,
            park_outside=park_outside,
            campaigns=campaigns[:8],
        )


def _split_components(raw: object) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        parts = [str(item).strip() for item in raw]
    else:
        parts = [part.strip() for part in str(raw).replace(";", ",").split(",")]
    return [part for part in parts if part]


async def fetch_model_issues(make: str, model: str, model_year: str) -> ModelIssuesInfo:
    """Aggregate NHTSA owner complaints for this Y/M/M as common-issue signals."""
    params = {"make": make, "model": model, "modelYear": model_year}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(COMPLAINTS_URL, params=params, headers=_HEADERS)
        resp.raise_for_status()
        payload = resp.json()
        results = payload.get("results") or payload.get("Results") or []

    component_counts: Counter[str] = Counter()
    crash_count = 0
    fire_count = 0
    injury_count = 0
    death_count = 0
    for row in results:
        if row.get("crash"):
            crash_count += 1
        if row.get("fire"):
            fire_count += 1
        injury_count += int(row.get("numberOfInjuries") or 0)
        death_count += int(row.get("numberOfDeaths") or 0)
        for component in _split_components(row.get("components") or row.get("Components")):
            # Normalize noisy ALL CAPS labels for grouping.
            component_counts[component.title()] += 1

    top = [
        ComplaintComponent(component=name, count=count)
        for name, count in component_counts.most_common(6)
    ]
    return ModelIssuesInfo(
        checked=True,
        complaint_count=len(results),
        crash_count=crash_count,
        fire_count=fire_count,
        injury_count=injury_count,
        death_count=death_count,
        top_components=top,
    )
