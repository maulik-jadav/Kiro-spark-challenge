"""
API routes — powered by the multi-agent orchestrator.
"""

from fastapi import APIRouter, Depends

from agents.orchestrator import plan_route as orchestrate
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
    Core endpoint — runs the full agent pipeline:
      1. Routing Agent fetches all route options
      2. Emissions Agent computes carbon + cost per option
      3. Decision Agent reasons about trade-offs and recommends
    """
    return await orchestrate(
        origin=req.origin,
        destination=req.destination,
        modes=req.modes,
        constraint=req.constraint,
        routing_mode=settings.routing_mode,
        google_maps_api_key=settings.google_maps_api_key,
        groq_api_key=settings.groq_api_key,
    )
