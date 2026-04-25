"""
Bug Condition Exploration Tests — Route Polyline Data Missing From Pipeline

These tests encode the EXPECTED (correct) behavior for polyline data flowing
through the route pipeline. On UNFIXED code, they are expected to FAIL,
which confirms the bug exists.

Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3
"""

import inspect

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from core.emission_factors import TransitMode
from models.schemas import RouteOption
from services.maps_client import RawRouteResult


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

transit_modes = st.sampled_from(list(TransitMode))
distances = st.floats(min_value=0.1, max_value=500.0, allow_nan=False, allow_infinity=False)
durations = st.floats(min_value=1.0, max_value=600.0, allow_nan=False, allow_infinity=False)


# ---------------------------------------------------------------------------
# 1. Field mask includes polyline (confirms root cause #1)
# ---------------------------------------------------------------------------

class TestFieldMaskIncludesPolyline:
    """
    The X-Goog-FieldMask header in live_route must include
    'routes.polyline.encodedPolyline' so the Google Maps API returns
    polyline geometry.

    **Validates: Requirements 1.1, 2.1**
    """

    def test_field_mask_contains_polyline(self):
        """Inspect the live_route source to verify the field mask includes polyline."""
        from services.maps_client import live_route

        source = inspect.getsource(live_route)
        assert "routes.polyline.encodedPolyline" in source, (
            "BUG CONFIRMED: The X-Goog-FieldMask header in live_route does NOT "
            "include 'routes.polyline.encodedPolyline'. Polyline data is never "
            "requested from the Google Maps Routes API."
        )


# ---------------------------------------------------------------------------
# 2. RawRouteResult has a polyline attribute (confirms root cause #2)
# ---------------------------------------------------------------------------

class TestRawRouteResultHasPolyline:
    """
    RawRouteResult must have a 'polyline' field so it can store the
    encoded polyline string extracted from the API response.

    **Validates: Requirements 1.2, 2.2**
    """

    def test_raw_route_result_has_polyline_attribute(self):
        """RawRouteResult dataclass must have a 'polyline' field."""
        assert hasattr(RawRouteResult, "polyline") or "polyline" in RawRouteResult.__dataclass_fields__, (
            "BUG CONFIRMED: RawRouteResult has no 'polyline' field. "
            "There is no way to store polyline data from the API response."
        )

    @given(mode=transit_modes, dist=distances, dur=durations)
    @settings(max_examples=10)
    def test_raw_route_result_accepts_polyline_kwarg(self, mode, dist, dur):
        """RawRouteResult must accept a polyline keyword argument."""
        try:
            result = RawRouteResult(
                mode=mode,
                distance_km=dist,
                duration_min=dur,
                segments=[{"mode": mode.value, "distance_km": dist, "duration_min": dur}],
                polyline="test_encoded_polyline_string",
            )
            assert result.polyline == "test_encoded_polyline_string"
        except TypeError as e:
            pytest.fail(
                f"BUG CONFIRMED: RawRouteResult does not accept 'polyline' kwarg: {e}"
            )


# ---------------------------------------------------------------------------
# 3. RouteOption schema includes a polyline field (confirms root cause #2)
# ---------------------------------------------------------------------------

class TestRouteOptionHasPolyline:
    """
    RouteOption Pydantic model must include a 'polyline' field so the
    encoded polyline string is serialized in the API response.

    **Validates: Requirements 1.3, 2.3**
    """

    def test_route_option_has_polyline_field(self):
        """RouteOption model must have a 'polyline' field in its schema."""
        field_names = set(RouteOption.model_fields.keys())
        assert "polyline" in field_names, (
            f"BUG CONFIRMED: RouteOption schema does not include a 'polyline' field. "
            f"Available fields: {sorted(field_names)}"
        )

    def test_route_option_polyline_serializes(self):
        """RouteOption with polyline must serialize it to dict/JSON."""
        option = RouteOption(
            mode=TransitMode.DRIVING,
            segments=[],
            total_distance_km=10.0,
            total_duration_min=15.0,
            total_emissions_g=2510.0,
            total_emissions_kg=2.51,
            total_cost_usd=4.20,
            emission_factor_source="test",
            cost_source="test",
            polyline="encoded_polyline_data",
        )
        data = option.model_dump()
        assert "polyline" in data, (
            "BUG CONFIRMED: RouteOption does not serialize 'polyline' field."
        )
        assert data["polyline"] == "encoded_polyline_data"


# ---------------------------------------------------------------------------
# 4. analyze_route passes polyline from RawRouteResult to RouteOption
#    (confirms root causes #3 and #4)
# ---------------------------------------------------------------------------

class TestAnalyzeRoutePassesPolyline:
    """
    analyze_route must pass the polyline from RawRouteResult through
    to the resulting RouteOption.

    **Validates: Requirements 2.2, 2.3**
    """

    @given(mode=transit_modes, dist=distances, dur=durations)
    @settings(max_examples=20)
    def test_analyze_route_preserves_polyline(self, mode, dist, dur):
        """
        For any RawRouteResult with a polyline, analyze_route must produce
        a RouteOption that also contains that polyline.
        """
        from agents.emissions_agent import analyze_route

        polyline_str = f"encoded_{mode.value}_{dist:.1f}"

        try:
            raw = RawRouteResult(
                mode=mode,
                distance_km=dist,
                duration_min=dur,
                segments=[{
                    "mode": mode.value,
                    "distance_km": dist,
                    "duration_min": dur,
                    "description": f"{mode.value} for {dist:.1f} km",
                }],
                polyline=polyline_str,
            )
        except TypeError:
            pytest.fail(
                "BUG CONFIRMED: RawRouteResult does not accept 'polyline' kwarg — "
                "cannot even construct input for analyze_route test."
            )

        option = analyze_route(raw)

        assert hasattr(option, "polyline"), (
            "BUG CONFIRMED: RouteOption returned by analyze_route has no 'polyline' attribute."
        )
        assert option.polyline == polyline_str, (
            f"BUG CONFIRMED: analyze_route did not pass polyline through. "
            f"Expected '{polyline_str}', got '{getattr(option, 'polyline', None)}'."
        )
