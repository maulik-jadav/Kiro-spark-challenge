"""
Tests for agents/decision_agent.py
Verifies fallback reasoning and prompt construction.
"""

import pytest
from core.emission_factors import TransitMode
from agents.decision_agent import decide, _fallback_reasoning, _build_user_prompt
from agents.emissions_agent import analyze_all
from services.maps_client import RawRouteResult
from models.schemas import AgentReasoning


def _make_raw(mode, dist, dur):
    return RawRouteResult(
        mode=mode, distance_km=dist, duration_min=dur,
        segments=[{"mode": mode.value, "distance_km": dist, "duration_min": dur, "description": ""}],
    )


def _make_options():
    raws = [
        _make_raw(TransitMode.DRIVING, 20.0, 15.0),
        _make_raw(TransitMode.WALKING, 3.0, 36.0),
        _make_raw(TransitMode.BUS, 12.0, 25.0),
    ]
    return analyze_all(raws)


# ---------------------------------------------------------------------------
# Fallback reasoning
# ---------------------------------------------------------------------------

class TestFallbackReasoning:
    def test_returns_agent_reasoning(self):
        options = _make_options()
        result = _fallback_reasoning(options)
        assert isinstance(result, AgentReasoning)

    def test_recommends_balanced_option(self):
        """Should pick a balanced option, not always greenest or fastest."""
        options = _make_options()
        result = _fallback_reasoning(options)
        # Bus (12km, 25min, medium emissions) should beat walking (60min)
        # and driving (high emissions, high cost)
        assert result.recommended_mode == TransitMode.BUS

    def test_empty_options(self):
        result = _fallback_reasoning([])
        assert result.recommended_mode == TransitMode.WALKING
        assert "No route options" in result.summary

    def test_summary_is_nonempty(self):
        options = _make_options()
        result = _fallback_reasoning(options)
        assert len(result.summary) > 10

    def test_justification_is_nonempty(self):
        options = _make_options()
        result = _fallback_reasoning(options)
        assert len(result.justification) > 10

    def test_mentions_priority(self):
        options = _make_options()
        result = _fallback_reasoning(options)
        assert "priority" in result.justification.lower()

    def test_considers_time_not_just_emissions(self):
        """Fallback should balance time and emissions, not always pick greenest."""
        raws = [
            _make_raw(TransitMode.DRIVING, 15.0, 10.0),     # fast but dirty
            _make_raw(TransitMode.WALKING, 15.0, 180.0),    # clean but 3 hours
            _make_raw(TransitMode.LIGHT_RAIL, 15.0, 25.0),  # balanced
        ]
        options = analyze_all(raws)
        result = _fallback_reasoning(options)
        # Should NOT recommend walking (180 min) just because it's greenest
        assert result.recommended_mode != TransitMode.WALKING


# ---------------------------------------------------------------------------
# Prompt construction
# ---------------------------------------------------------------------------

class TestBuildUserPrompt:
    def test_includes_origin_destination(self):
        options = _make_options()
        prompt = _build_user_prompt("SF", "Oakland", options, None)
        assert "SF" in prompt
        assert "Oakland" in prompt

    def test_includes_all_modes(self):
        options = _make_options()
        prompt = _build_user_prompt("SF", "Oakland", options, None)
        assert "driving" in prompt
        assert "walking" in prompt
        assert "bus" in prompt

    def test_includes_constraint_when_given(self):
        options = _make_options()
        prompt = _build_user_prompt("SF", "Oakland", options, "Arrive by 10 AM")
        assert "Arrive by 10 AM" in prompt

    def test_no_constraint_text_when_none(self):
        options = _make_options()
        prompt = _build_user_prompt("SF", "Oakland", options, None)
        assert "User constraint" not in prompt


# ---------------------------------------------------------------------------
# decide() with no API key (should use fallback)
# ---------------------------------------------------------------------------

class TestDecideNoKey:
    @pytest.mark.asyncio
    async def test_no_api_key_uses_fallback(self):
        options = _make_options()
        result = await decide("SF", "Oakland", options, api_key="")
        assert isinstance(result, AgentReasoning)
        assert "priority" in result.justification.lower()

    @pytest.mark.asyncio
    async def test_empty_options_with_no_key(self):
        result = await decide("SF", "Oakland", [], api_key="")
        assert "No route options" in result.summary
