# Implementation Plan: Core Data & Single-Route MVP (Phase 1.1)

## Overview

Most of Phase 1.1 is already implemented. This plan covers the remaining gaps: input validation on `RouteRequest`, new Pydantic response models (`EmissionFactorResponse`, `CostFactorResponse`, `ErrorResponse`), two new GET endpoints for factor data, a global exception handler, and comprehensive property-based and unit tests.

## Tasks

- [ ] 1. Add input validation and new Pydantic models to `backend/models/schemas.py`
  - [ ] 1.1 Add `field_validator` to `RouteRequest` for `origin` and `destination` that rejects empty and whitespace-only strings
    - Import `field_validator` from pydantic
    - Add `must_not_be_empty` class method validator for both fields
    - Validator should call `v.strip()` and raise `ValueError("must not be empty or whitespace-only")` if result is empty
    - _Requirements: 6.3, 6.4, 8.1_

  - [ ] 1.2 Add `EmissionFactorResponse` Pydantic model
    - Fields: `mode: str`, `g_co2e_per_pkm: float`, `source: str`, `notes: str = ""`
    - _Requirements: 11.1_

  - [ ] 1.3 Add `CostFactorResponse` Pydantic model
    - Fields: `mode: str`, `base_fare: float`, `per_km_cost: float`, `source: str`, `notes: str = ""`
    - _Requirements: 11.2_

  - [ ] 1.4 Add `ErrorResponse` Pydantic model
    - Fields: `error: str`, `detail: str | None = None`
    - _Requirements: 8.3, 8.4_

- [ ] 2. Add new API endpoints in `backend/api/routes.py`
  - [ ] 2.1 Add `GET /api/v1/emission-factors` endpoint
    - Import `EMISSION_FACTORS` from `core.emission_factors` and `EmissionFactorResponse` from `models.schemas`
    - Return a list of `EmissionFactorResponse` for all 11 transit modes by iterating `EMISSION_FACTORS.values()`
    - _Requirements: 11.1_

  - [ ] 2.2 Add `GET /api/v1/cost-factors` endpoint
    - Import `COST_FACTORS` from `core.emission_factors` and `CostFactorResponse` from `models.schemas`
    - Return a list of `CostFactorResponse` for all 11 transit modes by iterating `COST_FACTORS.values()`
    - _Requirements: 11.2_

- [ ] 3. Add global exception handler in `backend/main.py`
  - [ ] 3.1 Add a global exception handler for unhandled `Exception`
    - Import `logging`, `Request`, `JSONResponse` from fastapi
    - Register `@app.exception_handler(Exception)` in `create_app()`
    - Handler logs the full traceback via `logging.exception()`
    - Handler returns `JSONResponse(status_code=500, content={"error": "Internal server error"})` with no stack trace or implementation details
    - _Requirements: 8.3, 8.4_

- [ ] 4. Checkpoint — Verify new endpoints and validation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Set up test infrastructure and write property-based tests
  - [ ] 5.1 Create `backend/tests/` directory and add `conftest.py` with shared Hypothesis strategies
    - Create `backend/tests/__init__.py`
    - Create `backend/tests/conftest.py` with reusable Hypothesis strategies: `transit_mode_strategy`, `positive_distance_strategy` (floats 0.1–100.0), `origin_destination_strategy`, `raw_route_result_strategy`
    - Add `hypothesis` and `pytest` and `httpx` to `backend/requirements.txt` if not present
    - _Requirements: 3.1–3.6, 4.1–4.5_

  - [ ]* 5.2 Write property tests for emission and cost computation (`backend/tests/test_emission_factors.py`)
    - **Property 1: Emissions computation formula** — For any TransitMode and positive distance, `compute_emissions_g(mode, distance_km)` equals `distance_km × EMISSION_FACTORS[mode].g_co2e_per_pkm`
    - **Validates: Requirements 3.1, 3.5**
    - **Property 2: Cost computation formula** — For any TransitMode and positive distance, `compute_cost(mode, distance_km)` equals `distance_km × COST_FACTORS[mode].per_km_cost`
    - **Validates: Requirements 4.1, 4.4**
    - **Property 6: Non-negative computation outputs** — For any TransitMode and positive distance, both `compute_emissions_g` and `compute_cost` return values ≥ 0
    - **Validates: Requirements 3.6, 4.5**
    - **Property 13: Factor table completeness and integrity** — Every TransitMode enum member has an entry in EMISSION_FACTORS with non-negative g_co2e_per_pkm and non-empty source, and in COST_FACTORS with non-negative per_km_cost and base_fare and non-empty source
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.6**

  - [ ]* 5.3 Write property tests for route analysis (`backend/tests/test_emissions_agent.py`)
    - **Property 3: Total emissions equals sum of segment emissions** — For any RawRouteResult, the RouteOption total_emissions_g equals the sum of segment emissions_g (within tolerance)
    - **Validates: Requirements 3.2**
    - **Property 4: Total cost equals sum of segment costs plus base fare** — For any RawRouteResult, the RouteOption total_cost_usd equals sum of segment cost_usd plus base_fare (within tolerance)
    - **Validates: Requirements 4.2**
    - **Property 5: Gram-to-kilogram conversion invariant** — For any RawRouteResult, `total_emissions_kg == round(total_emissions_g / 1000.0, 3)`
    - **Validates: Requirements 3.3**
    - **Property 14: Source provenance attached to route options** — For any RawRouteResult, the RouteOption has non-empty emission_factor_source matching EMISSION_FACTORS[mode].source and non-empty cost_source matching COST_FACTORS[mode].source
    - **Validates: Requirements 3.4, 4.3**

  - [ ]* 5.4 Write property tests for mock routing (`backend/tests/test_maps_client.py`)
    - **Property 7: Segment structure by mode type** — Transit modes produce 3 segments [walk, transit, walk]; non-transit modes produce 1 segment
    - **Validates: Requirements 2.1, 2.2**
    - **Property 8: Segment distance sum invariant** — Sum of segment distances equals route distance_km (within tolerance)
    - **Validates: Requirements 2.3**
    - **Property 9: Mock routing determinism** — Same inputs produce identical outputs across repeated calls
    - **Validates: Requirements 1.3**

  - [ ]* 5.5 Write property tests for distance filtering (`backend/tests/test_routing_agent.py`)
    - **Property 10: Distance-based mode filtering** — Walking excluded when distance > 8 km; bicycling excluded when distance > 25 km
    - **Validates: Requirements 1.6, 1.7**

  - [ ]* 5.6 Write property tests for ranking and sorting (`backend/tests/test_ranking.py`)
    - **Property 11: Ranking correctness** — `find_greenest` returns min total_emissions_g, `find_fastest` returns min total_duration_min, `find_cheapest` returns min total_cost_usd
    - **Validates: Requirements 5.2, 5.3, 5.4**
    - **Property 12: Savings vs driving computation** — With driving option: `round((driving.total_emissions_g - greenest.total_emissions_g) / 1000.0, 3)`; without driving: None
    - **Validates: Requirements 5.5, 5.6**
    - **Property 16: Emissions sort order** — Options list in RouteComparison is sorted by total_emissions_g ascending
    - **Validates: Requirements 5.1**

  - [ ]* 5.7 Write property tests for input validation (`backend/tests/test_validation.py`)
    - **Property 15: Empty/whitespace origin or destination rejection** — Any whitespace-only or empty string as origin or destination raises a validation error
    - **Validates: Requirements 6.3**

- [ ] 6. Write unit tests for new endpoints and error handling (`backend/tests/test_api.py`)
  - [ ] 6.1 Create `backend/tests/test_api.py` with FastAPI `TestClient` setup
    - Import `TestClient` from `fastapi.testclient` or use `httpx.AsyncClient`
    - Create app fixture using `create_app()`
    - _Requirements: 6.1, 7.1_

  - [ ]* 6.2 Write unit tests for `GET /api/v1/emission-factors`
    - Verify HTTP 200 response
    - Verify response contains exactly 11 entries (one per TransitMode)
    - Verify each entry has `mode`, `g_co2e_per_pkm`, `source` fields
    - _Requirements: 11.1_

  - [ ]* 6.3 Write unit tests for `GET /api/v1/cost-factors`
    - Verify HTTP 200 response
    - Verify response contains exactly 11 entries (one per TransitMode)
    - Verify each entry has `mode`, `base_fare`, `per_km_cost`, `source` fields
    - _Requirements: 11.2_

  - [ ]* 6.4 Write unit tests for input validation error responses
    - Send POST /plan-route with empty origin → verify HTTP 422 with field-level error
    - Send POST /plan-route with whitespace-only destination → verify HTTP 422
    - Send POST /plan-route with invalid mode string → verify HTTP 422 with valid modes listed
    - _Requirements: 6.3, 6.4, 8.1, 8.2_

  - [ ]* 6.5 Write unit tests for global exception handler
    - Mock an internal error in the route planning pipeline
    - Verify HTTP 500 response with `{"error": "Internal server error"}`
    - Verify response body does not contain stack traces or implementation details
    - _Requirements: 8.3, 8.4_

  - [ ]* 6.6 Write unit tests for existing endpoints (health, plan-route)
    - GET /health → verify 200, status "ok", routing_mode present, version present
    - POST /plan-route with valid input → verify RouteComparison shape, options sorted by emissions
    - Verify CORS middleware is configured
    - Verify API key is not exposed in any response
    - _Requirements: 7.1, 7.2, 7.3, 6.1, 6.2, 10.1, 10.3, 11.3, 11.4_

- [ ] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests use Hypothesis with minimum 100 iterations per property
- The implementation language is Python, matching the existing codebase
- Checkpoints ensure incremental validation between implementation and testing phases
