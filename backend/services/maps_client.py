"""
Google Maps Routes API client with a built-in mock fallback.

When ROUTING_MODE=mock, returns synthetic but realistic route data
so the full pipeline works without an API key.
"""

import hashlib
import math
import random
from dataclasses import dataclass

import httpx

from core.emission_factors import TransitMode


@dataclass
class RawRouteResult:
    """Raw result from the routing provider (or mock)."""
    mode: TransitMode
    distance_km: float
    duration_min: float
    segments: list[dict]  # [{mode, distance_km, duration_min, description}]


# ---------------------------------------------------------------------------
# Mock routing engine
# ---------------------------------------------------------------------------

def _deterministic_seed(origin: str, destination: str) -> int:
    """Generate a stable seed from origin+destination so mock results are repeatable."""
    h = hashlib.md5(f"{origin}|{destination}".encode()).hexdigest()
    return int(h[:8], 16)


def _haversine_estimate(origin: str, destination: str) -> float:
    """
    Rough distance estimate in km.
    If inputs look like 'lat,lng' pairs, compute haversine.
    Otherwise, use a hash-based synthetic distance (5-40 km range).
    """
    try:
        lat1, lng1 = map(float, origin.split(","))
        lat2, lng2 = map(float, destination.split(","))
        R = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlng = math.radians(lng2 - lng1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlng / 2) ** 2
        )
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    except (ValueError, AttributeError):
        rng = random.Random(_deterministic_seed(origin, destination))
        return round(rng.uniform(5.0, 40.0), 1)


# Speed assumptions for mock (km/h)
_MOCK_SPEEDS: dict[TransitMode, float] = {
    TransitMode.DRIVING: 45.0,
    TransitMode.CARPOOL_2: 45.0,
    TransitMode.CARPOOL_4: 45.0,
    TransitMode.BUS: 20.0,
    TransitMode.LIGHT_RAIL: 35.0,
    TransitMode.SUBWAY: 40.0,
    TransitMode.COMMUTER_RAIL: 50.0,
    TransitMode.WALKING: 5.0,
    TransitMode.BICYCLING: 15.0,
    TransitMode.E_SCOOTER: 12.0,
    TransitMode.RIDESHARE: 40.0,
}

# Distance multiplier vs straight-line (road detour factor)
_DETOUR: dict[TransitMode, float] = {
    TransitMode.DRIVING: 1.3,
    TransitMode.CARPOOL_2: 1.3,
    TransitMode.CARPOOL_4: 1.35,
    TransitMode.BUS: 1.5,
    TransitMode.LIGHT_RAIL: 1.2,
    TransitMode.SUBWAY: 1.15,
    TransitMode.COMMUTER_RAIL: 1.25,
    TransitMode.WALKING: 1.35,
    TransitMode.BICYCLING: 1.25,
    TransitMode.E_SCOOTER: 1.25,
    TransitMode.RIDESHARE: 1.35,
}


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


def mock_route(
    origin: str, destination: str, mode: TransitMode
) -> RawRouteResult:
    """Generate a synthetic but deterministic route."""
    straight_km = _haversine_estimate(origin, destination)
    detour = _DETOUR.get(mode, 1.3)
    distance_km = round(straight_km * detour, 2)
    speed = _MOCK_SPEEDS.get(mode, 30.0)
    duration_min = round((distance_km / speed) * 60, 1)

    segments = _build_transit_segments(mode, distance_km, duration_min)

    return RawRouteResult(
        mode=mode,
        distance_km=distance_km,
        duration_min=duration_min,
        segments=segments,
    )


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
        "X-Goog-FieldMask": "routes.distanceMeters,routes.staticDuration",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(ROUTES_API_URL, json=body, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    route = data["routes"][0]
    total_km = route["distanceMeters"] / 1000.0
    total_min = _parse_duration(route["staticDuration"])

    # Use _build_transit_segments for all modes:
    # - Non-transit (driving, cycling, etc.) → single clean segment, no micro-steps
    # - Transit (bus, rail) → walk → transit → walk with correct durations
    segments = _build_transit_segments(mode, total_km, total_min)

    return RawRouteResult(
        mode=mode,
        distance_km=round(total_km, 2),
        duration_min=round(total_min, 1),
        segments=segments,
    )


# ---------------------------------------------------------------------------
# Unified interface
# ---------------------------------------------------------------------------

async def fetch_route(
    origin: str,
    destination: str,
    mode: TransitMode,
    routing_mode: str = "mock",
    api_key: str = "",
) -> RawRouteResult:
    """Fetch a route via the configured provider. Falls back to mock on API errors."""
    if routing_mode == "live":
        try:
            return await live_route(origin, destination, mode, api_key)
        except Exception as e:
            print(f"[WARN] Live route failed for {mode.value}: {e}. Falling back to mock.")
            return mock_route(origin, destination, mode)
    return mock_route(origin, destination, mode)


async def fetch_all_routes(
    origin: str,
    destination: str,
    modes: list[TransitMode],
    routing_mode: str = "mock",
    api_key: str = "",
) -> list[RawRouteResult]:
    """Fetch routes for all requested modes."""
    results = []
    for mode in modes:
        result = await fetch_route(origin, destination, mode, routing_mode, api_key)
        results.append(result)
    return results
