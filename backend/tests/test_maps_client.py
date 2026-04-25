"""
Tests for services/maps_client.py
Verifies segment building and live route fetching (mock removed).
"""

import pytest
import httpx
from unittest.mock import AsyncMock, patch, MagicMock
from core.emission_factors import TransitMode
from services.maps_client import (
    _build_transit_segments,
    fetch_route,
    fetch_all_routes,
    RawRouteResult,
    _parse_latlng,
    _parse_duration,
)


# ---------------------------------------------------------------------------
# Segment building
# ---------------------------------------------------------------------------

class TestBuildTransitSegments:
    def test_driving_single_segment(self):
        segs = _build_transit_segments(TransitMode.DRIVING, 20.0, 30.0)
        assert len(segs) == 1
        assert segs[0]["mode"] == "driving"
        assert segs[0]["distance_km"] == 20.0
        assert segs[0]["duration_min"] == 30.0

    def test_walking_single_segment(self):
        segs = _build_transit_segments(TransitMode.WALKING, 3.0, 36.0)
        assert len(segs) == 1
        assert segs[0]["mode"] == "walking"

    def test_bicycling_single_segment(self):
        segs = _build_transit_segments(TransitMode.BICYCLING, 10.0, 40.0)
        assert len(segs) == 1
        assert segs[0]["mode"] == "bicycling"

    def test_light_rail_three_segments(self):
        segs = _build_transit_segments(TransitMode.LIGHT_RAIL, 15.0, 30.0)
        assert len(segs) == 3
        assert segs[0]["mode"] == "walking"
        assert segs[1]["mode"] == "light_rail"
        assert segs[2]["mode"] == "walking"

    def test_bus_three_segments(self):
        segs = _build_transit_segments(TransitMode.BUS, 10.0, 25.0)
        assert len(segs) == 3
        assert segs[0]["mode"] == "walking"
        assert segs[1]["mode"] == "bus"
        assert segs[2]["mode"] == "walking"

    def test_transit_segment_distances_sum_to_total(self):
        total_km = 15.0
        segs = _build_transit_segments(TransitMode.LIGHT_RAIL, total_km, 30.0)
        seg_sum = sum(s["distance_km"] for s in segs)
        assert abs(seg_sum - total_km) < 0.1

    def test_transit_no_negative_durations(self):
        """Short trips should not produce negative transit durations."""
        segs = _build_transit_segments(TransitMode.LIGHT_RAIL, 5.0, 8.0)
        for s in segs:
            assert s["duration_min"] >= 0, f"Negative duration: {s}"

    def test_very_short_transit_no_negative(self):
        """Even a 3-minute trip should have all positive durations."""
        segs = _build_transit_segments(TransitMode.SUBWAY, 2.0, 3.0)
        for s in segs:
            assert s["duration_min"] >= 0, f"Negative duration: {s}"


# ---------------------------------------------------------------------------
# Parse helpers
# ---------------------------------------------------------------------------

class TestParseHelpers:
    def test_parse_latlng_with_coords(self):
        result = _parse_latlng("37.7749,-122.4194")
        assert "location" in result
        assert result["location"]["latLng"]["latitude"] == 37.7749

    def test_parse_latlng_with_address(self):
        result = _parse_latlng("San Francisco, CA")
        assert result == {"address": "San Francisco, CA"}

    def test_parse_duration(self):
        assert _parse_duration("120s") == 2.0
        assert _parse_duration("60s") == 1.0
        assert _parse_duration("0s") == 0.0


# ---------------------------------------------------------------------------
# Fetch functions (always live)
# ---------------------------------------------------------------------------

class TestFetchFunctions:
    @pytest.mark.asyncio
    async def test_fetch_route_calls_live_route(self):
        """fetch_route should always call live_route."""
        mock_result = RawRouteResult(
            mode=TransitMode.DRIVING,
            distance_km=15.0,
            duration_min=20.0,
            segments=[{"mode": "driving", "distance_km": 15.0, "duration_min": 20.0, "description": "driving for 15.0 km"}],
        )
        with patch("services.maps_client.live_route", new_callable=AsyncMock, return_value=mock_result) as mock_live:
            result = await fetch_route("A", "B", TransitMode.DRIVING, api_key="test-key")
            assert isinstance(result, RawRouteResult)
            assert result.mode == TransitMode.DRIVING
            mock_live.assert_called_once_with("A", "B", TransitMode.DRIVING, "test-key")

    @pytest.mark.asyncio
    async def test_fetch_route_raises_on_failure(self):
        """fetch_route should raise on API failure, not fall back to mock."""
        with patch("services.maps_client.live_route", new_callable=AsyncMock, side_effect=httpx.HTTPStatusError("error", request=MagicMock(), response=MagicMock())):
            with pytest.raises(httpx.HTTPStatusError):
                await fetch_route("A", "B", TransitMode.DRIVING, api_key="test-key")

    @pytest.mark.asyncio
    async def test_fetch_all_routes_calls_live_for_all_modes(self):
        """fetch_all_routes should call live_route for each mode."""
        modes = [TransitMode.DRIVING, TransitMode.WALKING, TransitMode.BUS]

        async def fake_live(origin, dest, mode, api_key):
            return RawRouteResult(
                mode=mode,
                distance_km=10.0,
                duration_min=15.0,
                segments=[{"mode": mode.value, "distance_km": 10.0, "duration_min": 15.0, "description": f"{mode.value} for 10.0 km"}],
            )

        with patch("services.maps_client.live_route", new_callable=AsyncMock, side_effect=fake_live):
            results = await fetch_all_routes("A", "B", modes, api_key="test-key")
            assert len(results) == 3
            returned_modes = {r.mode for r in results}
            assert returned_modes == set(modes)

    @pytest.mark.asyncio
    async def test_fetch_route_no_routing_mode_parameter(self):
        """fetch_route should not accept a routing_mode parameter."""
        import inspect
        sig = inspect.signature(fetch_route)
        assert "routing_mode" not in sig.parameters

    @pytest.mark.asyncio
    async def test_fetch_all_routes_no_routing_mode_parameter(self):
        """fetch_all_routes should not accept a routing_mode parameter."""
        import inspect
        sig = inspect.signature(fetch_all_routes)
        assert "routing_mode" not in sig.parameters
