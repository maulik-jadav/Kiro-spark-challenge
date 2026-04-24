"""
Routing Agent

Fetches all available routes between two points across multiple transit modes.
This agent is the data-gathering layer — it does not make decisions.
"""

from core.emission_factors import TransitMode
from services.maps_client import fetch_all_routes, RawRouteResult


# Default modes to evaluate when none are specified
DEFAULT_MODES = [
    TransitMode.DRIVING,
    TransitMode.LIGHT_RAIL,
    TransitMode.BUS,
    TransitMode.BICYCLING,
    TransitMode.WALKING,
    TransitMode.RIDESHARE,
]


async def get_routes(
    origin: str,
    destination: str,
    modes: list[TransitMode] | None = None,
    routing_mode: str = "mock",
    api_key: str = "",
) -> list[RawRouteResult]:
    """
    Fetch route data for all requested transit modes.

    Args:
        origin: Starting point (address or "lat,lng").
        destination: End point (address or "lat,lng").
        modes: Transit modes to evaluate. Defaults to DEFAULT_MODES.
        routing_mode: "mock" or "live".
        api_key: Google Maps API key (required for live mode).

    Returns:
        List of RawRouteResult, one per mode.
    """
    if modes is None:
        modes = DEFAULT_MODES

    # Filter out walking/bicycling for long distances in mock mode
    # (realistic — you wouldn't walk 40 km)
    results = await fetch_all_routes(origin, destination, modes, routing_mode, api_key)

    MAX_WALK_KM = 8.0
    MAX_BIKE_KM = 25.0

    filtered = []
    for r in results:
        if r.mode == TransitMode.WALKING and r.distance_km > MAX_WALK_KM:
            continue
        if r.mode == TransitMode.BICYCLING and r.distance_km > MAX_BIKE_KM:
            continue
        filtered.append(r)

    return filtered
