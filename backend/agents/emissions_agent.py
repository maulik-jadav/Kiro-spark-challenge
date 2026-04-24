"""
Emissions Agent

Computes the carbon cost for each route option returned by the Routing Agent.
Handles multi-segment routes (walk → rail → walk) by computing per-segment
emissions and summing them — giving accurate results for mixed-mode transit.
"""

from core.emission_factors import (
    TransitMode,
    compute_emissions_g,
    compute_cost,
    get_factor,
    get_cost_factor,
)
from models.schemas import RouteOption, RouteSegment
from services.maps_client import RawRouteResult


def _resolve_mode(mode_str: str) -> TransitMode:
    """Resolve a segment mode string to a TransitMode enum."""
    try:
        return TransitMode(mode_str)
    except ValueError:
        return TransitMode.WALKING  # safe fallback for unknown sub-segments


def analyze_route(raw: RawRouteResult) -> RouteOption:
    """
    Convert a RawRouteResult into a fully analyzed RouteOption
    with per-segment and total emissions and costs.
    """
    segments: list[RouteSegment] = []
    total_emissions_g = 0.0
    total_cost = 0.0

    for seg in raw.segments:
        seg_mode = _resolve_mode(seg["mode"])
        seg_distance = seg["distance_km"]
        seg_duration = seg["duration_min"]
        seg_emissions = compute_emissions_g(seg_mode, seg_distance)
        seg_cost = compute_cost(seg_mode, seg_distance)

        total_emissions_g += seg_emissions
        total_cost += seg_cost

        segments.append(
            RouteSegment(
                mode=seg_mode,
                distance_km=round(seg_distance, 2),
                duration_min=round(seg_duration, 1),
                emissions_g=round(seg_emissions, 1),
                cost_usd=round(seg_cost, 2),
                description=seg.get("description", ""),
            )
        )

    # Add the base fare once for the primary mode
    cost_factor = get_cost_factor(raw.mode)
    total_cost += cost_factor.base_fare

    factor = get_factor(raw.mode)

    return RouteOption(
        mode=raw.mode,
        segments=segments,
        total_distance_km=round(raw.distance_km, 2),
        total_duration_min=round(raw.duration_min, 1),
        total_emissions_g=round(total_emissions_g, 1),
        total_emissions_kg=round(total_emissions_g / 1000.0, 3),
        total_cost_usd=round(total_cost, 2),
        emission_factor_source=factor.source,
        cost_source=cost_factor.source,
    )


def analyze_all(raw_routes: list[RawRouteResult]) -> list[RouteOption]:
    """Analyze emissions for all route options."""
    return [analyze_route(r) for r in raw_routes]


def find_greenest(options: list[RouteOption]) -> RouteOption | None:
    """Return the route with lowest total emissions."""
    if not options:
        return None
    return min(options, key=lambda o: o.total_emissions_g)


def find_fastest(options: list[RouteOption]) -> RouteOption | None:
    """Return the route with shortest total duration."""
    if not options:
        return None
    return min(options, key=lambda o: o.total_duration_min)


def find_cheapest(options: list[RouteOption]) -> RouteOption | None:
    """Return the route with lowest total cost."""
    if not options:
        return None
    return min(options, key=lambda o: o.total_cost_usd)


def savings_vs_driving(options: list[RouteOption]) -> float | None:
    """
    Compute kg CO2 saved by the greenest option vs driving.
    Returns None if driving isn't in the options.
    """
    driving = next((o for o in options if o.mode == TransitMode.DRIVING), None)
    greenest = find_greenest(options)
    if driving is None or greenest is None:
        return None
    return round((driving.total_emissions_g - greenest.total_emissions_g) / 1000.0, 3)
