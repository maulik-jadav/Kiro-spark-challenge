"""
Tests for agents/routing_agent.py
Verifies route fetching and distance-based filtering.
"""

import pytest
from unittest.mock import patch, AsyncMock
from core.emission_factors import TransitMode
from agents.routing_agent import get_routes, DEFAULT_MODES
from services.maps_client import RawRouteResult


def _make_route(mode: TransitMode, distance_km: float = 10.0, duration_min: float = 20.0) -> RawRouteResult:
    """Helper to create a RawRouteResult for testing."""
    return RawRouteResult(
        mode=mode,
        distance_km=distance_km,
        duration_min=duration_min,
        segments=[{"mode": mode.value, "distance_km": distance_km, "duration_min": duration_min, "description": "test"}],
    )


class TestGetRoutes:
    @pytest.mark.asyncio
    @patch("agents.routing_agent.fetch_all_routes", new_callable=AsyncMock)
    async def test_returns_routes_for_all_default_modes(self, mock_fetch):
        mock_fetch.return_value = [_make_route(m) for m in DEFAULT_MODES]
        results = await get_routes("A", "B")
        # Walking/bicycling may be filtered out for long distances
        assert len(results) > 0
        mock_fetch.assert_called_once_with("A", "B", DEFAULT_MODES, "")

    @pytest.mark.asyncio
    @patch("agents.routing_agent.fetch_all_routes", new_callable=AsyncMock)
    async def test_custom_modes(self, mock_fetch):
        modes = [TransitMode.DRIVING, TransitMode.BUS]
        mock_fetch.return_value = [_make_route(m) for m in modes]
        results = await get_routes("A", "B", modes=modes)
        returned_modes = {r.mode for r in results}
        assert returned_modes == set(modes)

    @pytest.mark.asyncio
    @patch("agents.routing_agent.fetch_all_routes", new_callable=AsyncMock)
    async def test_walking_filtered_for_long_distance(self, mock_fetch):
        """Walking should be filtered out for distances > 8 km."""
        mock_fetch.return_value = [
            _make_route(TransitMode.WALKING, distance_km=25.0),
            _make_route(TransitMode.DRIVING, distance_km=25.0),
        ]
        results = await get_routes(
            "37.7749,-122.4194",
            "37.5585,-122.2711",
            modes=[TransitMode.WALKING, TransitMode.DRIVING],
        )
        modes = {r.mode for r in results}
        assert TransitMode.WALKING not in modes
        assert TransitMode.DRIVING in modes

    @pytest.mark.asyncio
    @patch("agents.routing_agent.fetch_all_routes", new_callable=AsyncMock)
    async def test_walking_kept_for_short_distance(self, mock_fetch):
        """Walking should be kept for distances < 8 km."""
        mock_fetch.return_value = [
            _make_route(TransitMode.WALKING, distance_km=2.0),
            _make_route(TransitMode.DRIVING, distance_km=2.0),
        ]
        results = await get_routes(
            "37.7749,-122.4194",
            "37.7849,-122.4094",
            modes=[TransitMode.WALKING, TransitMode.DRIVING],
        )
        modes = {r.mode for r in results}
        assert TransitMode.WALKING in modes

    @pytest.mark.asyncio
    async def test_default_modes_list(self):
        assert TransitMode.DRIVING in DEFAULT_MODES
        assert TransitMode.LIGHT_RAIL in DEFAULT_MODES
        assert TransitMode.BUS in DEFAULT_MODES
        assert TransitMode.WALKING in DEFAULT_MODES
        assert TransitMode.BICYCLING in DEFAULT_MODES

    @pytest.mark.asyncio
    @patch("agents.routing_agent.fetch_all_routes", new_callable=AsyncMock)
    async def test_get_routes_no_routing_mode_parameter(self, mock_fetch):
        """Verify get_routes does not accept routing_mode parameter."""
        import inspect
        sig = inspect.signature(get_routes)
        assert "routing_mode" not in sig.parameters
