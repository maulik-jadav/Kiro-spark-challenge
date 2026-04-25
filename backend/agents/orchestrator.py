"""
Orchestrator

Manages the multi-agent pipeline:
  1. Routing Agent  -> fetches all route options from the map API
  2. Emissions Agent -> computes carbon cost and trip cost per option
  3. Decision Agent  -> reasons about trade-offs and generates a recommendation

Also handles full-day itinerary planning (Phase 1.3):
  - Ingests calendar events
  - Identifies transit windows between events
  - Runs the route pipeline for each window
"""

from datetime import datetime, date

from agents.routing_agent import get_routes
from agents.emissions_agent import (
    analyze_all,
    find_greenest,
    find_fastest,
    find_cheapest,
    savings_vs_driving,
)
from agents.decision_agent import decide
from models.schemas import (
    RouteComparison,
    CalendarEvent,
    TransitWindow,
    TransitRecommendation,
    DayPlanResponse,
)
from services.calendar_client import fetch_events, mock_events


async def plan_route(
    origin: str,
    destination: str,
    modes=None,
    constraint: str | None = None,
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


def _parse_dt(dt_str: str) -> datetime:
    """Parse an ISO 8601 datetime string, handling timezone offsets."""
    # Handle 'Z' suffix
    if dt_str.endswith("Z"):
        dt_str = dt_str[:-1] + "+00:00"
    return datetime.fromisoformat(dt_str)


def _build_transit_windows(
    events: list[dict],
    home_address: str,
) -> list[dict]:
    """
    Identify the gaps between consecutive events where transit is needed.

    Returns a list of dicts with:
      from_event, to_event, origin, destination, depart_after, arrive_by, available_min
    """
    windows = []

    # Home -> first event (if home address provided)
    if home_address and events:
        first = events[0]
        first_start = _parse_dt(first["start"])
        windows.append({
            "from_event": "Home",
            "to_event": first["summary"],
            "origin": home_address,
            "destination": first.get("location", ""),
            "depart_after": "",
            "arrive_by": first["start"],
            "available_min": 0,  # no constraint on when to leave home
        })

    # Between consecutive events
    for i in range(len(events) - 1):
        current = events[i]
        next_ev = events[i + 1]

        current_end = _parse_dt(current["end"])
        next_start = _parse_dt(next_ev["start"])
        gap_min = (next_start - current_end).total_seconds() / 60.0

        origin = current.get("location", "")
        destination = next_ev.get("location", "")

        # Skip if either event has no location
        if not origin or not destination:
            continue

        # Skip if same location
        if origin == destination:
            continue

        windows.append({
            "from_event": current["summary"],
            "to_event": next_ev["summary"],
            "origin": origin,
            "destination": destination,
            "depart_after": current["end"],
            "arrive_by": next_ev["start"],
            "available_min": round(gap_min, 1),
        })

    # Last event -> home (if home address provided)
    if home_address and events:
        last = events[-1]
        last_loc = last.get("location", "")
        if last_loc and last_loc != home_address:
            windows.append({
                "from_event": last["summary"],
                "to_event": "Home",
                "origin": last_loc,
                "destination": home_address,
                "depart_after": last["end"],
                "arrive_by": "",
                "available_min": 0,
            })

    return windows


async def plan_day(
    target_date: date,
    session_id: str | None = None,
    home_address: str = "",
    google_maps_api_key: str = "",
    google_client_id: str = "",
    google_client_secret: str = "",
    groq_api_key: str = "",
) -> DayPlanResponse:
    """
    Plan a full day's transit between calendar events.

    1. Fetch events from Google Calendar (or mock)
    2. Find gaps between events
    3. Run the route pipeline for each gap
    4. Return a complete itinerary
    """

    # --- Fetch calendar events ---
    if session_id:
        raw_events = await fetch_events(
            session_id=session_id,
            target_date=target_date,
            client_id=google_client_id,
            client_secret=google_client_secret,
        )
    else:
        raw_events = mock_events(target_date)

    # Convert to CalendarEvent models
    events = [
        CalendarEvent(
            summary=e["summary"],
            location=e.get("location", ""),
            start=e["start"],
            end=e["end"],
        )
        for e in raw_events
    ]

    # --- Find transit windows ---
    windows = _build_transit_windows(raw_events, home_address)

    # --- Route each window ---
    transit_windows: list[TransitWindow] = []
    total_emissions = 0.0
    total_cost = 0.0
    total_transit_min = 0.0

    for w in windows:
        # Build a time constraint for the decision agent
        constraint = None
        if w["available_min"] > 0:
            constraint = f"Must arrive within {w['available_min']:.0f} minutes"

        route = await plan_route(
            origin=w["origin"],
            destination=w["destination"],
            constraint=constraint,
            google_maps_api_key=google_maps_api_key,
            groq_api_key=groq_api_key,
        )

        # Find the recommended option's stats for the day totals
        rec_option = None
        if route.reasoning and route.options:
            rec_option = next(
                (o for o in route.options if o.mode == route.reasoning.recommended_mode),
                route.options[0],
            )
            total_emissions += rec_option.total_emissions_g
            total_cost += rec_option.total_cost_usd
            total_transit_min += rec_option.total_duration_min

        rec_summary = TransitRecommendation(
            mode=rec_option.mode if rec_option else route.options[0].mode,
            duration_min=rec_option.total_duration_min if rec_option else 0,
            emissions_g=rec_option.total_emissions_g if rec_option else 0,
            cost_usd=rec_option.total_cost_usd if rec_option else 0,
            summary=route.reasoning.summary if route.reasoning else "",
        )

        transit_windows.append(
            TransitWindow(
                from_event=w["from_event"],
                to_event=w["to_event"],
                origin=w["origin"],
                destination=w["destination"],
                depart_after=w["depart_after"],
                arrive_by=w["arrive_by"],
                available_min=w["available_min"],
                recommended=rec_summary,
                route=route,
            )
        )

    return DayPlanResponse(
        date=target_date.isoformat(),
        events=events,
        transit_windows=transit_windows,
        total_emissions_g=round(total_emissions, 1),
        total_cost_usd=round(total_cost, 2),
        total_transit_min=round(total_transit_min, 1),
    )
