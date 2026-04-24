"""
Tests for services/maps_client.py
Verifies mock routing, segment building, and haversine estimates.
"""

import pytest
from core.emission_factors import TransitMode
from services.maps_client import (
    mock_route,
    _haversine_estimate,
    _build_transit_segments,
    _deterministic_seed,
    fetch_route,
    fetch_all_routes,
    RawRouteResult,
)


# ---------------------------------------------------------------------------
# Haversine and deterministic seed
# ---------------------------------------------------------------------------

class TestHaversine:
    def test_latlng_input(self):
        dist = _haversine_estimate("37.7749,-122.4194", "37.8044,-122.2712")
        assert 10 < dist < 20  # SF to Oakland is ~13 km

    def test_address_input_returns_reasonable_range(self):
        dist = _haversine_estimate("San Francisco", "Oakland")
        assert 5.0 <= dist <= 40.0

    def test_deterministic_for_same_inputs(self):
        d1 = _haversine_estimate("A", "B")
        d2 = _haversine_estimate("A", "B")
        assert d1 == d2

    def test_different_inputs_can_differ(self):
        d1 = _haversine_estimate("A", "B")
        d2 = _haversine_estimate("C", "D")
        # Not guaranteed to differ but extremely likely with hash
        # Just check they're both valid
        assert d1 > 0 and d2 > 0


class TestDeterministicSeed:
    def test_same_inputs_same_seed(self):
        s1 = _deterministic_seed("A", "B")
        s2 = _deterministic_seed("A", "B")
        assert s1 == s2

    def test_different_inputs_different_seed(self):
        s1 = _deterministic_seed("A", "B")
        s2 = _deterministic_seed("B", "A")
        assert s1 != s2


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
# Mock routing
# ---------------------------------------------------------------------------

class TestMockRoute:
    def test_returns_raw_route_result(self):
        result = mock_route("A", "B", TransitMode.DRIVING)
        assert isinstance(result, RawRouteResult)

    def test_mock_route_has_correct_mode(self):
        result = mock_route("A", "B", TransitMode.BUS)
        assert result.mode == TransitMode.BUS

    def test_mock_route_positive_values(self):
        result = mock_route("SF", "Oakland", TransitMode.DRIVING)
        assert result.distance_km > 0
        assert result.duration_min > 0
        assert len(result.segments) > 0

    def test_mock_route_deterministic(self):
        r1 = mock_route("X", "Y", TransitMode.DRIVING)
        r2 = mock_route("X", "Y", TransitMode.DRIVING)
        assert r1.distance_km == r2.distance_km
        assert r1.duration_min == r2.duration_min

    def test_transit_mock_has_walk_segments(self):
        result = mock_route("A", "B", TransitMode.LIGHT_RAIL)
        modes = [s["mode"] for s in result.segments]
        assert "walking" in modes
        assert "light_rail" in modes


# ---------------------------------------------------------------------------
# Fetch functions (mock mode)
# ---------------------------------------------------------------------------

class TestFetchFunctions:
    @pytest.mark.asyncio
    async def test_fetch_route_mock(self):
        result = await fetch_route("A", "B", TransitMode.DRIVING, routing_mode="mock")
        assert isinstance(result, RawRouteResult)
        assert result.mode == TransitMode.DRIVING

    @pytest.mark.asyncio
    async def test_fetch_all_routes_mock(self):
        modes = [TransitMode.DRIVING, TransitMode.WALKING, TransitMode.BUS]
        results = await fetch_all_routes("A", "B", modes, routing_mode="mock")
        assert len(results) == 3
        returned_modes = {r.mode for r in results}
        assert returned_modes == set(modes)
