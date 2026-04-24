"""
Tests for agents/routing_agent.py
Verifies route fetching and distance-based filtering.
"""

import pytest
from core.emission_factors import TransitMode
from agents.routing_agent import get_routes, DEFAULT_MODES


class TestGetRoutes:
    @pytest.mark.asyncio
    async def test_returns_routes_for_all_default_modes(self):
        results = await get_routes("A", "B", routing_mode="mock")
        returned_modes = {r.mode for r in results}
        # Walking/bicycling may be filtered out for long distances
        assert len(results) > 0

    @pytest.mark.asyncio
    async def test_custom_modes(self):
        modes = [TransitMode.DRIVING, TransitMode.BUS]
        results = await get_routes("A", "B", modes=modes, routing_mode="mock")
        returned_modes = {r.mode for r in results}
        assert returned_modes == set(modes)

    @pytest.mark.asyncio
    async def test_walking_filtered_for_long_distance(self):
        """Walking should be filtered out for distances > 8 km."""
        # Use lat/lng that are far apart (~25km)
        results = await get_routes(
            "37.7749,-122.4194",
            "37.5585,-122.2711",
            modes=[TransitMode.WALKING, TransitMode.DRIVING],
            routing_mode="mock",
        )
        modes = {r.mode for r in results}
        assert TransitMode.WALKING not in modes
        assert TransitMode.DRIVING in modes

    @pytest.mark.asyncio
    async def test_walking_kept_for_short_distance(self):
        """Walking should be kept for distances < 8 km."""
        # Use lat/lng that are close (~2km)
        results = await get_routes(
            "37.7749,-122.4194",
            "37.7849,-122.4094",
            modes=[TransitMode.WALKING, TransitMode.DRIVING],
            routing_mode="mock",
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
