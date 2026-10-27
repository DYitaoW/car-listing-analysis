import pytest

from listing_validator_api.marketplace import (
    MarketplaceImportError,
    normalize_marketplace_url,
    parse_marketplace_html,
)


def test_normalize_marketplace_url_accepts_item_links():
    url = normalize_marketplace_url(
        "https://www.facebook.com/marketplace/item/1234567890/?ref=search"
    )
    assert "/marketplace/item/1234567890" in url


def test_normalize_rejects_non_facebook():
    with pytest.raises(MarketplaceImportError):
        normalize_marketplace_url("https://craigslist.org/cto/123")


def test_parse_marketplace_html_extracts_fields():
    html = (pytest.importorskip("pathlib").Path(__file__).parent / "fixtures/marketplace_sample.html").read_text(
        encoding="utf-8"
    )
    draft = parse_marketplace_html(
        html,
        "https://www.facebook.com/marketplace/item/1234567890",
    )
    assert "Honda Accord" in draft.title
    assert "Garage kept" in draft.description
    assert draft.price == 8900.0
    assert draft.vin == "1HGCT1B86GA000001"
    assert len(draft.image_urls) >= 2
    assert all("fbcdn.net" in u for u in draft.image_urls)


@pytest.mark.asyncio
async def test_import_endpoint_uses_parser(monkeypatch, client):
    from listing_validator_api import marketplace as mp

    async def fake_fetch(url: str):
        html = (
            __import__("pathlib").Path(__file__).parent / "fixtures/marketplace_sample.html"
        ).read_text(encoding="utf-8")
        return mp.parse_marketplace_html(html, mp.normalize_marketplace_url(url))

    monkeypatch.setattr(mp, "fetch_marketplace_listing", fake_fetch)

    # Patch the route's imported symbol as well.
    import listing_validator_api.routes as routes

    monkeypatch.setattr(routes, "fetch_marketplace_listing", fake_fetch)

    response = await client.post(
        "/import/marketplace",
        json={"url": "https://www.facebook.com/marketplace/item/1234567890"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"]
    assert body["price"] == 8900.0
    assert body["vin"] == "1HGCT1B86GA000001"
    assert body["imageUrls"]
