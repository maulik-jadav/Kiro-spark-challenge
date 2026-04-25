# Implementation Plan: Constraint System Prompt Injection

## Overview

Inject the user's constraint into the Decision Agent's LLM system prompt as a first-class instruction. This involves adding a pure `build_system_prompt` function, wiring it into `decide()`, and validating correctness with property-based and unit tests. The existing API contract, orchestrator passthrough, and fallback reasoning path remain unchanged.

## Tasks

- [x] 1. Implement `build_system_prompt` pure function
  - [x] 1.1 Add `build_system_prompt(base_prompt, constraint)` to `backend/agents/decision_agent.py`
    - Define the function below the `SYSTEM_PROMPT` constant and above `_build_user_prompt`
    - If `constraint` is `None`, empty, or whitespace-only, return `base_prompt` unchanged
    - If `constraint` is non-empty after trimming, append a `--- USER CONSTRAINT ---` section with a directive instructing the model to prioritize the constraint
    - Use the exact format specified in the design: header, directive sentence, trimmed constraint text
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 3.1_

  - [x]* 1.2 Write property test: Assembled prompt structural completeness (Property 1)
    - **Property 1: Assembled prompt structural completeness**
    - For any non-empty (after trimming) constraint and any base prompt, assert the output starts with the base prompt, contains `--- USER CONSTRAINT ---`, contains the prioritization directive, and contains the trimmed constraint text
    - Use Hypothesis `st.text(min_size=1).filter(lambda s: s.strip())` for constraints and `st.text(min_size=1, max_size=500)` for base prompts
    - Add to `backend/tests/test_decision_agent.py`
    - **Validates: Requirements 1.1, 1.4, 2.1, 2.2**

  - [x]* 1.3 Write property test: Whitespace-only constraints produce unmodified base prompt (Property 2)
    - **Property 2: Whitespace-only constraints produce unmodified base prompt**
    - For any whitespace-only string and for `None`, assert `build_system_prompt` returns the base prompt identically
    - Use Hypothesis `st.text(alphabet=st.sampled_from([' ', '\t', '\n', '\r']), min_size=0, max_size=50)` for whitespace strings
    - Add to `backend/tests/test_decision_agent.py`
    - **Validates: Requirements 1.2, 2.3**

  - [x]* 1.4 Write property test: Constraint round-trip preservation (Property 3)
    - **Property 3: Constraint round-trip preservation**
    - For any non-empty constraint, assemble the system prompt then extract the text after the delimiter and directive; assert it equals the original trimmed constraint
    - Add to `backend/tests/test_decision_agent.py`
    - **Validates: Requirements 3.3**

  - [x]* 1.5 Write property test: Prompt assembly determinism (Property 4)
    - **Property 4: Prompt assembly determinism**
    - For any base prompt and optional constraint, call `build_system_prompt` twice with identical inputs and assert identical outputs
    - Add to `backend/tests/test_decision_agent.py`
    - **Validates: Requirements 3.2**

- [x] 2. Wire `build_system_prompt` into `decide()`
  - [x] 2.1 Update `decide()` in `backend/agents/decision_agent.py` to use `build_system_prompt`
    - Replace the static `SYSTEM_PROMPT` reference in the `messages` list with `build_system_prompt(SYSTEM_PROMPT, constraint)`
    - Store the result in a local `system_prompt` variable and pass it to the system message
    - No other changes to `decide()` — the user prompt, fallback path, and error handling remain as-is
    - _Requirements: 1.1, 1.3, 5.1, 5.2, 5.3_

  - [x]* 2.2 Write property test: Dual constraint placement (Property 5)
    - **Property 5: Dual constraint placement**
    - For any non-empty constraint, assert the constraint text appears in both the output of `build_system_prompt` and the output of `_build_user_prompt`
    - Generate random route options using helper factories for `_build_user_prompt` arguments
    - Add to `backend/tests/test_decision_agent.py`
    - **Validates: Requirements 1.3**

  - [x]* 2.3 Write unit tests for `build_system_prompt` edge cases
    - Test `build_system_prompt(base, None)` returns base exactly
    - Test `build_system_prompt(base, "")` returns base exactly
    - Test `build_system_prompt(base, "   ")` returns base exactly
    - Test `build_system_prompt(base, "Arrive by 10 AM")` contains the header and constraint text
    - Add to `backend/tests/test_decision_agent.py`
    - _Requirements: 1.1, 1.2, 2.1, 2.3_

  - [x]* 2.4 Write unit tests for `decide()` fallback paths with constraint
    - Test `decide()` with no API key and a constraint returns fallback reasoning (mock async)
    - Test `decide()` with empty options and a constraint returns fallback reasoning
    - Verify `_fallback_reasoning` signature is unchanged and does not accept a system prompt parameter
    - Add to `backend/tests/test_decision_agent.py`
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 3. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Verify orchestrator passthrough and integration
  - [x] 4.1 Add integration tests for orchestrator constraint passthrough
    - Mock `decide()` in `backend/agents/orchestrator.py` and verify the `constraint` argument is passed through unchanged from `plan_route()`
    - Test that `plan_route(constraint=None)` passes `None` to `decide()`
    - Test that `plan_route(constraint="Arrive by 10 AM")` passes `"Arrive by 10 AM"` to `decide()`
    - Add to `backend/tests/test_orchestrator.py`
    - _Requirements: 4.1, 4.2_

- [x] 5. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using Hypothesis
- Unit tests validate specific examples and edge cases
- The `SYSTEM_PROMPT` constant and `_build_user_prompt` function are not modified by this feature
- The orchestrator already passes `constraint` through — task 4 only adds test coverage for that existing behavior
