# Implementation Plan: Agentic Reasoning Layer (Phase 1.2)

## Overview

This plan implements the constraint-aware decision-making pipeline on top of the Phase 1.1 foundation. Work proceeds bottom-up: new Pydantic models first, then the Decision Agent's deterministic scoring/filtering engine, then the orchestrator extension, and finally the new API endpoint. Tests are interleaved with implementation to catch errors early.

## Tasks

- [ ] 1. Add new Pydantic models to `backend/models/schemas.py`
  - [ ] 1.1 Add `UserConstraint` model with `constraint_type` Literal, `arrival_by`, `max_cost`, `preferred_modes` fields, and `validate_constraint_fields` model validator
    - Import `datetime`, `Literal`, and `Self` from typing
    - `constraint_type: Literal["arrival_by", "max_cost", "preferred_modes"]`
    - Add `@model_validator(mode="after")` to ensure the correct field is populated for each constraint type
    - _Requirements: 1.1, 1.2, 1.3, 4.1_
  - [ ] 1.2 Add `ScoreWeights` model with `emissions`, `time`, `cost` fields defaulting to 0.4, 0.35, 0.25
    - Each field: `ge=0.0, le=1.0`
    - _Requirements: 1.6_
  - [ ] 1.3 Add `ConstrainedRouteRequest` model with `origin`, `destination`, `modes`, `constraints`, `weights`, `departure_time` fields and `validate_arrival_constraint` model validator
    - Add `@model_validator(mode="after")` to require `departure_time` when any constraint has `constraint_type == "arrival_by"`
    - _Requirements: 4.1, 4.2, 4.3_
  - [ ] 1.4 Add `TradeoffSummary` model with `alternative_mode`, `emissions_diff_kg`, `duration_diff_min`, `cost_diff_usd`, `summary` fields
    - _Requirements: 2.1, 2.2_
  - [ ] 1.5 Add `ScoredRouteOption` model with `option: RouteOption`, `score: float`, `rank: int` fields
    - _Requirements: 1.6_
  - [ ] 1.6 Add `DecisionResult` model with `ranked_options`, `recommended`, `tradeoffs`, `justification`, `unmet_constraints` fields
    - _Requirements: 2.3, 1.5_
  - [ ] 1.7 Add `ConstrainedRouteResponse` model with `origin`, `destination`, `options`, `ranked_options`, `recommended`, `greenest`, `fastest`, `cheapest`, `savings_vs_driving_kg`, `tradeoffs`, `justification`, `unmet_constraints` fields
    - _Requirements: 4.4_

- [ ] 2. Implement Decision Agent core functions in `backend/agents/decision_agent.py`
  - [ ] 2.1 Implement `filter_by_constraints(options, constraints, departure_time)` function
    - Apply hard constraints: arrival deadline (compute `available_minutes = (arrival_by - departure_time).total_seconds() / 60`, exclude options where `total_duration_min > available_minutes`) and max cost (exclude options where `total_cost_usd > max_cost`)
    - Apply all constraints conjunctively
    - If all options are eliminated, return closest viable options sorted by number of violated constraints then smallest violation margin, with `unmet_constraints` descriptions
    - Return `tuple[list[RouteOption], list[str]]` — filtered options and unmet constraint descriptions
    - _Requirements: 1.1, 1.2, 1.4, 1.5_
  - [ ] 2.2 Implement `compute_weighted_score(option, weights, all_options, preferred_modes)` function
    - Use min-max normalization across the option set with `ε = 1e-9`
    - Formula: `score = w_emissions × norm_emissions + w_time × norm_time + w_cost × norm_cost - preferred_mode_boost`
    - `preferred_mode_boost = 0.1` if mode in preferred_modes, else 0
    - Auto-normalize weights if they don't sum to ~1.0 (divide each by sum)
    - Lower score = better option
    - _Requirements: 1.3, 1.6_
  - [ ] 2.3 Implement `rank_options(options, weights, preferred_modes)` function
    - Score all options using `compute_weighted_score`, sort ascending by score
    - Return `list[ScoredRouteOption]` with 1-based rank positions
    - _Requirements: 1.6_
  - [ ] 2.4 Implement `compute_tradeoffs(ranked)` function
    - Compare top-ranked option against every alternative
    - Compute `emissions_diff_kg`, `duration_diff_min`, `cost_diff_usd` per the design formulas
    - Generate a one-line `summary` string for each tradeoff
    - Return exactly N-1 `TradeoffSummary` objects for N ranked options
    - _Requirements: 2.1, 2.2_
  - [ ] 2.5 Implement `build_justification(recommended, tradeoffs, unmet_constraints)` function
    - Template-based natural language justification referencing specific tradeoff values
    - Must be non-empty and contain at least one numeric value
    - When recommended route is slower than an alternative, include time penalty (e.g., "saves 3.2 kg CO2 for a 4-minute longer trip")
    - _Requirements: 2.3, 2.4, 2.5_
  - [ ] 2.6 Implement `evaluate(origin, destination, options, constraints, weights, departure_time, api_key)` async function
    - Full pipeline: filter → score → rank → tradeoffs → justify
    - Use LLM for justification if `api_key` is available, fall back to `build_justification` template
    - Return `DecisionResult`
    - Preserve existing `decide()` function unchanged for backward compatibility
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.2, 2.3, 2.4, 2.5_

- [ ] 3. Checkpoint — Verify Decision Agent
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement constrained orchestrator in `backend/agents/orchestrator.py`
  - [ ] 4.1 Add `plan_route_constrained` function
    - Pipeline: Routing Agent → Emissions Agent → Decision Agent (`evaluate`)
    - Import and call `get_routes`, `analyze_all`, `find_greenest`, `find_fastest`, `find_cheapest`, `savings_vs_driving` from existing agents
    - Call `evaluate` from the decision agent with constraints and weights
    - If routing agent returns empty list, return `ConstrainedRouteResponse` with empty lists and `justification = "No routes found between the specified locations."`
    - If no constraints provided, still run the full pipeline (behaves identically to unconstrained but returns `ConstrainedRouteResponse` shape)
    - Preserve existing `plan_route` function unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.5_

- [ ] 5. Add new API endpoint in `backend/api/routes.py`
  - [ ] 5.1 Add `POST /plan-route-constrained` endpoint
    - Import `ConstrainedRouteRequest`, `ConstrainedRouteResponse` from schemas
    - Import `plan_route_constrained` from orchestrator
    - Accept `ConstrainedRouteRequest` body, return `ConstrainedRouteResponse`
    - Pass `origin`, `destination`, `modes`, `constraints`, `weights`, `departure_time`, and settings through to orchestrator
    - Preserve existing `/plan-route` endpoint unchanged
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 6. Checkpoint — Verify end-to-end pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Write property-based tests for Decision Agent (`backend/tests/test_decision_agent.py`)
  - [ ]* 7.1 Write property test for hard constraint filtering correctness
    - **Property 1: Hard constraint filtering correctness**
    - Generate random `RouteOption` lists and `UserConstraint` combinations (arrival deadline + departure time, max cost)
    - Assert every option in filtered result satisfies all constraints, and no satisfying option is missing
    - **Validates: Requirements 1.1, 1.2, 1.4**
  - [ ]* 7.2 Write property test for preferred mode scoring boost
    - **Property 2: Preferred mode scoring boost**
    - Generate two `RouteOption` objects with identical emissions, duration, and cost; one with preferred mode, one without
    - Assert preferred-mode option gets strictly lower score
    - **Validates: Requirements 1.3**
  - [ ]* 7.3 Write property test for weighted score ranking consistency
    - **Property 3: Weighted score ranking consistency**
    - Generate random `RouteOption` lists and valid `ScoreWeights`
    - Assert `rank_options` returns options sorted ascending by score, and each score matches the formula
    - **Validates: Requirements 1.6**
  - [ ]* 7.4 Write property test for tradeoff summary count
    - **Property 4: Tradeoff summary count**
    - Generate lists of N `ScoredRouteOption` objects (N ≥ 1)
    - Assert `compute_tradeoffs` returns exactly N-1 `TradeoffSummary` objects
    - **Validates: Requirements 2.1**
  - [ ]* 7.5 Write property test for tradeoff difference arithmetic
    - **Property 5: Tradeoff difference arithmetic**
    - Generate two `RouteOption` objects R and A
    - Assert `emissions_diff_kg == A.total_emissions_kg - R.total_emissions_kg`, `duration_diff_min == R.total_duration_min - A.total_duration_min`, `cost_diff_usd == A.total_cost_usd - R.total_cost_usd` within floating-point tolerance
    - **Validates: Requirements 2.2**
  - [ ]* 7.6 Write property test for justification content invariant
    - **Property 6: Justification content invariant**
    - Generate random route options and tradeoffs
    - Assert justification is non-empty and contains at least one numeric value
    - When recommended is slower than an alternative, assert justification references time penalty
    - **Validates: Requirements 2.3, 2.4, 2.5**

- [ ] 8. Write property-based tests for orchestrator and pipeline (`backend/tests/test_orchestrator.py`)
  - [ ]* 8.1 Write property test for emissions-to-options cardinality
    - **Property 7: Emissions-to-options cardinality**
    - Generate lists of N `RawRouteResult` objects
    - Assert `analyze_all` returns exactly N `RouteOption` objects
    - **Validates: Requirements 3.2**
  - [ ]* 8.2 Write property test for no-constraint equivalence
    - **Property 8: No-constraint equivalence**
    - For any origin, destination, and mode set, call constrained pipeline with no constraints
    - Assert same set of route options (modes, emissions, costs, durations) as unconstrained pipeline
    - **Validates: Requirements 4.5**

- [ ] 9. Write unit tests for constrained API endpoint (`backend/tests/test_constrained_api.py`)
  - [ ]* 9.1 Write unit tests for the `/plan-route-constrained` endpoint
    - Test valid request returns 200 with correct response shape (ranked_options, recommended, justification)
    - Test arrival deadline filters out options exceeding time window
    - Test max cost filters out options exceeding budget
    - Test all options filtered returns closest viable with unmet_constraints explanation
    - Test default weights (0.4, 0.35, 0.25) applied when none specified
    - Test time penalty appears in justification when recommended is slower
    - Test empty routes returns empty response with descriptive message
    - Test missing `departure_time` with `arrival_by` constraint returns 422
    - Test negative `max_cost` returns 422
    - Test no constraints behaves same as `/plan-route` (compare option sets)
    - _Requirements: 1.1, 1.2, 1.5, 1.6, 2.4, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using Hypothesis
- The existing `decide()` function and `plan_route()` function are preserved for Phase 1.1 backward compatibility
- All new code is additive — no existing models or endpoints are modified
