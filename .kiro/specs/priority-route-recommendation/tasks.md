# Implementation Plan: Priority-Based Route Recommendation

## Overview

Replace the current Greenest/Cheapest/Fastest recommendation system with a deterministic, priority-based scoring engine. The implementation proceeds bottom-up: core scoring engine (pure functions) → schema updates → orchestrator/agent integration → API wiring → frontend updates. Each step builds on the previous and is validated incrementally.

## Tasks

- [ ] 1. Create the scoring engine module with pure functions
  - [x] 1.1 Create `backend/core/scoring_engine.py` with `Priority` enum, `WeightVector` dataclass, and `WEIGHT_VECTORS` configuration
    - Define `Priority` enum with FASTEST, GREENEST, BEST_TRADEOFF values
    - Define `WeightVector` dataclass with duration, emissions, cost, practicality fields
    - Define the three weight vector configurations per the design document
    - _Requirements: 1.1, 6.1, 6.2, 6.3, 11.1_

  - [x] 1.2 Implement `compute_practicality_penalty` pure function
    - Accept mode, distance_km, duration_min, fastest_duration_min parameters
    - Apply walking thresholds: 3 km distance, 35 min duration, 2.5× relative duration
    - Apply bicycling thresholds: 8 km distance, 45 min duration, 2.0× relative duration
    - Return 0.0 for all motorized modes
    - Clamp result to [0.0, 1.0]
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 12.2_

  - [ ]* 1.3 Write property test for practicality penalty range invariant
    - **Property 2: Practicality penalty range invariant**
    - **Validates: Requirements 2.2, 3.6**

  - [ ]* 1.4 Write property test for practicality penalty correctness
    - **Property 4: Practicality penalty correctness**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

  - [x] 1.5 Implement `normalize_values` pure function
    - Accept a list of floats, return min-max normalized values in [0.0, 1.0]
    - Return all 0.0 when all values are equal (max = min)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 12.3_

  - [ ]* 1.6 Write property test for min-max normalization formula
    - **Property 6: Min-max normalization formula**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**

  - [x] 1.7 Implement `pareto_filter` pure function
    - Accept a list of candidate route dicts with duration, emissions, cost
    - Return a list of booleans indicating domination status
    - Mark a route as dominated iff another route is ≤ on all dimensions and < on at least one
    - Routes equal on all dimensions are not dominated
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 12.4_

  - [ ]* 1.8 Write property test for Pareto dominance correctness
    - **Property 5: Pareto dominance correctness**
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [x] 1.9 Implement `compute_final_score` pure function
    - Compute weighted sum: (w.duration × normalizedDuration) + (w.emissions × normalizedEmissions) + (w.cost × normalizedCost) + (w.practicality × practicalityPenalty)
    - _Requirements: 6.4_

  - [x] 1.10 Implement `generate_explanation` pure function
    - Produce deterministic explanation string based on priority and scoring data
    - FASTEST: state route selected for shortest duration
    - GREENEST: reference emissions and any practicality penalty
    - BEST_TRADEOFF: reference balance of duration, emissions, cost, and practicality
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [x] 1.11 Implement `score_routes` top-level orchestration function
    - Accept list of RouteOption and a Priority
    - Compute practicality penalties for all routes
    - Run Pareto filtering
    - Normalize duration, emissions, and cost
    - Compute final scores using the priority's weight vector
    - Select the route with the lowest finalScore as recommended
    - Generate explanation for the recommended route
    - Return a ScoringResult with all enriched routes and the recommendation
    - Handle null/missing cost as 0.0
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 5.5, 6.5, 7.1, 7.2, 7.3, 7.4, 8.1, 8.2, 8.3, 12.6, 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 1.12 Write property test for scoring output completeness
    - **Property 1: Scoring output completeness**
    - **Validates: Requirements 2.1, 2.4, 2.5, 8.2, 8.3**

  - [ ]* 1.13 Write property test for normalized values range invariant
    - **Property 3: Normalized values range invariant**
    - **Validates: Requirements 2.3, 5.1, 5.2, 5.3**

  - [ ]* 1.14 Write property test for weighted scoring formula and recommendation selection
    - **Property 7: Weighted scoring formula and recommendation selection**
    - **Validates: Requirements 6.4, 6.5**

  - [ ]* 1.15 Write property test for FASTEST selects minimum duration
    - **Property 8: FASTEST selects minimum duration**
    - **Validates: Requirements 7.1**

  - [ ]* 1.16 Write property test for scoring idempotence
    - **Property 9: Scoring idempotence**
    - **Validates: Requirements 9.1, 9.5, 12.1, 12.5**

  - [ ]* 1.17 Write property test for exactly one recommendation
    - **Property 10: Exactly one recommendation**
    - **Validates: Requirements 12.6**

- [x] 2. Checkpoint — Ensure all scoring engine tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Update backend data models and API layer
  - [x] 3.1 Add `ScoredRoute`, `ScoringResult`, and `Priority` to `backend/models/schemas.py`
    - Add `ScoredRoute` model extending RouteOption fields with scoring metadata (practicality_penalty, normalized_duration, normalized_emissions, normalized_cost, final_score, is_dominated, explanation_reason)
    - Add `ScoringResult` model with priority, recommended, and routes fields
    - Update `RouteComparison` to add selected_priority, recommended_route, scored_routes fields and remove cheapest field
    - Update `RouteRequest` to add priority field defaulting to BEST_TRADEOFF
    - _Requirements: 2.1, 8.1, 8.2, 8.3, 8.4, 11.4_

  - [x] 3.2 Update `backend/agents/orchestrator.py` to integrate the scoring engine
    - Add `priority` parameter to `plan_route` function
    - Call `score_routes(options, priority)` after the Emissions Agent
    - Remove `find_cheapest` call
    - Pass `recommended_mode` from scoring result to the Decision Agent
    - Populate new RouteComparison fields (selected_priority, recommended_route, scored_routes)
    - Remove cheapest from RouteComparison construction
    - _Requirements: 8.1, 8.4, 11.4_

  - [x] 3.3 Update `backend/agents/decision_agent.py` to accept recommended_mode
    - Add `recommended_mode` parameter to `decide` function
    - Update LLM prompt to explain the already-selected route rather than pick one
    - Update fallback reasoning to use the provided recommended_mode
    - _Requirements: 9.6_

  - [x] 3.4 Update `backend/api/routes.py` to pass priority from request to orchestrator
    - Pass `req.priority` to the `orchestrate` call in the `/plan-route` endpoint
    - _Requirements: 1.4_

  - [ ]* 3.5 Write unit tests for updated API and orchestrator integration
    - Test that POST /plan-route with priority field returns enriched response with selected_priority, recommended_route, scored_routes
    - Test that response no longer includes cheapest field
    - Test backward compatibility: options, greenest, fastest, savings_vs_driving_kg still present
    - _Requirements: 8.1, 8.4, 11.4_

- [x] 4. Checkpoint — Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Update frontend types and API client
  - [x] 5.1 Update `frontend/src/types/api.ts` with new types
    - Add `Priority` type ("fastest" | "greenest" | "best_tradeoff")
    - Add `ScoredRoute` interface extending RouteOption with scoring fields
    - Update `RouteComparison` interface: add selected_priority, recommended_route, scored_routes; remove cheapest
    - _Requirements: 8.1, 8.2, 8.3, 11.4_

  - [x] 5.2 Update `frontend/src/lib/api.ts` to send priority in route requests
    - Add `priority` parameter to `planRoute` function
    - Include priority in the POST body
    - _Requirements: 1.4_

- [ ] 6. Update frontend components
  - [x] 6.1 Add PrioritySelector to `frontend/src/components/TripForm.tsx`
    - Add three radio-style buttons: Fastest, Greenest, Best Trade-off
    - Default selection to Best Trade-off
    - Do not include a Cheapest option
    - Pass selected priority to `onSubmit` callback
    - Visually indicate the currently selected priority
    - _Requirements: 1.1, 1.2, 1.3, 10.1, 10.2, 10.3, 10.4_

  - [x] 6.2 Update `frontend/src/app/page.tsx` to pass priority through the form submission flow
    - Update `handleSubmit` to accept and forward the priority parameter
    - Pass priority to `planRoute` API call
    - _Requirements: 1.4_

  - [x] 6.3 Update `frontend/src/components/ResultsPanel.tsx` to use scored routes
    - Render `scored_routes` instead of `options` when available
    - Pass `isRecommended` prop based on `recommended_route.mode`
    - Remove `cheapest` references
    - Fall back to `options` if `scored_routes` is empty (backward compat)
    - _Requirements: 8.3, 11.3_

  - [x] 6.4 Update `frontend/src/components/RouteCard.tsx` to show recommendation badge and practicality notes
    - Replace `isCheapest` prop with `isRecommended` prop
    - Add "RECOMMENDED" badge configuration
    - Remove "CHEAPEST" badge
    - Display practicality note when `practicality_penalty > 0` (e.g., "Long walk — 45 min")
    - _Requirements: 10.5, 11.3_

  - [x] 6.5 Update `frontend/src/components/MapView.tsx` polyline colors
    - Replace cheapest polyline color with recommended route polyline color
    - Use green for greenest, amber for fastest, blue for recommended (if different)
    - _Requirements: 11.3_

  - [ ]* 6.6 Write frontend tests for PrioritySelector and RouteCard updates
    - Test PrioritySelector renders three options and defaults to Best Trade-off
    - Test no Cheapest option or badge is present
    - Test priority value is sent in API request
    - Test practicality note displayed when penalty > 0
    - _Requirements: 1.1, 1.2, 1.3, 10.1, 10.3, 10.4, 10.5, 11.3_

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The scoring engine is implemented first as pure functions, making it independently testable before integration
