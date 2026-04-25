# Implementation Plan: Constraint Override Recommendation

## Overview

This plan implements the constraint-override-recommendation feature, which grants the Decision Agent LLM authority to override the scoring engine's pre-selected recommendation when a user constraint is present. The implementation proceeds in layers: schema changes first, then prompt and decision logic updates, then response validation, and finally frontend display. Each step builds on the previous one and ends with wiring into the existing pipeline.

## Tasks

- [x] 1. Add `constraint_override` field to data models
  - [x] 1.1 Add `constraint_override` boolean field to `AgentReasoning` in `backend/models/schemas.py`
    - Add `constraint_override: bool = Field(default=False, description="True when the LLM selected a different mode than the scoring engine's pick due to a constraint.")`
    - Default `False` ensures backward compatibility with existing code that constructs `AgentReasoning` without this field
    - _Requirements: 4.1_
  - [x] 1.2 Add `constraint_override` field to `AgentReasoning` in `frontend/src/types/api.ts`
    - Add `constraint_override: boolean` to the `AgentReasoning` interface
    - _Requirements: 4.1_

- [x] 2. Update `build_system_prompt` with override authority instructions
  - [x] 2.1 Replace the constraint block in `build_system_prompt` in `backend/agents/decision_agent.py`
    - Define a new `CONSTRAINT_OVERRIDE_BLOCK` constant that includes override authority language: "You MAY select a different mode", "MUST prioritize this constraint", "MUST only select a mode that appears in the provided route options", and "If the pre-selected mode already satisfies the constraint, keep it"
    - Update `build_system_prompt` to use `CONSTRAINT_OVERRIDE_BLOCK` instead of the current simpler block when a constraint is present
    - When no constraint is present, continue returning the base prompt unchanged (preserving current behavior)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - [x]* 2.2 Write property test: Constrained prompt structural completeness (Property 1)
    - **Property 1: Constrained prompt structural completeness**
    - For any non-empty constraint and base prompt, assert the output starts with the base prompt, contains the `--- USER CONSTRAINT ---` delimiter, contains override authority language ("MAY select a different mode"), contains constraint precedence language ("MUST prioritize this constraint"), contains mode restriction language ("MUST only select a mode that appears in the provided route options"), and contains the trimmed constraint text
    - **Validates: Requirements 1.1, 1.2, 1.4**
  - [x]* 2.3 Write property test: No-constraint prompt preservation (Property 2)
    - **Property 2: No-constraint prompt preservation**
    - For any base prompt and any constraint that is `None` or whitespace-only, assert `build_system_prompt` returns the base prompt identically
    - **Validates: Requirements 1.3**
  - [x]* 2.4 Write unit tests for `build_system_prompt` edge cases
    - Test `None` constraint returns base prompt unchanged
    - Test empty string `""` returns base prompt unchanged
    - Test whitespace-only `"   "` returns base prompt unchanged
    - Test real constraint contains override authority language and constraint text
    - Test that the no-constraint prompt does NOT contain override authority language
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update `decide()` with mode validation and override detection
  - [x] 4.1 Add mode validation and `constraint_override` computation to `decide()` in `backend/agents/decision_agent.py`
    - Compute `available_modes` set from the options list
    - After parsing the LLM JSON response, validate that the returned `recommended_mode` exists in `available_modes`
    - If the mode is NOT in `available_modes`, fall back to `_fallback_reasoning` (which uses the pre-selected mode and sets `constraint_override=False`)
    - Compute `constraint_override` deterministically: `True` only when a non-empty constraint is present AND the LLM picked a different mode than the pre-selected one
    - Pass `constraint_override` to the returned `AgentReasoning`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.2, 4.3, 7.1, 7.2_
  - [x] 4.2 Update `_fallback_reasoning` to include `constraint_override=False`
    - Add `constraint_override=False` to all `AgentReasoning` return statements in `_fallback_reasoning`
    - The function signature remains unchanged
    - _Requirements: 4.4, 5.1, 5.2, 5.3_
  - [x]* 4.3 Write property test: Override detection correctness (Property 3)
    - **Property 3: Override detection correctness**
    - For any pair of transit modes `(llm_mode, pre_selected_mode)` and any optional constraint string, assert `constraint_override` is `True` if and only if: (a) a non-empty constraint is present, (b) `llm_mode` is valid in the available options, and (c) `llm_mode != pre_selected_mode`
    - **Validates: Requirements 2.3, 4.2, 4.3**
  - [x]* 4.4 Write property test: Fallback constraint_override always false (Property 4)
    - **Property 4: Fallback reasoning always sets constraint_override to false**
    - For any list of route options and any optional `recommended_mode`, assert `_fallback_reasoning` returns `constraint_override == False`
    - **Validates: Requirements 4.4, 5.3**
  - [x]* 4.5 Write property test: Invalid mode rejection (Property 5)
    - **Property 5: Invalid mode rejection**
    - For any set of available route options and any `recommended_mode` returned by the LLM that is NOT in the available options' modes, assert the Decision Agent falls back to the pre-selected mode and sets `constraint_override` to `False`
    - **Validates: Requirements 2.4, 7.1**
  - [x]* 4.6 Write unit tests for `decide()` override scenarios
    - Test: LLM returns a different mode with constraint present → `constraint_override=True`, mode accepted
    - Test: LLM returns the same mode with constraint present → `constraint_override=False`
    - Test: LLM returns a mode not in options → fallback used, `constraint_override=False`
    - Test: LLM returns unparseable JSON → fallback used, `constraint_override=False`
    - Test: `decide()` with no API key and a constraint → fallback, `constraint_override=False`
    - Test: `decide()` with empty options and a constraint → fallback, `constraint_override=False`
    - Test: `decide()` with no constraint → `constraint_override=False`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.2, 4.3, 4.4, 5.1, 5.2, 7.1, 7.2_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Verify orchestrator passthrough behavior
  - [x] 6.1 Verify orchestrator passes constraint and pre-selected mode to `decide()` unchanged
    - Review `backend/agents/orchestrator.py` to confirm `constraint` and `recommended_mode` are passed through without modification (no code changes expected — existing tests in `TestOrchestratorConstraintPassthrough` already cover Req 6.1 and 6.2)
    - Verify the orchestrator uses `reasoning.recommended_mode` from the `AgentReasoning` response (which may now differ from the scoring engine's pick) as the final recommendation
    - _Requirements: 6.1, 6.2, 6.3_
  - [x]* 6.2 Write integration test for orchestrator override passthrough
    - Mock `decide()` to return an `AgentReasoning` with a different `recommended_mode` than the scoring engine's pick and `constraint_override=True`
    - Verify `RouteComparison.reasoning.recommended_mode` reflects the overridden mode
    - Verify `RouteComparison.reasoning.constraint_override` is `True`
    - _Requirements: 6.3, 4.1, 4.2_

- [x] 7. Update frontend to display override indicator
  - [x] 7.1 Update `ReasoningPanel` component to show override badge
    - Add a visual indicator in `frontend/src/components/ReasoningPanel.tsx` that renders when `reasoning.constraint_override` is `true`
    - Use the Material Symbols `swap_horiz` icon with text "Recommendation adjusted based on your constraint"
    - Do not render the badge when `constraint_override` is `false`
    - _Requirements: 4.1, 4.2, 4.3_
  - [x]* 7.2 Write unit tests for `ReasoningPanel` override badge
    - Test: renders override badge when `constraint_override` is `true`
    - Test: does not render override badge when `constraint_override` is `false`
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using Hypothesis
- Unit tests validate specific examples and edge cases
- The orchestrator requires no code changes — existing passthrough behavior already satisfies Requirement 6
- The `constraint_override` field defaults to `False` for backward compatibility, so existing code constructing `AgentReasoning` without it will continue to work
