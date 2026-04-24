"""
Tests for agents/emissions_agent.py
Verifies route analysis, emissions computation, and comparison functions.
"""

import pytest
from core.emission_factors import TransitMode
from services.maps_client import RawRouteResult
from agents.emissions_agent import (
    analyze_route,
    analyze_all,
    find_greenest,
    find_fastest,
    find_cheapest,
    savings_vs_driving,
    _resolve_mode,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_raw(mode: TransitMode, distance: float, duration: float) -> RawRouteResult:
    """Create a simple single-segment RawRouteResult for testing."""
    return RawRouteResult(
        mode=mode,
        distance_km=distance,
        duration_min=duration,
        segments=[{
            "mode": mode.value,
            "distance_km": distance,
            "duration_min": duration,
            "description": f"{mode.value} ({distance} km)",
        }],
    )


def _make_transit_raw(mode: TransitMode, distance: float, duration: float) -> RawRouteResult:
    """Create a walk → transit → walk RawRouteResult for testing."""
    walk_km = 0.3
    transit_km = distance - 2 * walk_km
    return RawRouteResult(
        mode=mode,
        distance_km=distance,
        duration_min=duration,
        segments=[
            {"mode": "walking", "distance_km": walk_km, "duration_min": 3.6, "description": "Walk to station"},
            {"mode": mode.value, "distance_km": transit_km, "duration_min": duration - 7.2, "description": f"{mode.value}"},
            {"mode": "walking", "distance_km": walk_km, "duration_min": 3.6, "description": "Walk to destination"},
        ],
    )


# ---------------------------------------------------------------------------
# _resolve_mode
# ---------------------------------------------------------------------------

class TestResolveMode:
    def test_valid_mode(self):
        assert _resolve_mode("driving") == TransitMode.DRIVING

    def test_invalid_mode_falls_back_to_walking(self):
        assert _resolve_mode("jetpack") == TransitMode.WALKING

    def test_all_transit_modes_resolve(self):
        for mode in TransitMode:
            assert _resolve_mode(mode.value) == mode


# ---------------------------------------------------------------------------
# analyze_route
# ---------------------------------------------------------------------------

class TestAnalyzeRoute:
    def test_single_segment_driving(self):
        raw = _make_raw(TransitMode.DRIVING, 10.0, 15.0)
        option = analyze_route(raw)

        assert option.mode == TransitMode.DRIVING
        assert option.total_distance_km == 10.0
        assert option.total_duration_min == 15.0
        assert option.total_emissions_g == 2510.0  # 251 * 10
        assert option.total_emissions_kg == 2.51
        assert option.total_cost_usd > 0
        assert len(option.segments) == 1

    def test_walking_zero_emissions(self):
        raw = _make_raw(TransitMode.WALKING, 3.0, 36.0)
        option = analyze_route(raw)
        assert option.total_emissions_g == 0.0
        assert option.total_cost_usd == 0.0

    def test_multi_segment_transit(self):
        raw = _make_transit_raw(TransitMode.LIGHT_RAIL, 10.0, 20.0)
        option = analyze_route(raw)

        assert len(option.segments) == 3
        # Walking segments should have 0 emissions
        assert option.segments[0].emissions_g == 0.0
        assert option.segments[2].emissions_g == 0.0
        # Rail segment should have emissions
        assert option.segments[1].emissions_g > 0
        # Total should be sum
        seg_total = sum(s.emissions_g for s in option.segments)
        assert abs(option.total_emissions_g - seg_total) < 0.1

    def test_cost_includes_base_fare(self):
        raw = _make_raw(TransitMode.BUS, 5.0, 15.0)
        option = analyze_route(raw)
        # Bus: $2.50 flat fare + $0.00/km = $2.50
        assert option.total_cost_usd == 2.50

    def test_cost_rideshare_has_base_and_per_km(self):
        raw = _make_raw(TransitMode.RIDESHARE, 10.0, 15.0)
        option = analyze_route(raw)
        # Rideshare: $3.00 base + $1.20/km * 10 = $15.00
        assert option.total_cost_usd == 15.00

    def test_emission_factor_source_populated(self):
        raw = _make_raw(TransitMode.DRIVING, 10.0, 15.0)
        option = analyze_route(raw)
        assert "EPA" in option.emission_factor_source

    def test_cost_source_populated(self):
        raw = _make_raw(TransitMode.DRIVING, 10.0, 15.0)
        option = analyze_route(raw)
        assert "AAA" in option.cost_source


# ---------------------------------------------------------------------------
# analyze_all
# ---------------------------------------------------------------------------

class TestAnalyzeAll:
    def test_analyzes_all_routes(self):
        raws = [
            _make_raw(TransitMode.DRIVING, 15.0, 20.0),
            _make_raw(TransitMode.WALKING, 5.0, 60.0),
            _make_raw(TransitMode.BUS, 12.0, 30.0),
        ]
        options = analyze_all(raws)
        assert len(options) == 3
        modes = {o.mode for o in options}
        assert modes == {TransitMode.DRIVING, TransitMode.WALKING, TransitMode.BUS}

    def test_empty_input(self):
        assert analyze_all([]) == []


# ---------------------------------------------------------------------------
# Comparison functions
# ---------------------------------------------------------------------------

class TestComparisonFunctions:
    def _make_options(self):
        raws = [
            _make_raw(TransitMode.DRIVING, 20.0, 15.0),   # high emissions, fast
            _make_raw(TransitMode.WALKING, 5.0, 60.0),    # zero emissions, slow
            _make_raw(TransitMode.BUS, 12.0, 25.0),       # medium
        ]
        return analyze_all(raws)

    def test_find_greenest(self):
        options = self._make_options()
        greenest = find_greenest(options)
        assert greenest.mode == TransitMode.WALKING
        assert greenest.total_emissions_g == 0.0

    def test_find_fastest(self):
        options = self._make_options()
        fastest = find_fastest(options)
        assert fastest.mode == TransitMode.DRIVING

    def test_find_cheapest(self):
        options = self._make_options()
        cheapest = find_cheapest(options)
        assert cheapest.mode == TransitMode.WALKING
        assert cheapest.total_cost_usd == 0.0

    def test_find_greenest_empty(self):
        assert find_greenest([]) is None

    def test_find_fastest_empty(self):
        assert find_fastest([]) is None

    def test_find_cheapest_empty(self):
        assert find_cheapest([]) is None

    def test_savings_vs_driving(self):
        options = self._make_options()
        savings = savings_vs_driving(options)
        assert savings is not None
        assert savings > 0  # walking saves vs driving

    def test_savings_vs_driving_no_driving(self):
        raws = [_make_raw(TransitMode.WALKING, 3.0, 36.0)]
        options = analyze_all(raws)
        assert savings_vs_driving(options) is None
