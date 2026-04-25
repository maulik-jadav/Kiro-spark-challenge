"""
Pydantic models for request validation and response serialization.
"""

from pydantic import BaseModel, Field
from core.emission_factors import TransitMode


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------

class RouteRequest(BaseModel):
    origin: str = Field(..., description="Starting address or lat,lng")
    destination: str = Field(..., description="Ending address or lat,lng")
    modes: list[TransitMode] | None = Field(
        default=None,
        description="Transit modes to evaluate. None = all available.",
    )
    constraint: str | None = Field(
        default=None,
        description="User constraint for the decision agent (e.g., 'Arrive by 10 AM', 'Budget under $5').",
    )


# ---------------------------------------------------------------------------
# Response models
# ---------------------------------------------------------------------------

class RouteSegment(BaseModel):
    """A single leg/segment within a route (e.g., walk → rail → walk)."""
    mode: TransitMode
    distance_km: float
    duration_min: float
    emissions_g: float
    cost_usd: float = 0.0
    description: str = ""


class RouteOption(BaseModel):
    """One complete route from origin to destination via a specific mode."""
    mode: TransitMode
    segments: list[RouteSegment]
    total_distance_km: float
    total_duration_min: float
    total_emissions_g: float
    total_emissions_kg: float
    total_cost_usd: float
    emission_factor_source: str
    cost_source: str


class AgentReasoning(BaseModel):
    """Natural language reasoning from the decision agent."""
    recommended_mode: TransitMode
    summary: str = Field(..., description="1-2 sentence recommendation")
    justification: str = Field(..., description="Detailed reasoning comparing trade-offs")
    constraint_analysis: str | None = Field(
        default=None,
        description="How the recommendation satisfies the user's constraint",
    )


class RouteComparison(BaseModel):
    """Full comparison across all evaluated modes."""
    origin: str
    destination: str
    options: list[RouteOption]
    greenest: RouteOption | None = None
    fastest: RouteOption | None = None
    cheapest: RouteOption | None = None
    savings_vs_driving_kg: float | None = None
    reasoning: AgentReasoning | None = None


# ---------------------------------------------------------------------------
# Calendar / Itinerary models (Phase 1.3)
# ---------------------------------------------------------------------------

class CalendarEvent(BaseModel):
    """A single calendar event."""
    summary: str
    location: str
    start: str = Field(..., description="ISO 8601 datetime")
    end: str = Field(..., description="ISO 8601 datetime")


class TransitRecommendation(BaseModel):
    """Summary of the recommended transit for a window."""
    mode: TransitMode
    duration_min: float
    emissions_g: float
    cost_usd: float
    summary: str


class TransitWindow(BaseModel):
    """A gap between two events with a transit recommendation."""
    from_event: str
    to_event: str
    origin: str
    destination: str
    depart_after: str = Field(..., description="Earliest departure (ISO 8601)")
    arrive_by: str = Field(..., description="Latest arrival (ISO 8601)")
    available_min: float = Field(..., description="Total minutes available for transit")
    recommended: TransitRecommendation
    route: RouteComparison


class DayPlanRequest(BaseModel):
    """Request to plan a full day's transit."""
    date: str = Field(..., description="Date to plan (YYYY-MM-DD)")
    session_id: str | None = Field(
        default=None,
        description="OAuth session ID. If omitted, uses mock calendar data.",
    )
    home_address: str = Field(
        default="",
        description="Home address for commute to first and from last event.",
    )


class DayPlanResponse(BaseModel):
    """Full day itinerary with transit between each event."""
    date: str
    events: list[CalendarEvent]
    transit_windows: list[TransitWindow]
    total_emissions_g: float
    total_cost_usd: float
    total_transit_min: float


class AuthUrlResponse(BaseModel):
    """OAuth authorization URL response."""
    auth_url: str
    state: str


class AuthCallbackResponse(BaseModel):
    """OAuth callback response with session ID."""
    session_id: str
    message: str = "Authentication successful"


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "0.1.0"
