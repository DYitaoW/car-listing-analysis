from __future__ import annotations

import httpx

from listing_validator_api.schemas import RecallsInfo, VinDecoded


VPIC_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"
RECALLS_URL = "https://api.nhtsa.gov/recalls/recallsByVehicle"
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
        park_it = any(bool(r.get("parkIt")) for r in results)
        park_outside = any(bool(r.get("parkOutSide") or r.get("parkOutside")) for r in results)
        return RecallsInfo(
            checked=True,
            count=len(results),
            park_it=park_it,
            park_outside=park_outside,
        )
