"""
Tests for agents/orchestrator.py
Verifies the full pipeline end-to-end with mocked routing data.
"""

import pytest
from unittest.mock import AsyncMock, patch

from agents.orchestrator import plan_route
from models.schemas import RouteComparison, AgentReasoning
from services.maps_client import RawRouteResult
from core.emission_factors import TransitMode


def _mock_raw_routes():
    """Return a set of fake RawRouteResults for testing the pipeline."""
    return [
        RawRouteResult(
            mode=TransitMode.DRIVING,
            distance_km=15.0,
            duration_min=20.0,
            segments=[{
                "mode": "driving",
                "distance_km": 15.0,
                "duration_min": 20.0,
                "description": "driving for 15.0 km",
            }],
        ),
        RawRouteResult(
            mode=TransitMode.BUS,
            distance_km=16.0,
            duration_min=35.0,
            segments=[
                {"mode": "walking", "distance_km": 0.4, "duration_min": 4.8, "description": "Walk to station"},
                {"mode": "bus", "distance_km": 15.2, "duration_min": 25.2, "description": "bus (15.2 km)"},
                {"mode": "walking", "distance_km": 0.3, "duration_min": 3.6, "description": "Walk to destination"},
            ],
        ),
        RawRouteResult(
            mode=TransitMode.BICYCLING,
            distance_km=14.0,
            duration_min=45.0,
            segments=[{
                "mode": "bicycling",
                "distance_km": 14.0,
                "duration_min": 45.0,
                "description": "bicycling for 14.0 km",
            }],
        ),
    ]


@pytest.fixture
def mock_routes():
    """Patch get_routes to return mock data instead of calling the live API."""
    with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock:
        mock.return_value = _mock_raw_routes()
        yield mock


class TestOrchestrator:
    @pytest.mark.asyncio
    async def test_returns_route_comparison(self, mock_routes):
        result = await plan_route("A", "B")
        assert isinstance(result, RouteComparison)

    @pytest.mark.asyncio
    async def test_has_options(self, mock_routes):
        result = await plan_route("A", "B")
        assert len(result.options) > 0

    @pytest.mark.asyncio
    async def test_has_greenest(self, mock_routes):
        result = await plan_route("A", "B")
        assert result.greenest is not None

    @pytest.mark.asyncio
    async def test_has_fastest(self, mock_routes):
        result = await plan_route("A", "B")
        assert result.fastest is not None

    @pytest.mark.asyncio
    async def test_has_scoring_fields(self, mock_routes):
        result = await plan_route("A", "B")
        assert result.selected_priority is not None
        assert result.recommended_route is not None
        assert len(result.scored_routes) > 0

    @pytest.mark.asyncio
    async def test_has_reasoning(self, mock_routes):
        result = await plan_route("A", "B")
        assert result.reasoning is not None
        assert isinstance(result.reasoning, AgentReasoning)

    @pytest.mark.asyncio
    async def test_options_sorted_by_emissions(self, mock_routes):
        result = await plan_route("A", "B")
        emissions = [o.total_emissions_g for o in result.options]
        assert emissions == sorted(emissions)

    @pytest.mark.asyncio
    async def test_all_options_have_costs(self, mock_routes):
        result = await plan_route("A", "B")
        for opt in result.options:
            assert opt.total_cost_usd >= 0
            assert opt.cost_source

    @pytest.mark.asyncio
    async def test_all_options_have_emissions(self, mock_routes):
        result = await plan_route("A", "B")
        for opt in result.options:
            assert opt.total_emissions_g >= 0
            assert opt.emission_factor_source

    @pytest.mark.asyncio
    async def test_with_constraint(self, mock_routes):
        result = await plan_route("A", "B", constraint="Budget under $5")
        assert result.reasoning is not None

    @pytest.mark.asyncio
    async def test_savings_vs_driving(self, mock_routes):
        result = await plan_route("A", "B")
        assert result.savings_vs_driving_kg is not None
        assert result.savings_vs_driving_kg >= 0
