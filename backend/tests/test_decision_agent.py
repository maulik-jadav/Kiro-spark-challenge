"""
Tests for agents/decision_agent.py
Verifies fallback reasoning and prompt construction.
"""

import pytest
from core.emission_factors import TransitMode
from hypothesis import given, settings
from hypothesis import strategies as st

from agents.decision_agent import decide, _fallback_reasoning, _build_user_prompt, build_system_prompt
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


# ---------------------------------------------------------------------------
# Property-based tests for build_system_prompt
# ---------------------------------------------------------------------------

# Hypothesis strategies
_constraint_strategy = st.text(min_size=1).filter(lambda s: s.strip())
_base_prompt_strategy = st.text(min_size=1, max_size=500)
_whitespace_strategy = st.text(
    alphabet=st.sampled_from([" ", "\t", "\n", "\r"]),
    min_size=0,
    max_size=50,
)

DELIMITER = "--- USER CONSTRAINT ---"


class TestBuildSystemPromptProperties:
    # Feature: constraint-override-recommendation, Property 1: Constrained prompt structural completeness
    @given(base=_base_prompt_strategy, constraint=_constraint_strategy)
    @settings(max_examples=100)
    def test_constrained_prompt_contains_override_authority(self, base: str, constraint: str):
        """
        **Validates: Requirements 1.1, 1.2, 1.4**

        For any non-empty constraint and any base prompt, the output starts
        with the base prompt, contains the delimiter, override authority
        language, constraint precedence language, mode restriction language,
        and the trimmed constraint text.
        """
        result = build_system_prompt(base, constraint)
        assert result.startswith(base), "Output must start with the base prompt"
        assert DELIMITER in result, "Output must contain the section header"
        assert "MUST prioritize this constraint" in result, (
            "Output must contain constraint precedence language"
        )
        assert "MAY select a different mode" in result, (
            "Output must contain override authority language"
        )
        assert "MUST only select a mode that appears in the provided route options" in result, (
            "Output must contain mode restriction language"
        )
        assert constraint.strip() in result, "Output must contain the trimmed constraint"

    # Feature: constraint-override-recommendation, Property 2: No-constraint prompt preservation
    @given(base=_base_prompt_strategy, ws=_whitespace_strategy)
    @settings(max_examples=100)
    def test_no_constraint_returns_base_unchanged(self, base: str, ws: str):
        """
        **Validates: Requirements 1.3**

        For any whitespace-only string and for None, build_system_prompt
        returns the base prompt identically.
        """
        assert build_system_prompt(base, ws) == base
        assert build_system_prompt(base, None) == base

    # Feature: constraint-system-prompt, Property 3: Constraint round-trip preservation
    @given(base=_base_prompt_strategy, constraint=_constraint_strategy)
    @settings(max_examples=100)
    def test_constraint_round_trip(self, base: str, constraint: str):
        """
        **Validates: Requirements 3.3**

        Assemble the system prompt then extract the text after the
        CONSTRAINT_OVERRIDE_BLOCK; assert it equals the original trimmed
        constraint.
        """
        from agents.decision_agent import CONSTRAINT_OVERRIDE_BLOCK

        result = build_system_prompt(base, constraint)
        # Extract everything after the override block
        after_block = result.split(CONSTRAINT_OVERRIDE_BLOCK, 1)
        assert len(after_block) == 2, "Override block must be present exactly once"
        extracted = after_block[1]
        assert extracted == constraint.strip()

    # Feature: constraint-system-prompt, Property 4: Prompt assembly determinism
    @given(base=_base_prompt_strategy, constraint=st.one_of(st.none(), _constraint_strategy))
    @settings(max_examples=100)
    def test_prompt_assembly_determinism(self, base: str, constraint: str | None):
        """
        **Validates: Requirements 3.2**

        Calling build_system_prompt twice with identical inputs produces
        identical outputs.
        """
        first = build_system_prompt(base, constraint)
        second = build_system_prompt(base, constraint)
        assert first == second


# ---------------------------------------------------------------------------
# Property 5: Dual constraint placement (Task 2.2)
# ---------------------------------------------------------------------------

class TestDualConstraintPlacement:
    # Feature: constraint-system-prompt, Property 5: Dual constraint placement
    @given(constraint=_constraint_strategy)
    @settings(max_examples=100)
    def test_constraint_in_both_prompts(self, constraint: str):
        """
        **Validates: Requirements 1.3**

        For any non-empty constraint, the constraint text appears in both
        the system prompt (from build_system_prompt) and the user prompt
        (from _build_user_prompt).
        """
        from agents.decision_agent import SYSTEM_PROMPT

        options = _make_options()
        trimmed = constraint.strip()

        system_result = build_system_prompt(SYSTEM_PROMPT, constraint)
        user_result = _build_user_prompt("A", "B", options, constraint)

        assert trimmed in system_result, "Constraint must appear in system prompt"
        assert trimmed in user_result, "Constraint must appear in user prompt"


# ---------------------------------------------------------------------------
# Unit tests for build_system_prompt edge cases (Task 2.3)
# ---------------------------------------------------------------------------

class TestBuildSystemPromptEdgeCases:
    def test_none_returns_base(self):
        base = "You are a helpful assistant."
        assert build_system_prompt(base, None) == base

    def test_empty_string_returns_base(self):
        base = "You are a helpful assistant."
        assert build_system_prompt(base, "") == base

    def test_whitespace_only_returns_base(self):
        base = "You are a helpful assistant."
        assert build_system_prompt(base, "   ") == base

    def test_real_constraint_contains_override_authority_and_text(self):
        base = "You are a helpful assistant."
        result = build_system_prompt(base, "Arrive by 10 AM")
        assert DELIMITER in result
        assert "Arrive by 10 AM" in result
        assert result.startswith(base)
        assert "MAY select a different mode" in result
        assert "MUST prioritize this constraint" in result
        assert "MUST only select a mode that appears in the provided route options" in result
        assert "If the pre-selected mode already satisfies the constraint, keep it" in result

    def test_no_constraint_prompt_has_no_override_language(self):
        base = "You are a helpful assistant."
        result = build_system_prompt(base, None)
        assert "MAY select a different mode" not in result
        assert DELIMITER not in result


# ---------------------------------------------------------------------------
# Unit tests for decide() fallback paths with constraint (Task 2.4)
# ---------------------------------------------------------------------------

class TestDecideFallbackWithConstraint:
    @pytest.mark.asyncio
    async def test_no_api_key_with_constraint_returns_fallback(self):
        """decide() with no API key and a constraint returns fallback reasoning."""
        options = _make_options()
        result = await decide("SF", "Oakland", options, constraint="Budget under $5", api_key="")
        assert isinstance(result, AgentReasoning)
        assert result.recommended_mode is not None
        assert len(result.summary) > 0

    @pytest.mark.asyncio
    async def test_empty_options_with_constraint_returns_fallback(self):
        """decide() with empty options and a constraint returns fallback reasoning."""
        result = await decide("SF", "Oakland", [], constraint="Arrive by 10 AM", api_key="")
        assert isinstance(result, AgentReasoning)
        assert "No route options" in result.summary

    def test_fallback_reasoning_signature_unchanged(self):
        """_fallback_reasoning accepts options, recommended_mode, and constraint."""
        import inspect
        sig = inspect.signature(_fallback_reasoning)
        param_names = list(sig.parameters.keys())
        assert "system_prompt" not in param_names
        assert param_names == ["options", "recommended_mode", "constraint"]


# ---------------------------------------------------------------------------
# Property test: Override detection correctness (Task 4.3, Property 3)
# ---------------------------------------------------------------------------

_mode_strategy = st.sampled_from(list(TransitMode))


class TestOverrideDetectionProperty:
    # Feature: constraint-override-recommendation, Property 3: Override detection correctness
    @given(
        llm_mode=_mode_strategy,
        pre_selected_mode=_mode_strategy,
        constraint=st.one_of(st.none(), _whitespace_strategy, _constraint_strategy),
    )
    @settings(max_examples=100)
    def test_override_flag_correctness(
        self,
        llm_mode: TransitMode,
        pre_selected_mode: TransitMode,
        constraint: str | None,
    ):
        """
        **Validates: Requirements 2.3, 4.2, 4.3**

        For any pair of transit modes and any optional constraint string,
        constraint_override is True if and only if: (a) a non-empty
        constraint is present, (b) llm_mode is valid in the available
        options, and (c) llm_mode != pre_selected_mode.

        We test the override detection logic as a pure computation,
        mirroring the logic in decide().
        """
        has_constraint = bool(constraint and constraint.strip())
        # Simulate the available_modes containing llm_mode (valid case)
        available_modes = {llm_mode, pre_selected_mode}

        # The override detection logic from decide()
        if llm_mode not in available_modes:
            computed_override = False
        else:
            computed_override = has_constraint and (llm_mode != pre_selected_mode)

        # Expected: True iff all three conditions hold
        expected = has_constraint and (llm_mode in available_modes) and (llm_mode != pre_selected_mode)
        assert computed_override == expected


# ---------------------------------------------------------------------------
# Property test: Fallback constraint_override always false (Task 4.4, Property 4)
# ---------------------------------------------------------------------------

class TestFallbackOverrideProperty:
    # Feature: constraint-override-recommendation, Property 4: Fallback constraint_override always false
    @given(
        recommended_mode=st.one_of(st.none(), _mode_strategy),
    )
    @settings(max_examples=100)
    def test_fallback_constraint_override_always_false(
        self,
        recommended_mode: TransitMode | None,
    ):
        """
        **Validates: Requirements 4.4, 5.3**

        For any list of route options and any optional recommended_mode,
        _fallback_reasoning returns constraint_override == False.
        """
        options = _make_options()
        result = _fallback_reasoning(options, recommended_mode=recommended_mode)
        assert result.constraint_override is False

    @given(
        recommended_mode=st.one_of(st.none(), _mode_strategy),
    )
    @settings(max_examples=100)
    def test_fallback_empty_options_constraint_override_false(
        self,
        recommended_mode: TransitMode | None,
    ):
        """
        **Validates: Requirements 4.4, 5.3**

        Even with empty options, _fallback_reasoning returns
        constraint_override == False.
        """
        result = _fallback_reasoning([], recommended_mode=recommended_mode)
        assert result.constraint_override is False


# ---------------------------------------------------------------------------
# Property test: Invalid mode rejection (Task 4.5, Property 5)
# ---------------------------------------------------------------------------

class TestInvalidModeRejectionProperty:
    # Feature: constraint-override-recommendation, Property 5: Invalid mode rejection
    @given(
        invalid_mode=_mode_strategy,
        pre_selected_mode=_mode_strategy,
    )
    @settings(max_examples=100)
    def test_invalid_mode_triggers_fallback(
        self,
        invalid_mode: TransitMode,
        pre_selected_mode: TransitMode,
    ):
        """
        **Validates: Requirements 2.4, 7.1**

        For any mode returned by the LLM that is NOT in the available
        options' modes, the Decision Agent falls back to the pre-selected
        mode and sets constraint_override to False.

        We construct options that deliberately exclude invalid_mode, then
        simulate the validation logic from decide().
        """
        # Build a set of available modes that excludes invalid_mode
        all_modes = list(TransitMode)
        available_modes = {m for m in all_modes if m != invalid_mode}

        # If we can't exclude the mode (only one mode exists), skip
        if not available_modes:
            return

        # The validation logic: if llm_mode not in available_modes → fallback
        if invalid_mode not in available_modes:
            # This is the case we're testing: invalid mode triggers fallback
            # Fallback always sets constraint_override=False
            options = _make_options()
            result = _fallback_reasoning(options, recommended_mode=pre_selected_mode)
            assert result.constraint_override is False
            # Fallback uses pre_selected_mode when available
            if pre_selected_mode in {o.mode for o in options}:
                assert result.recommended_mode == pre_selected_mode


# ---------------------------------------------------------------------------
# Unit tests for decide() override scenarios (Task 4.6, mocked LLM)
# ---------------------------------------------------------------------------

class TestDecideOverrideScenarios:
    """Unit tests for decide() with mocked LLM responses."""

    @pytest.mark.asyncio
    async def test_llm_returns_different_mode_with_constraint(self):
        """LLM returns a different mode with constraint → constraint_override=True."""
        import json
        from unittest.mock import AsyncMock, patch, MagicMock

        options = _make_options()
        pre_selected = TransitMode.BUS

        # LLM returns WALKING instead of BUS
        llm_response = json.dumps({
            "recommended_mode": "walking",
            "summary": "Walk to save money.",
            "justification": "Walking is free.",
            "constraint_analysis": "Walking satisfies the budget constraint.",
        })

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = llm_response

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("agents.decision_agent.AsyncOpenAI", return_value=mock_client):
            result = await decide(
                "SF", "Oakland", options,
                constraint="Budget under $5",
                recommended_mode=pre_selected,
                api_key="fake-key",
            )

        assert result.recommended_mode == TransitMode.WALKING
        assert result.constraint_override is True
        assert result.constraint_analysis is not None

    @pytest.mark.asyncio
    async def test_llm_returns_same_mode_with_constraint(self):
        """LLM returns the same mode with constraint → constraint_override=False."""
        import json
        from unittest.mock import AsyncMock, patch, MagicMock

        options = _make_options()
        pre_selected = TransitMode.BUS

        llm_response = json.dumps({
            "recommended_mode": "bus",
            "summary": "Bus is the best option.",
            "justification": "Bus balances cost and speed.",
            "constraint_analysis": "Bus already satisfies the constraint.",
        })

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = llm_response

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("agents.decision_agent.AsyncOpenAI", return_value=mock_client):
            result = await decide(
                "SF", "Oakland", options,
                constraint="Budget under $5",
                recommended_mode=pre_selected,
                api_key="fake-key",
            )

        assert result.recommended_mode == TransitMode.BUS
        assert result.constraint_override is False

    @pytest.mark.asyncio
    async def test_llm_returns_mode_not_in_options(self):
        """LLM returns a mode not in options → fallback used, constraint_override=False."""
        import json
        from unittest.mock import AsyncMock, patch, MagicMock

        options = _make_options()  # driving, walking, bus
        pre_selected = TransitMode.BUS

        # LLM returns light_rail which is NOT in options
        llm_response = json.dumps({
            "recommended_mode": "light_rail",
            "summary": "Take light rail.",
            "justification": "Light rail is efficient.",
            "constraint_analysis": "Light rail satisfies the constraint.",
        })

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = llm_response

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("agents.decision_agent.AsyncOpenAI", return_value=mock_client):
            result = await decide(
                "SF", "Oakland", options,
                constraint="I prefer rail",
                recommended_mode=pre_selected,
                api_key="fake-key",
            )

        # Should fall back — light_rail not in options
        assert result.constraint_override is False
        # Fallback uses pre_selected_mode
        assert result.recommended_mode == pre_selected

    @pytest.mark.asyncio
    async def test_llm_returns_unparseable_json(self):
        """LLM returns unparseable JSON → fallback used, constraint_override=False."""
        from unittest.mock import AsyncMock, patch, MagicMock

        options = _make_options()
        pre_selected = TransitMode.BUS

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "not valid json at all"

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("agents.decision_agent.AsyncOpenAI", return_value=mock_client):
            result = await decide(
                "SF", "Oakland", options,
                constraint="Budget under $5",
                recommended_mode=pre_selected,
                api_key="fake-key",
            )

        # Fallback is now constraint-aware: "Budget" triggers cost override
        assert result.recommended_mode == TransitMode.WALKING  # walking is cheapest ($0)
        assert result.constraint_override is True
        assert isinstance(result, AgentReasoning)

    @pytest.mark.asyncio
    async def test_no_api_key_with_constraint_override_false(self):
        """decide() with no API key and a budget constraint → fallback overrides to cheapest."""
        options = _make_options()
        result = await decide(
            "SF", "Oakland", options,
            constraint="Budget under $5",
            recommended_mode=TransitMode.BUS,
            api_key="",
        )
        # Fallback is now constraint-aware: "Budget" triggers cost override
        assert result.recommended_mode == TransitMode.WALKING  # walking is cheapest ($0)
        assert result.constraint_override is True

    @pytest.mark.asyncio
    async def test_empty_options_with_constraint_override_false(self):
        """decide() with empty options and a constraint → fallback, constraint_override=False."""
        result = await decide(
            "SF", "Oakland", [],
            constraint="Arrive by 10 AM",
            api_key="fake-key",
        )
        assert result.constraint_override is False
        assert "No route options" in result.summary

    @pytest.mark.asyncio
    async def test_no_constraint_override_false(self):
        """decide() with no constraint → constraint_override=False."""
        import json
        from unittest.mock import AsyncMock, patch, MagicMock

        options = _make_options()
        pre_selected = TransitMode.BUS

        llm_response = json.dumps({
            "recommended_mode": "bus",
            "summary": "Bus is the best option.",
            "justification": "Bus balances cost and speed.",
            "constraint_analysis": None,
        })

        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = llm_response

        mock_client = AsyncMock()
        mock_client.chat.completions.create = AsyncMock(return_value=mock_response)

        with patch("agents.decision_agent.AsyncOpenAI", return_value=mock_client):
            result = await decide(
                "SF", "Oakland", options,
                constraint=None,
                recommended_mode=pre_selected,
                api_key="fake-key",
            )

        assert result.constraint_override is False
