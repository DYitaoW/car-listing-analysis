from __future__ import annotations

import httpx

from listing_validator_api.schemas import RecallsInfo, VinDecoded


VPIC_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json"
RECALLS_URL = "https://api.nhtsa.gov/recalls/recallsByVehicle"
_HEADERS = {"User-Agent": "SignalCheck/0.1 (vehicle listing risk signals)", "Accept": "application/json"}


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
            make=row.get("Make") or None,
            model=row.get("Model") or None,
            model_year=row.get("ModelYear") or None,
            body_class=row.get("BodyClass") or None,
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
