"""Optional configured OSRM route adapter; no model-supplied URLs or coordinates."""
from datetime import datetime, timezone

import httpx


class RouteUnavailable(Exception):
    pass


async def route_day(base_url: str, items: list[dict], timeout_seconds: float = 8) -> list[dict]:
    if len(items) < 2:
        return []
    coordinates: list[str] = []
    for item in items:
        location = item.get("location") or {}
        lat, lng = location.get("lat"), location.get("lng")
        if not isinstance(lat, (int, float)) or not isinstance(lng, (int, float)) \
                or not -90 <= lat <= 90 or not -180 <= lng <= 180:
            raise RouteUnavailable("Canonical stop has no usable coordinates")
        coordinates.append(f"{lng:.6f},{lat:.6f}")
    path = "/route/v1/driving/" + ";".join(coordinates)
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=False) as client:
            response = await client.get(base_url.rstrip("/") + path, params={"overview": "false", "steps": "false"})
            response.raise_for_status()
            if len(response.content) > 65_536:
                raise RouteUnavailable("Route response too large")
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise RouteUnavailable("Routing provider unavailable") from exc
    routes = data.get("routes") if isinstance(data, dict) else None
    legs = routes[0].get("legs") if isinstance(routes, list) and routes and isinstance(routes[0], dict) else None
    if not isinstance(data, dict) or data.get("code") != "Ok" or not isinstance(legs, list) or len(legs) != len(items) - 1:
        raise RouteUnavailable("Routing provider returned an invalid route")
    fetched_at = datetime.now(timezone.utc).isoformat()
    output = []
    for index, leg in enumerate(legs):
        distance, duration = leg.get("distance"), leg.get("duration")
        if not isinstance(distance, (int, float)) or not isinstance(duration, (int, float)) \
                or distance < 0 or duration < 0:
            raise RouteUnavailable("Routing provider returned invalid leg data")
        output.append({"originPlaceId": items[index]["canonicalPlaceId"],
                       "destinationPlaceId": items[index + 1]["canonicalPlaceId"],
                       "distanceMeters": round(distance), "durationMinutes": round(duration / 60),
                       "mode": "DRIVE", "isIllustrative": False,
                       "source": "OSRM", "fetchedAt": fetched_at})
    return output
