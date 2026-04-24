"""
API routes for Phase 1.1: single-route comparison.
"""

from fastapi import APIRouter, Depends

from agents.routing_agent import get_routes
from agents.emissions_agent import (
    analyze_all,
    find_greenest,
    find_fastest,
    find_cheapest,
    savings_vs_driving,
)
from core.config import Settings, get_settings
from models.schemas import RouteRequest, RouteComparison, HealthResponse


router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_settings)):
    return HealthResponse(routing_mode=settings.routing_mode)


@router.post("/plan-route", response_model=RouteComparison)
async def plan_route(
    req: RouteRequest,
    settings: Settings = Depends(get_settings),
):
    """
    Phase 1.1 core endpoint.

    Given an origin and destination, returns a comparison of all transit modes
    ranked by carbon cost, with segment-level emissions breakdowns.
    """
    raw_routes = await get_routes(
        origin=req.origin,
        destination=req.destination,
        modes=req.modes,
        routing_mode=settings.routing_mode,
        api_key=settings.google_maps_api_key,
    )

    options = analyze_all(raw_routes)
    greenest = find_greenest(options)
    fastest = find_fastest(options)
    cheapest = find_cheapest(options)
    savings = savings_vs_driving(options)

    # Sort by emissions (lowest first)
    options.sort(key=lambda o: o.total_emissions_g)

    return RouteComparison(
        origin=req.origin,
        destination=req.destination,
        options=options,
        greenest=greenest,
        fastest=fastest,
        cheapest=cheapest,
        savings_vs_driving_kg=savings,
    )
