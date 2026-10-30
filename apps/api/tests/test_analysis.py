import io

import pytest
from PIL import Image

from listing_validator_api.analysis import analyze_listing
from listing_validator_api.config import get_settings
from listing_validator_api.schemas import AttributeCheck, ClaimCheck, RecallsInfo, RiskFlag, VinDecoded
from listing_validator_api.vision import (
    ImagePayload,
    VlmAssessment,
    inspect_images,
    parse_vlm_payload,
)


def _png(size: tuple[int, int], paint) -> bytes:
    image = Image.new("RGB", size, (0, 0, 0))
    paint(image)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def _noise(image: Image.Image) -> None:
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            pixels[x, y] = ((x * 13) % 255, (y * 7) % 255, (x + y) % 255)


def _jpeg_with_date(when: str) -> bytes:
    image = Image.new("RGB", (320, 240), (10, 20, 30))
    _noise(image)
    exif = image.getexif()
    exif[306] = when
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", exif=exif)
    return buffer.getvalue()


def _payload(data: bytes, name: str = "photo.png") -> ImagePayload:
    return ImagePayload(data=data, content_type="image/png", filename=name)


@pytest.mark.asyncio
async def test_local_inspection_flags_price_claims_and_photo_problems():
    solid = _png((400, 300), lambda image: None)
    tiny = _png((32, 32), _noise)
    report = await analyze_listing(
        title="2018 Honda Civic LX",
        description="Garage kept, no rust, like new.",
        price=800,
        vin=None,
        images=[_payload(solid, "solid.png"), _payload(solid, "solid-copy.png"), _payload(tiny, "tiny.png")],
    )

    codes = {flag.code for flag in report.flags}
    assert "price_too_good" in codes
    assert "blank_image" in codes
    assert "duplicate_photos" in codes
    assert "tiny_image" in codes
    assert report.history_checked is False
    assert report.title_verified is False
    assert any(check.claim == "no rust" and check.verdict == "unclear" for check in report.claim_checks)
    assert any("solid.png" in line for line in report.image_findings)
    assert "LLM_PROVIDER" in report.summary
    assert 0 <= report.risk_score <= 100


@pytest.mark.asyncio
async def test_vin_word_boundary_and_model_conflict(monkeypatch):
    async def fake_decode(_vin: str) -> VinDecoded:
        return VinDecoded(make="Ford", model="F-150", model_year="2016", body_class="Pickup")

    async def fake_recalls(_make: str, _model: str, _year: str) -> RecallsInfo:
        return RecallsInfo(checked=True, count=1, park_it=False, park_outside=False)

    monkeypatch.setattr("listing_validator_api.analysis.decode_vin", fake_decode)
    monkeypatch.setattr("listing_validator_api.analysis.fetch_recalls", fake_recalls)

    photo = _payload(_png((640, 480), _noise), "truck.png")
    affordable = await analyze_listing(
        title="Affordable daily driver",
        description="Runs great.",
        price=9000,
        vin="1FTEW1EP4GFA00001",
        images=[photo, photo, photo],
    )
    assert any(flag.code == "vin_spec_mismatch" for flag in affordable.flags)
    assert affordable.vin_match.matches_listing is False
    assert affordable.vin_match.decoded is not None
    assert affordable.vin_match.decoded.make == "Ford"

    named = await analyze_listing(
        title="2016 Ford F-150 XLT",
        description="Garage kept.",
        price=18000,
        vin="1FTEW1EP4GFA00001",
        images=[photo, photo, photo],
    )
    assert named.vin_match.matches_listing is True
    assert all(flag.code != "vin_spec_mismatch" for flag in named.flags)
    assert any(flag.code == "open_recalls" for flag in named.flags)
    assert any(check.verdict == "unclear" and check.claim == "garage kept claim" for check in named.claim_checks)


@pytest.mark.asyncio
async def test_model_only_title_still_matches_vin(monkeypatch):
    async def fake_decode(_vin: str) -> VinDecoded:
        return VinDecoded(make="Honda", model="Civic", model_year="2018", body_class="Sedan")

    async def fake_recalls(_make: str, _model: str, _year: str) -> RecallsInfo:
        return RecallsInfo(checked=True, count=0)

    monkeypatch.setattr("listing_validator_api.analysis.decode_vin", fake_decode)
    monkeypatch.setattr("listing_validator_api.analysis.fetch_recalls", fake_recalls)
    photo = _payload(_png((640, 480), _noise))
    report = await analyze_listing(
        title="2018 Civic LX",
        description="Clean commuter car with service records.",
        price=14500,
        vin="2HGFC2F69JH000001",
        images=[photo, photo, photo],
    )
    assert report.vin_match.matches_listing is True
    assert "2018 Honda Civic" in report.summary


@pytest.mark.asyncio
async def test_vlm_results_merge_into_the_report(monkeypatch):
    async def fake_vlm(**_kwargs):
        return VlmAssessment(
            summary="Photos show a silver sedan with a creased front bumper.",
            flags=[
                RiskFlag(code="bumper_damage", severity="medium", message="Front bumper is creased."),
            ],
            claim_checks=[
                ClaimCheck(claim="no rust", verdict="supported", detail="No rust is visible on the panels shown."),
            ],
            attribute_checks=[
                AttributeCheck(
                    attribute="color",
                    expected="silver",
                    source="listing",
                    listing_match=True,
                    photo_evidence="supported",
                    detail="Exterior paint looks silver in the photos.",
                )
            ],
            observed_make="Honda",
            observed_model="Civic",
            observed_color="silver",
            visible_damage=True,
            photo_text_consistent=False,
            risk_adjustment=10,
        )

    monkeypatch.setattr("listing_validator_api.analysis.analyze_with_vlm", fake_vlm)
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "test-key")
    get_settings.cache_clear()
    try:
        photo = _payload(_png((640, 480), _noise))
        report = await analyze_listing(
            title="2018 Honda Civic",
            description="No rust, perfect condition.",
            price=12000,
            vin=None,
            images=[photo, photo, photo],
        )
    finally:
        monkeypatch.setenv("LLM_PROVIDER", "stub")
        get_settings.cache_clear()

    codes = {flag.code for flag in report.flags}
    assert "bumper_damage" in codes
    assert "photo_text_mismatch" in codes
    rust = next(check for check in report.claim_checks if check.claim == "no rust")
    assert rust.verdict == "supported"
    perfect = next(check for check in report.claim_checks if "perfect" in check.claim)
    assert perfect.verdict == "unclear"
    assert "silver sedan" in report.summary
    assert any("silver Honda Civic" in line for line in report.image_findings)


def test_parse_vlm_payload_strips_fences_and_clamps_adjustment():
    raw = """```json
    {"summary":"A white truck.","photo_text_consistent":"false","visible_damage":false,
     "observed_make":"Ford","observed_model":null,"risk_adjustment":90,
     "flags":[{"code":"Odd Code!","severity":"nope","message":"Glare hides the plate."}],
     "claim_checks":[{"claim":"like new","verdict":"maybe","detail":"Could not tell."}]}
    ```"""
    parsed = parse_vlm_payload(raw)
    assert parsed.summary == "A white truck."
    assert parsed.photo_text_consistent is False
    assert parsed.risk_adjustment == 30
    assert parsed.flags[0].code == "odd_code"
    assert parsed.flags[0].severity == "low"
    assert parsed.claim_checks[0].verdict == "unclear"
    assert parsed.observed_model is None


def test_photo_timestamps_far_apart_are_flagged():
    images = [
        ImagePayload(_jpeg_with_date("2016:01:01 10:00:00"), "image/jpeg", "early.jpg"),
        ImagePayload(_jpeg_with_date("2024:06:01 10:00:00"), "image/jpeg", "late.jpg"),
    ]
    inspection = inspect_images(images)
    assert any(flag.code == "photo_dates_diverge" for flag in inspection.flags)
    assert any("2016-01-01" in line and "2024-06-01" in line for line in inspection.findings)


def test_unreadable_upload_is_flagged():
    inspection = inspect_images([ImagePayload(b"not-an-image", "image/jpeg", "notes.txt")])
    assert inspection.readable_count == 0
    assert inspection.flags[0].code == "unreadable_image"


@pytest.mark.asyncio
async def test_vin_trim_mismatch_against_listing_text(monkeypatch):
    async def fake_decode(_vin: str) -> VinDecoded:
        return VinDecoded(
            make="Honda",
            model="Accord",
            model_year="2018",
            body_class="Sedan/Saloon",
            trim="Sport",
            drive_type="4x2",
            doors="4",
            fuel_type="Gasoline",
        )

    async def fake_recalls(_make: str, _model: str, _year: str) -> RecallsInfo:
        return RecallsInfo(checked=True, count=0)

    monkeypatch.setattr("listing_validator_api.analysis.decode_vin", fake_decode)
    monkeypatch.setattr("listing_validator_api.analysis.fetch_recalls", fake_recalls)
    photo = _payload(_png((640, 480), _noise))
    report = await analyze_listing(
        title="2018 Honda Accord LX — silver",
        description="Clean LX sedan, silver exterior, garage kept.",
        price=16000,
        vin="1HGCV1F3XJA000001",
        images=[photo, photo, photo],
    )
    assert any(flag.code == "vin_trim_mismatch" for flag in report.flags)
    trim = next(c for c in report.attribute_checks if c.attribute == "trim")
    assert trim.expected == "Sport"
    assert trim.listing_match is False
    color = next(c for c in report.attribute_checks if c.attribute == "color")
    assert color.expected == "silver"
    assert color.source == "listing"
    assert report.vin_match.decoded is not None
    assert report.vin_match.decoded.trim == "Sport"


@pytest.mark.asyncio
async def test_vin_trim_matches_listing_and_awaits_photo_proof(monkeypatch):
    async def fake_decode(_vin: str) -> VinDecoded:
        return VinDecoded(make="Honda", model="Accord", model_year="2018", trim="Sport")

    async def fake_recalls(_make: str, _model: str, _year: str) -> RecallsInfo:
        return RecallsInfo(checked=True, count=0)

    monkeypatch.setattr("listing_validator_api.analysis.decode_vin", fake_decode)
    monkeypatch.setattr("listing_validator_api.analysis.fetch_recalls", fake_recalls)
    photo = _payload(_png((640, 480), _noise))
    report = await analyze_listing(
        title="2018 Honda Accord Sport",
        description="Black Sport trim.",
        price=17000,
        vin="1HGCV1F3XJA000001",
        images=[photo, photo, photo],
    )
    trim = next(c for c in report.attribute_checks if c.attribute == "trim")
    assert trim.listing_match is True
    assert trim.photo_evidence == "unclear"
    assert "LLM_PROVIDER" in trim.detail
    assert all(flag.code != "vin_trim_mismatch" for flag in report.flags)
