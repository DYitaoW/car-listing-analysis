import io

import pytest
from PIL import Image


def _photo() -> bytes:
    image = Image.new("RGB", (640, 480), (0, 0, 0))
    pixels = image.load()
    for y in range(image.size[1]):
        for x in range(image.size[0]):
            pixels[x, y] = ((x * 3) % 255, (y * 5) % 255, 40)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_upload_runs_analysis_and_returns_a_report(client):
    created = await client.post(
        "/listings",
        json={
            "title": "2018 Honda Civic LX",
            "description": "Garage kept and accident-free. No rust.",
            "price": 900,
            "vin": None,
            "sourceUrl": None,
        },
    )
    assert created.status_code == 201, created.text
    listing_id = created.json()["id"]

    photo = _photo()
    uploaded = await client.post(
        f"/listings/{listing_id}/images",
        files=[
            ("files", ("front.png", photo, "image/png")),
            ("files", ("side.png", photo, "image/png")),
        ],
    )
    assert uploaded.status_code == 200, uploaded.text
    assert uploaded.json()["status"] == "pending"

    fetched = await client.get(f"/listings/{listing_id}")
    assert fetched.status_code == 200, fetched.text
    body = fetched.json()
    assert body["status"] == "completed", body
    assert body["error"] is None
    report = body["report"]
    assert report["riskScore"] >= 8
    assert report["historyChecked"] is False
    assert report["titleVerified"] is False
    assert report["imageFindings"]
    codes = {flag["code"] for flag in report["flags"]}
    assert "duplicate_photos" in codes
    assert "price_too_good" in codes
    assert "few_images" in codes
    claims = {check["claim"]: check["verdict"] for check in report["claimChecks"]}
    assert claims["no rust"] == "unclear"
    assert "imageFindings" in report

    again = await client.post(f"/listings/{listing_id}/analyze")
    assert again.status_code == 200
    refreshed = await client.get(f"/listings/{listing_id}")
    assert refreshed.json()["status"] == "completed"
    assert refreshed.json()["report"]["riskScore"] == report["riskScore"]


@pytest.mark.asyncio
async def test_health_and_local_cors(client):
    health = await client.get("/health")
    assert health.status_code == 200
    assert health.json() == {
        "status": "ok",
        "storage": "local",
        "llmProvider": "stub",
        "jobBackend": "inprocess",
        "auth": "disabled",
    }

    preflight = await client.options(
        "/listings",
        headers={
            "Origin": "http://192.168.1.20:8081",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )
    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == "http://192.168.1.20:8081"
    assert preflight.headers.get("access-control-allow-credentials") != "true"

    blocked = await client.get("/health", headers={"Origin": "https://evil.example"})
    assert "access-control-allow-origin" not in blocked.headers


@pytest.mark.asyncio
async def test_empty_upload_is_rejected(client):
    created = await client.post(
        "/listings",
        json={"title": "Empty", "description": "No photo bytes.", "price": 4000},
    )
    listing_id = created.json()["id"]
    rejected = await client.post(
        f"/listings/{listing_id}/images",
        files=[("files", ("empty.png", b"", "image/png"))],
    )
    assert rejected.status_code == 400
