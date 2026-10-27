from __future__ import annotations

import html as html_lib
import json
import re
from dataclasses import dataclass, field
from urllib.parse import urlparse

import httpx

FACEBOOK_HOSTS = {
    "facebook.com",
    "www.facebook.com",
    "m.facebook.com",
    "web.facebook.com",
    "fb.com",
    "www.fb.com",
}

# Hosts we will fetch listing photos from after import (SSRF allow-list).
IMAGE_HOST_SUFFIXES = (
    "fbcdn.net",
    "facebook.com",
    "fb.com",
    "fbsbx.com",
)

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
)

_VIN_RE = re.compile(r"\b([A-HJ-NPR-Z0-9]{17})\b", re.IGNORECASE)
_PRICE_RE = re.compile(
    r"(?:\$|USD\s*)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)",
    re.IGNORECASE,
)
_META_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\']([^"\']+)["\'][^>]+content=["\']([^"\']*)["\'][^>]*>',
    re.IGNORECASE,
)
_META_RE_REV = re.compile(
    r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']([^"\']+)["\'][^>]*>',
    re.IGNORECASE,
)
_JSON_LD_RE = re.compile(
    r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
    re.IGNORECASE | re.DOTALL,
)
_OG_IMAGE_TAG_RE = re.compile(
    r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)["\']',
    re.IGNORECASE,
)
_IMG_SRC_RE = re.compile(r'<img[^>]+src=["\'](https?://[^"\']+)["\']', re.IGNORECASE)


class MarketplaceImportError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.status_code = status_code


@dataclass
class MarketplaceDraft:
    source_url: str
    title: str = ""
    description: str = ""
    price: float | None = None
    vin: str | None = None
    image_urls: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    partial: bool = False


def normalize_marketplace_url(raw: str) -> str:
    text = (raw or "").strip()
    if not text:
        raise MarketplaceImportError("Paste a Facebook Marketplace listing URL.")
    if "://" not in text:
        text = "https://" + text
    parsed = urlparse(text)
    host = (parsed.hostname or "").lower()
    if host not in FACEBOOK_HOSTS:
        raise MarketplaceImportError(
            "Only Facebook Marketplace links are supported (facebook.com/marketplace/...)."
        )
    path = parsed.path or ""
    if "/marketplace/" not in path and "/marketplace/item/" not in path:
        # Allow share links that still resolve under marketplace item paths after redirects.
        if "marketplace" not in path.lower() and "marketplace" not in (parsed.query or "").lower():
            raise MarketplaceImportError(
                "URL must be a Facebook Marketplace listing (…/marketplace/item/…)."
            )
    # Strip tracking noise but keep path/query needed for the item.
    cleaned = f"https://www.facebook.com{path}"
    if parsed.query:
        cleaned += f"?{parsed.query}"
    return cleaned


def is_allowed_image_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").lower()
    if not host:
        return False
    return any(host == suffix or host.endswith("." + suffix) for suffix in IMAGE_HOST_SUFFIXES)


def _meta_map(html: str) -> dict[str, str]:
    found: dict[str, str] = {}
    for prop, content in _META_RE.findall(html):
        found[prop.lower()] = html_lib.unescape(content).strip()
    for content, prop in _META_RE_REV.findall(html):
        found.setdefault(prop.lower(), html_lib.unescape(content).strip())
    return found


def _first_json_ld(html: str) -> dict | list | None:
    for block in _JSON_LD_RE.findall(html):
        raw = html_lib.unescape(block).strip()
        if not raw:
            continue
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            continue
    return None


def _walk_json(node: object, bag: dict[str, list[str]]) -> None:
    """Collect useful string fields from nested Facebook / JSON-LD payloads."""
    if isinstance(node, dict):
        for key, value in node.items():
            key_l = str(key).lower()
            if isinstance(value, str):
                text = value.strip()
                if not text:
                    continue
                if key_l in {"title", "name", "marketplace_listing_title"}:
                    bag["titles"].append(text)
                elif key_l in {"description", "redacted_description", "marketplace_listing_description"}:
                    bag["descriptions"].append(text)
                elif key_l in {"price", "amount", "formatted_price", "current_price"}:
                    bag["prices"].append(text)
                elif key_l in {"image", "url", "uri", "src"} and text.startswith("http"):
                    if any(x in text for x in ("fbcdn", "scontent", "facebook.com")):
                        bag["images"].append(text.split("?")[0] if "fbcdn" in text else text)
                elif "vin" in key_l and len(text) >= 11:
                    bag["vins"].append(text)
            else:
                _walk_json(value, bag)
    elif isinstance(node, list):
        for item in node:
            _walk_json(item, bag)


def _extract_embedded_json(html: str) -> dict[str, list[str]]:
    bag: dict[str, list[str]] = {
        "titles": [],
        "descriptions": [],
        "prices": [],
        "images": [],
        "vins": [],
    }
    # Facebook often embeds large JSON blobs inside script tags.
    for match in re.finditer(r"<script[^>]*>(.*?)</script>", html, re.IGNORECASE | re.DOTALL):
        body = match.group(1)
        if "marketplace" not in body.lower() and "Marketplace" not in body:
            if '"price"' not in body and "fbcdn" not in body:
                continue
        # Try to find JSON object/array substrings.
        for candidate in re.findall(r"(\{.*\}|\[.*\])", body, re.DOTALL):
            if len(candidate) < 40 or len(candidate) > 2_000_000:
                continue
            try:
                parsed = json.loads(candidate)
            except json.JSONDecodeError:
                continue
            _walk_json(parsed, bag)
            if bag["titles"] and (bag["descriptions"] or bag["prices"]):
                return bag
    ld = _first_json_ld(html)
    if ld is not None:
        _walk_json(ld, bag)
    return bag


def _parse_price(text: str | None) -> float | None:
    if not text:
        return None
    match = _PRICE_RE.search(text.replace("\xa0", " "))
    if not match:
        # bare number in FB amount fields
        digits = re.sub(r"[^\d.]", "", text)
        if digits:
            try:
                return float(digits)
            except ValueError:
                return None
        return None
    try:
        return float(match.group(1).replace(",", ""))
    except ValueError:
        return None


def _find_vin(*texts: str) -> str | None:
    for text in texts:
        if not text:
            continue
        match = _VIN_RE.search(text)
        if match:
            return match.group(1).upper()
    return None


def _dedupe(urls: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for url in urls:
        clean = url.strip()
        if not clean or clean in seen:
            continue
        if not is_allowed_image_url(clean):
            continue
        seen.add(clean)
        out.append(clean)
    return out


def parse_marketplace_html(html: str, source_url: str) -> MarketplaceDraft:
    meta = _meta_map(html)
    bag = _extract_embedded_json(html)

    title = (
        bag["titles"][0]
        if bag["titles"]
        else meta.get("og:title")
        or meta.get("twitter:title")
        or meta.get("title")
        or ""
    )
    # FB titles often look like: "$8,900 · 2016 Honda Accord · Indianapolis"
    description = (
        bag["descriptions"][0]
        if bag["descriptions"]
        else meta.get("og:description")
        or meta.get("description")
        or meta.get("twitter:description")
        or ""
    )

    price = None
    for candidate in [*bag["prices"], title, description, meta.get("product:price:amount", "")]:
        price = _parse_price(candidate)
        if price is not None:
            break

    # Prefer a cleaner vehicle title when FB prepends price.
    clean_title = title
    if clean_title.startswith("$") or " · " in clean_title:
        parts = [p.strip() for p in clean_title.split("·")]
        without_price = [p for p in parts if not p.startswith("$") and not re.fullmatch(r"[\d,.]+", p)]
        if without_price:
            # Drop trailing location-only segment if many parts.
            clean_title = " · ".join(without_price[:2] if len(without_price) > 2 else without_price)

    images = list(bag["images"])
    images.extend(_OG_IMAGE_TAG_RE.findall(html))
    if meta.get("og:image"):
        images.append(meta["og:image"])
    images.extend(_IMG_SRC_RE.findall(html))
    image_urls = _dedupe(images)[:12]

    vin = None
    if bag["vins"]:
        vin = _find_vin(*bag["vins"])
    if not vin:
        vin = _find_vin(description, title, clean_title)

    warnings: list[str] = []
    login_wall = "log in" in html.lower() and "marketplace" in html.lower() and not description
    if login_wall or (not clean_title and not description):
        warnings.append(
            "Facebook returned a sparse page (often a login wall). Paste title/description manually if fields look empty."
        )

    if not image_urls:
        warnings.append("No listing photos were found in the page HTML. Upload photos yourself.")

    if not clean_title and not description:
        raise MarketplaceImportError(
            "Could not extract listing details from that Facebook page. "
            "The listing may be private, removed, or blocked from automated fetch.",
            status_code=422,
        )

    partial = bool(warnings) or not description or price is None
    return MarketplaceDraft(
        source_url=source_url,
        title=(clean_title or title or "Facebook Marketplace listing")[:512],
        description=description or title or "Imported from Facebook Marketplace.",
        price=price,
        vin=vin,
        image_urls=image_urls,
        warnings=warnings,
        partial=partial,
    )


async def fetch_marketplace_listing(url: str) -> MarketplaceDraft:
    source = normalize_marketplace_url(url)
    headers = {
        "User-Agent": _USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cache-Control": "no-cache",
    }
    try:
        async with httpx.AsyncClient(
            timeout=25.0,
            follow_redirects=True,
            headers=headers,
        ) as client:
            response = await client.get(source)
    except httpx.HTTPError as exc:
        raise MarketplaceImportError(
            f"Could not reach Facebook Marketplace ({exc.__class__.__name__}).",
            status_code=502,
        ) from exc

    final_url = str(response.url)
    if response.status_code >= 400:
        raise MarketplaceImportError(
            f"Facebook returned HTTP {response.status_code} for that listing.",
            status_code=502,
        )

    # Re-validate final host after redirects.
    try:
        normalize_marketplace_url(final_url)
    except MarketplaceImportError:
        # Some redirects land on facebook.com/login — still try to parse body.
        pass

    draft = parse_marketplace_html(response.text, source)
    draft.source_url = source
    return draft


async def download_allowed_images(urls: list[str], limit: int = 8) -> list[tuple[str, bytes, str]]:
    """Download remote marketplace images. Returns (filename, bytes, content_type)."""
    selected = [u for u in urls if is_allowed_image_url(u)][:limit]
    if not selected:
        return []

    headers = {
        "User-Agent": _USER_AGENT,
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://www.facebook.com/",
    }
    out: list[tuple[str, bytes, str]] = []
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, headers=headers) as client:
        for index, url in enumerate(selected):
            try:
                response = await client.get(url)
            except httpx.HTTPError:
                continue
            if response.status_code >= 400:
                continue
            content_type = response.headers.get("content-type", "image/jpeg").split(";")[0].strip()
            if not content_type.startswith("image/"):
                continue
            data = response.content
            if not data or len(data) > 15 * 1024 * 1024:
                continue
            ext = "jpg"
            if "png" in content_type:
                ext = "png"
            elif "webp" in content_type:
                ext = "webp"
            out.append((f"marketplace-{index + 1}.{ext}", data, content_type))
    return out
