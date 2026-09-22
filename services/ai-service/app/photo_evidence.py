from typing import Any
from urllib.parse import parse_qs, urlsplit


def approved_place_photo(value: Any) -> dict[str, Any] | None:
    """Keep only place-service-approved, credential-free HTTPS image evidence."""
    if not isinstance(value, dict) or value.get("displayApproved") is not True:
        return None
    if not isinstance(value.get("source"), str) or not value["source"]:
        return None
    url = value.get("url")
    if not isinstance(url, str) or len(url) > 2048:
        return None
    parsed = urlsplit(url)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        return None
    if any(key.casefold() in {"key", "api_key", "token", "secret"} for key in parse_qs(parsed.query)):
        return None
    attribution = value.get("attribution")
    if not isinstance(attribution, list):
        return None
    clean_attribution = [
        {"displayName": item["displayName"], "uri": item.get("uri")}
        for item in attribution[:4]
        if isinstance(item, dict) and isinstance(item.get("displayName"), str) and item["displayName"]
    ]
    return {"url": url, "source": value["source"], "attribution": clean_attribution,
            "fetchedAt": value.get("fetchedAt"), "displayApproved": True}
