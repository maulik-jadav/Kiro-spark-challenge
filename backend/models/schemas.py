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


class RouteComparison(BaseModel):
    """Full comparison across all evaluated modes."""
    origin: str
    destination: str
    options: list[RouteOption]
    greenest: RouteOption | None = None
    fastest: RouteOption | None = None
    cheapest: RouteOption | None = None
    savings_vs_driving_kg: float | None = None


class HealthResponse(BaseModel):
    status: str = "ok"
    routing_mode: str
    version: str = "0.1.0"
