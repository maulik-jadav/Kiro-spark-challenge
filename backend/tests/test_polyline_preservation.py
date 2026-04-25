"""
Preservation Property Tests — Route Analysis Data Unchanged

These tests capture the CURRENT correct behavior of the route analysis
pipeline so we can verify it remains unchanged after the polyline fix.

All tests here must PASS on the unfixed code — they encode the baseline.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Testing framework: hypothesis (property-based testing)
"""

import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from core.emission_factors import (
    TransitMode,
    EMISSION_FACTORS,
    COST_FACTORS,
    compute_emissions_g,
    compute_cost,
    get_factor,
    get_cost_factor,
)
from models.schemas import RouteOption
from services.maps_client import RawRouteResult
from agents.emissions_agent import (
    analyze_route,
    analyze_all,
    find_greenest,
    find_fastest,
    find_cheapest,
    savings_vs_driving,
)


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

transit_modes = st.sampled_from(list(TransitMode))
distances = st.floats(min_value=0.1, max_value=500.0, allow_nan=False, allow_infinity=False)
durations = st.floats(min_value=1.0, max_value=600.0, allow_nan=False, allow_infinity=False)


def _make_single_segment_raw(mode: TransitMode, distance_km: float, duration_min: float) -> RawRouteResult:
    """Build a single-segment RawRouteResult."""
    return RawRouteResult(
        mode=mode,
        distance_km=distance_km,
        duration_min=duration_min,
        segments=[{
            "mode": mode.value,
            "distance_km": distance_km,
            "duration_min": duration_min,
            "description": f"{mode.value} for {distance_km:.1f} km",
        }],
    )


@st.composite
def raw_route_results(draw):
    """Strategy that generates realistic RawRouteResult objects."""
    mode = draw(transit_modes)
    distance_km = draw(distances)
    duration_min = draw(durations)
    return _make_single_segment_raw(mode, distance_km, duration_min)


@st.composite
def multi_segment_raw_route_results(draw):
    """Strategy that generates multi-segment RawRouteResult objects (walk → transit → walk)."""
    transit_modes_multi = [
        TransitMode.BUS, TransitMode.LIGHT_RAIL,
        TransitMode.SUBWAY, TransitMode.COMMUTER_RAIL,
    ]
    mode = draw(st.sampled_from(transit_modes_multi))
    total_distance = draw(st.floats(min_value=2.0, max_value=500.0, allow_nan=False, allow_infinity=False))
    total_duration = draw(st.floats(min_value=10.0, max_value=600.0, allow_nan=False, allow_infinity=False))

    walk_start_km = round(min(0.4, total_distance * 0.05), 2)
    walk_end_km = round(min(0.3, total_distance * 0.04), 2)
    transit_km = round(total_distance - walk_start_km - walk_end_km, 2)
    assume(transit_km > 0)

    walk_start_min = round(walk_start_km / 5.0 * 60, 1)
    walk_end_min = round(walk_end_km / 5.0 * 60, 1)
    transit_min = round(total_duration - walk_start_min - walk_end_min, 1)
    assume(transit_min > 0)

    segments = [
        {"mode": "walking", "distance_km": walk_start_km, "duration_min": walk_start_min, "description": "Walk to station"},
        {"mode": mode.value, "distance_km": transit_km, "duration_min": transit_min, "description": f"{mode.value}"},
        {"mode": "walking", "distance_km": walk_end_km, "duration_min": walk_end_min, "description": "Walk to destination"},
    ]

    return RawRouteResult(
        mode=mode,
        distance_km=total_distance,
        duration_min=total_duration,
        segments=segments,
    )


@st.composite
def route_option_lists(draw):
    """Strategy that generates a list of RouteOptions from random RawRouteResults."""
    n = draw(st.integers(min_value=1, max_value=5))
    raws = [draw(raw_route_results()) for _ in range(n)]
    return analyze_all(raws)


# ---------------------------------------------------------------------------
# Property 1: analyze_route preserves mode
# ---------------------------------------------------------------------------

class TestAnalyzeRoutePreservesMode:
    """
    **Validates: Requirements 3.1**

    For any RawRouteResult, analyze_route must produce a RouteOption
    whose mode matches the input mode.
    """

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_mode_preserved(self, raw):
        option = analyze_route(raw)
        assert option.mode == raw.mode, (
            f"Mode mismatch: input={raw.mode}, output={option.mode}"
        )


# ---------------------------------------------------------------------------
# Property 2: analyze_route produces correct distance and duration
# ---------------------------------------------------------------------------

class TestAnalyzeRouteDistanceDuration:
    """
    **Validates: Requirements 3.1**

    For any RawRouteResult, analyze_route must produce a RouteOption
    with total_distance_km and total_duration_min matching the input
    (rounded to 2 and 1 decimal places respectively).
    """

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_distance_preserved(self, raw):
        option = analyze_route(raw)
        assert option.total_distance_km == round(raw.distance_km, 2)

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_duration_preserved(self, raw):
        option = analyze_route(raw)
        assert option.total_duration_min == round(raw.duration_min, 1)


# ---------------------------------------------------------------------------
# Property 3: analyze_route computes correct emissions
# ---------------------------------------------------------------------------

class TestAnalyzeRouteEmissions:
    """
    **Validates: Requirements 3.1, 3.4**

    For any single-segment RawRouteResult, total_emissions_g must equal
    the emission factor * distance, and total_emissions_kg = total_emissions_g / 1000.
    """

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_emissions_correct(self, raw):
        option = analyze_route(raw)
        expected_g = round(compute_emissions_g(raw.mode, raw.distance_km), 1)
        assert option.total_emissions_g == expected_g, (
            f"Emissions mismatch for {raw.mode}: expected={expected_g}, got={option.total_emissions_g}"
        )

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_emissions_kg_consistent(self, raw):
        """total_emissions_kg must be close to total_emissions_g / 1000, within rounding tolerance."""
        option = analyze_route(raw)
        # The code rounds total_emissions_g and total_emissions_kg independently
        # from the unrounded accumulator, so allow a small tolerance for rounding.
        expected_kg_approx = option.total_emissions_g / 1000.0
        assert abs(option.total_emissions_kg - expected_kg_approx) < 0.002, (
            f"Emissions kg inconsistent: total_g={option.total_emissions_g}, "
            f"total_kg={option.total_emissions_kg}, expected_approx={expected_kg_approx:.4f}"
        )


# ---------------------------------------------------------------------------
# Property 4: analyze_route computes correct cost
# ---------------------------------------------------------------------------

class TestAnalyzeRouteCost:
    """
    **Validates: Requirements 3.1**

    For any single-segment RawRouteResult, total_cost_usd must equal
    base_fare + per_km_cost * distance.
    """

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_cost_correct(self, raw):
        option = analyze_route(raw)
        cost_factor = get_cost_factor(raw.mode)
        expected_cost = round(compute_cost(raw.mode, raw.distance_km) + cost_factor.base_fare, 2)
        assert option.total_cost_usd == expected_cost, (
            f"Cost mismatch for {raw.mode}: expected={expected_cost}, got={option.total_cost_usd}"
        )


# ---------------------------------------------------------------------------
# Property 5: analyze_route populates source fields correctly
# ---------------------------------------------------------------------------

class TestAnalyzeRouteSources:
    """
    **Validates: Requirements 3.1**

    For any RawRouteResult, emission_factor_source and cost_source must
    match the canonical factor tables.
    """

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_emission_factor_source(self, raw):
        option = analyze_route(raw)
        expected_source = get_factor(raw.mode).source
        assert option.emission_factor_source == expected_source

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_cost_source(self, raw):
        option = analyze_route(raw)
        expected_source = get_cost_factor(raw.mode).source
        assert option.cost_source == expected_source


# ---------------------------------------------------------------------------
# Property 6: analyze_route produces correct segments
# ---------------------------------------------------------------------------

class TestAnalyzeRouteSegments:
    """
    **Validates: Requirements 3.1, 3.3**

    For any RawRouteResult, the number of segments in the output must
    match the input, and each segment must have correct emissions and cost.
    """

    @given(raw=raw_route_results())
    @settings(max_examples=50)
    def test_segment_count_preserved(self, raw):
        option = analyze_route(raw)
        assert len(option.segments) == len(raw.segments)

    @given(raw=multi_segment_raw_route_results())
    @settings(max_examples=30)
    def test_multi_segment_emissions_sum(self, raw):
        """Total emissions must equal the sum of per-segment emissions."""
        option = analyze_route(raw)
        seg_total = round(sum(s.emissions_g for s in option.segments), 1)
        assert abs(option.total_emissions_g - seg_total) < 0.2, (
            f"Segment emissions sum {seg_total} != total {option.total_emissions_g}"
        )


# ---------------------------------------------------------------------------
# Property 7: find_greenest returns the option with minimum emissions
# ---------------------------------------------------------------------------

class TestFindGreenest:
    """
    **Validates: Requirements 3.4**

    find_greenest must return the RouteOption with the lowest total_emissions_g.
    """

    @given(options=route_option_lists())
    @settings(max_examples=30)
    def test_greenest_has_min_emissions(self, options):
        greenest = find_greenest(options)
        assert greenest is not None
        min_emissions = min(o.total_emissions_g for o in options)
        assert greenest.total_emissions_g == min_emissions

    def test_greenest_empty_returns_none(self):
        assert find_greenest([]) is None


# ---------------------------------------------------------------------------
# Property 8: find_fastest returns the option with minimum duration
# ---------------------------------------------------------------------------

class TestFindFastest:
    """
    **Validates: Requirements 3.4**

    find_fastest must return the RouteOption with the lowest total_duration_min.
    """

    @given(options=route_option_lists())
    @settings(max_examples=30)
    def test_fastest_has_min_duration(self, options):
        fastest = find_fastest(options)
        assert fastest is not None
        min_duration = min(o.total_duration_min for o in options)
        assert fastest.total_duration_min == min_duration

    def test_fastest_empty_returns_none(self):
        assert find_fastest([]) is None


# ---------------------------------------------------------------------------
# Property 9: find_cheapest returns the option with minimum cost
# ---------------------------------------------------------------------------

class TestFindCheapest:
    """
    **Validates: Requirements 3.4**

    find_cheapest must return the RouteOption with the lowest total_cost_usd.
    """

    @given(options=route_option_lists())
    @settings(max_examples=30)
    def test_cheapest_has_min_cost(self, options):
        cheapest = find_cheapest(options)
        assert cheapest is not None
        min_cost = min(o.total_cost_usd for o in options)
        assert cheapest.total_cost_usd == min_cost

    def test_cheapest_empty_returns_none(self):
        assert find_cheapest([]) is None


# ---------------------------------------------------------------------------
# Property 10: savings_vs_driving returns correct value
# ---------------------------------------------------------------------------

class TestSavingsVsDriving:
    """
    **Validates: Requirements 3.4**

    savings_vs_driving must return the difference in kg CO2 between
    driving and the greenest option, or None if driving is not present.
    """

    @given(
        driving_dist=distances,
        driving_dur=durations,
        other_mode=st.sampled_from([m for m in TransitMode if m != TransitMode.DRIVING]),
        other_dist=distances,
        other_dur=durations,
    )
    @settings(max_examples=30)
    def test_savings_correct_with_driving(self, driving_dist, driving_dur, other_mode, other_dist, other_dur):
        raws = [
            _make_single_segment_raw(TransitMode.DRIVING, driving_dist, driving_dur),
            _make_single_segment_raw(other_mode, other_dist, other_dur),
        ]
        options = analyze_all(raws)
        savings = savings_vs_driving(options)

        driving_opt = next(o for o in options if o.mode == TransitMode.DRIVING)
        greenest = find_greenest(options)
        expected = round((driving_opt.total_emissions_g - greenest.total_emissions_g) / 1000.0, 3)

        assert savings is not None
        assert savings == expected

    @given(
        mode=st.sampled_from([m for m in TransitMode if m != TransitMode.DRIVING]),
        dist=distances,
        dur=durations,
    )
    @settings(max_examples=20)
    def test_savings_none_without_driving(self, mode, dist, dur):
        raws = [_make_single_segment_raw(mode, dist, dur)]
        options = analyze_all(raws)
        assert savings_vs_driving(options) is None
