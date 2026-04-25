"""
Google Maps Routes API client.

Primary path: live Google Maps Routes API.
Fallback path: deterministic haversine-based mock router, used when no API
key is configured or when the live call fails for any reason. Per
`.kiro/steering/agent-architecture.md`, every external call must have a
fallback so `/plan-route` never returns 500 because of an upstream outage.
"""

import logging
import math
from dataclasses import dataclass

import httpx

from core.emission_factors import TransitMode

logger = logging.getLogger(__name__)


@dataclass
class RawRouteResult:
    """Raw result from the routing provider."""
    mode: TransitMode
    distance_km: float
    duration_min: float
    segments: list[dict]  # [{mode, distance_km, duration_min, description}]
    polyline: str | None = None


# ---------------------------------------------------------------------------
# Segment building
# ---------------------------------------------------------------------------

def _build_transit_segments(
    mode: TransitMode, total_km: float, total_min: float
) -> list[dict]:
    """
    For transit modes, generate realistic multi-segment routes
    (e.g., walk → rail → walk). For driving/walk/bike, single segment.
    """
    multi_segment_modes = {
        TransitMode.BUS,
        TransitMode.LIGHT_RAIL,
        TransitMode.SUBWAY,
        TransitMode.COMMUTER_RAIL,
    }

    if mode not in multi_segment_modes:
        return [
            {
                "mode": mode.value,
                "distance_km": round(total_km, 2),
                "duration_min": round(total_min, 1),
                "description": f"{mode.value} for {total_km:.1f} km",
            }
        ]

    # Walk → Transit → Walk
    walk_start_km = round(min(0.4, total_km * 0.05), 2)
    walk_end_km = round(min(0.3, total_km * 0.04), 2)
    transit_km = round(total_km - walk_start_km - walk_end_km, 2)

    walk_start_min = round(walk_start_km / 5.0 * 60, 1)
    walk_end_min = round(walk_end_km / 5.0 * 60, 1)
    wait_min = 5.0  # average wait

    # If walk + wait overhead exceeds total trip time, scale it down
    # so the transit leg always gets at least 20% of total duration.
    overhead = walk_start_min + walk_end_min + wait_min
    if overhead >= total_min:
        scale = (total_min * 0.8) / overhead
        walk_start_min = round(walk_start_min * scale, 1)
        walk_end_min = round(walk_end_min * scale, 1)
        wait_min = round(wait_min * scale, 1)

    transit_min = round(total_min - walk_start_min - walk_end_min - wait_min, 1)

    return [
        {
            "mode": "walking",
            "distance_km": walk_start_km,
            "duration_min": walk_start_min,
            "description": "Walk to station",
        },
        {
            "mode": mode.value,
            "distance_km": transit_km,
            "duration_min": transit_min,
            "description": f"{mode.value} ({transit_km:.1f} km)",
        },
        {
            "mode": "walking",
            "distance_km": walk_end_km,
            "duration_min": walk_end_min,
            "description": "Walk to destination",
        },
    ]


# ---------------------------------------------------------------------------
# Live routing (Google Maps Routes API)
# ---------------------------------------------------------------------------

_MODE_TO_GOOGLE = {
    TransitMode.DRIVING: "DRIVE",
    TransitMode.CARPOOL_2: "DRIVE",
    TransitMode.CARPOOL_4: "DRIVE",
    TransitMode.RIDESHARE: "DRIVE",
    TransitMode.WALKING: "WALK",
    TransitMode.BICYCLING: "BICYCLE",
    TransitMode.BUS: "TRANSIT",
    TransitMode.LIGHT_RAIL: "TRANSIT",
    TransitMode.SUBWAY: "TRANSIT",
    TransitMode.COMMUTER_RAIL: "TRANSIT",
    TransitMode.E_SCOOTER: "WALK",  # no scooter mode; approximate
}

ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes"


def _parse_latlng(location: str) -> dict:
    """Parse 'lat,lng' string or treat as address."""
    try:
        lat, lng = map(float, location.split(","))
        return {"location": {"latLng": {"latitude": lat, "longitude": lng}}}
    except (ValueError, AttributeError):
        return {"address": location}


def _parse_duration(dur_str: str) -> float:
    """Parse '123s' duration string to minutes."""
    return int(dur_str.rstrip("s")) / 60.0


async def live_route(
    origin: str, destination: str, mode: TransitMode, api_key: str
) -> RawRouteResult:
    """Call Google Maps Routes API for a real route."""
    google_mode = _MODE_TO_GOOGLE.get(mode, "DRIVE")

    body = {
        "origin": _parse_latlng(origin),
        "destination": _parse_latlng(destination),
        "travelMode": google_mode,
        "computeAlternativeRoutes": False,
    }

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": api_key,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.staticDuration,routes.polyline.encodedPolyline",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(ROUTES_API_URL, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    route = data["routes"][0]
    total_km = route["distanceMeters"] / 1000.0
    total_min = _parse_duration(route["staticDuration"])
    encoded_polyline = route.get("polyline", {}).get("encodedPolyline")

    # Use _build_transit_segments for all modes:
    # - Non-transit (driving, cycling, etc.) → single clean segment, no micro-steps
    # - Transit (bus, rail) → walk → transit → walk with correct durations
    segments = _build_transit_segments(mode, total_km, total_min)

    return RawRouteResult(
        mode=mode,
        distance_km=round(total_km, 2),
        duration_min=round(total_min, 1),
        segments=segments,
        polyline=encoded_polyline,
    )


# ---------------------------------------------------------------------------
# Mock fallback (haversine + per-mode speed/detour tables)
# ---------------------------------------------------------------------------

_MOCK_SPEEDS: dict[TransitMode, float] = {
    TransitMode.DRIVING: 45.0,
    TransitMode.CARPOOL_2: 45.0,
    TransitMode.CARPOOL_4: 45.0,
    TransitMode.RIDESHARE: 45.0,
    TransitMode.WALKING: 5.0,
    TransitMode.BICYCLING: 18.0,
    TransitMode.E_SCOOTER: 14.0,
    TransitMode.BUS: 22.0,
    TransitMode.LIGHT_RAIL: 32.0,
    TransitMode.SUBWAY: 38.0,
    TransitMode.COMMUTER_RAIL: 50.0,
}

_DETOUR: dict[TransitMode, float] = {
    TransitMode.DRIVING: 1.30,
    TransitMode.CARPOOL_2: 1.30,
    TransitMode.CARPOOL_4: 1.30,
    TransitMode.RIDESHARE: 1.30,
    TransitMode.WALKING: 1.20,
    TransitMode.BICYCLING: 1.25,
    TransitMode.E_SCOOTER: 1.25,
    TransitMode.BUS: 1.45,
    TransitMode.LIGHT_RAIL: 1.20,
    TransitMode.SUBWAY: 1.15,
    TransitMode.COMMUTER_RAIL: 1.20,
}

_FALLBACK_KM = 12.0  # used when origin/destination are addresses, not lat,lng


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _try_parse_latlng(s: str) -> tuple[float, float] | None:
    try:
        lat, lng = map(float, s.split(","))
        return lat, lng
    except (ValueError, AttributeError):
        return None


def _encode_polyline(points: list[tuple[float, float]]) -> str:
    """Encode lat/lng pairs in Google's polyline algorithm format."""
    out: list[str] = []
    prev_lat = prev_lng = 0
    for lat, lng in points:
        lat_i = round(lat * 1e5)
        lng_i = round(lng * 1e5)
        for v in (lat_i - prev_lat, lng_i - prev_lng):
            v = ~(v << 1) if v < 0 else (v << 1)
            while v >= 0x20:
                out.append(chr((0x20 | (v & 0x1F)) + 63))
                v >>= 5
            out.append(chr(v + 63))
        prev_lat, prev_lng = lat_i, lng_i
    return "".join(out)


def mock_route(
    origin: str, destination: str, mode: TransitMode
) -> RawRouteResult:
    """Synthesize a route using haversine distance + per-mode speed/detour."""
    o = _try_parse_latlng(origin)
    d = _try_parse_latlng(destination)
    straight_km = _haversine_km(o[0], o[1], d[0], d[1]) if (o and d) else _FALLBACK_KM
    total_km = max(0.5, straight_km * _DETOUR.get(mode, 1.30))
    total_min = (total_km / _MOCK_SPEEDS.get(mode, 30.0)) * 60.0
    encoded = _encode_polyline([o, d]) if (o and d) else None
    return RawRouteResult(
        mode=mode,
        distance_km=round(total_km, 2),
        duration_min=round(total_min, 1),
        segments=_build_transit_segments(mode, total_km, total_min),
        polyline=encoded,
    )


# ---------------------------------------------------------------------------
# Unified interface
# ---------------------------------------------------------------------------

async def fetch_route(
    origin: str,
    destination: str,
    mode: TransitMode,
    api_key: str = "",
) -> RawRouteResult:
    """
    Fetch a route via Google Maps Routes API with a deterministic mock fallback
    when the API key is missing or the live call fails. Never raises — degraded
    routing is logged at WARN per the architecture contract.
    """
    if not api_key:
        return mock_route(origin, destination, mode)
    try:
        return await live_route(origin, destination, mode, api_key)
    except Exception as exc:
        logger.warning(
            "Live Routes API failed for mode=%s (%s) — falling back to mock",
            mode.value,
            exc,
        )
        return mock_route(origin, destination, mode)


async def fetch_all_routes(
    origin: str,
    destination: str,
    modes: list[TransitMode],
    api_key: str = "",
) -> list[RawRouteResult]:
    """Fetch routes for all requested modes."""
    results = []
    for mode in modes:
        result = await fetch_route(origin, destination, mode, api_key)
        results.append(result)
    return results
