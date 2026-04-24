"""
Orchestrator

Manages the multi-agent pipeline:
  1. Routing Agent  → fetches all route options from the map API
  2. Emissions Agent → computes carbon cost and trip cost per option
  3. Decision Agent  → reasons about trade-offs and generates a recommendation

This is a linear DAG, not an open-ended agent loop. Each stage feeds
its output into the next.
"""

from agents.routing_agent import get_routes
from agents.emissions_agent import (
    analyze_all,
    find_greenest,
    find_fastest,
    find_cheapest,
    savings_vs_driving,
)
from agents.decision_agent import decide
from models.schemas import RouteComparison


async def plan_route(
    origin: str,
    destination: str,
    modes=None,
    constraint: str | None = None,
    routing_mode: str = "mock",
    google_maps_api_key: str = "",
    groq_api_key: str = "",
) -> RouteComparison:
    """
    Run the full agent pipeline and return a complete RouteComparison
    with emissions, costs, and agentic reasoning.
    """

    # --- Stage 1: Routing Agent ---
    raw_routes = await get_routes(
        origin=origin,
        destination=destination,
        modes=modes,
        routing_mode=routing_mode,
        api_key=google_maps_api_key,
    )

    # --- Stage 2: Emissions Agent ---
    options = analyze_all(raw_routes)
    greenest = find_greenest(options)
    fastest = find_fastest(options)
    cheapest = find_cheapest(options)
    savings = savings_vs_driving(options)

    # Sort by emissions (lowest first)
    options.sort(key=lambda o: o.total_emissions_g)

    # --- Stage 3: Decision Agent ---
    reasoning = await decide(
        origin=origin,
        destination=destination,
        options=options,
        constraint=constraint,
        api_key=groq_api_key,
    )

    return RouteComparison(
        origin=origin,
        destination=destination,
        options=options,
        greenest=greenest,
        fastest=fastest,
        cheapest=cheapest,
        savings_vs_driving_kg=savings,
        reasoning=reasoning,
    )
