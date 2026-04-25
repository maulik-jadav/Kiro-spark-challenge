# Implementation Plan: Client Interface (Phase 1.4)

## Overview

Phase 1.4 adds a cross-cutting error handling layer, two reference data endpoints, and comprehensive contract tests to ensure all backend API responses are consistently structured for frontend consumption. The implementation adds Pydantic models for error and factor responses, registers global exception handlers in FastAPI, implements GET endpoints for emission/cost factors, and validates everything with property-based and contract tests.

## Tasks

- [ ] 1. Add error response and factor response models to schemas
  - [ ] 1.1 Add `ValidationErrorDetail` and `ErrorResponse` Pydantic models to `backend/models/schemas.py`
    - Add `ValidationErrorDetail` with `field: str` and `reason: str` fields
    - Add `ErrorResponse` with `status_code: int`, `message: str`, `detail: str | None`, and `errors: list[ValidationErrorDetail] | None`
    - _Requirements: 5.1, 5.2, 5.4_
  - [ ] 1.2 Add `EmissionFactorResponse` and `CostFactorResponse` Pydantic models to `backend/models/schemas.py`
    - Add `EmissionFactorResponse` with `mode: str`, `g_co2e_per_pkm: float`, `source: str`, `notes: str`
    - Add `CostFactorResponse` with `mode: str`, `base_fare: float`, `per_km_cost: float`, `source: str`, `notes: str`
    - _Requirements: 2.1, 2.2_

- [ ] 2. Register global exception handlers in main.py
  - [ ] 2.1 Implement `http_exception_handler`, `validation_exception_handler`, and `unhandled_exception_handler` in `backend/main.py`
    - Import `StarletteHTTPException`, `RequestValidationError`, and the new `ErrorResponse`/`ValidationErrorDetail` models
    - Add `HTTP_STATUS_MESSAGES` dict mapping common status codes to human-readable messages
    - Implement `http_exception_handler` that wraps `HTTPException` into `ErrorResponse` JSON
    - Implement `validation_exception_handler` that converts Pydantic errors into `ErrorResponse` with field-level `errors` array
    - Implement `unhandled_exception_handler` that logs the traceback and returns a generic 500 `ErrorResponse` with `detail=None`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [ ] 2.2 Register all three exception handlers in `create_app()` in `backend/main.py`
    - Call `app.add_exception_handler(StarletteHTTPException, http_exception_handler)`
    - Call `app.add_exception_handler(RequestValidationError, validation_exception_handler)`
    - Call `app.add_exception_handler(Exception, unhandled_exception_handler)`
    - _Requirements: 5.1, 5.4_
  - [ ]* 2.3 Write unit tests for error handlers in `backend/tests/test_error_handlers.py`
    - Test that an `HTTPException(404)` returns `ErrorResponse` JSON with `status_code=404`, `message`, and `detail`
    - Test that a missing required field returns 422 with `errors` array containing field name and reason
    - Test that an unhandled exception returns 500 with generic message and `detail=null`
    - Test that 500 responses do not expose stack traces or internal details
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 3. Implement emission-factors and cost-factors GET endpoints
  - [ ] 3.1 Add `GET /emission-factors` endpoint to `backend/api/routes.py`
    - Import `EMISSION_FACTORS` from `core.emission_factors` and `EmissionFactorResponse` from `models.schemas`
    - Iterate over `EMISSION_FACTORS.values()` and serialize each into `EmissionFactorResponse`
    - Return `list[EmissionFactorResponse]` with `response_model` annotation
    - _Requirements: 2.1_
  - [ ] 3.2 Add `GET /cost-factors` endpoint to `backend/api/routes.py`
    - Import `COST_FACTORS` from `core.emission_factors` and `CostFactorResponse` from `models.schemas`
    - Iterate over `COST_FACTORS.values()` and serialize each into `CostFactorResponse`
    - Return `list[CostFactorResponse]` with `response_model` annotation
    - _Requirements: 2.2_
  - [ ]* 3.3 Write unit tests for factor endpoints in `backend/tests/test_factor_endpoints.py`
    - Test `GET /api/v1/emission-factors` returns 200 with 11 entries, each having `mode`, `g_co2e_per_pkm`, `source`
    - Test `GET /api/v1/cost-factors` returns 200 with 11 entries, each having `mode`, `base_fare`, `per_km_cost`, `source`
    - Test that all `TransitMode` enum values are represented in each response
    - Test that numeric fields are non-negative
    - _Requirements: 2.1, 2.2_

- [ ] 4. Checkpoint — Verify core implementation
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Add property-based tests for correctness properties
  - [ ]* 5.1 Write property test for RouteOption structural completeness in `backend/tests/test_route_contracts.py`
    - **Property 1: RouteOption structural completeness**
    - Use Hypothesis to generate random `RouteOption` instances with valid segments
    - Assert all required fields (`mode`, `total_distance_km`, `total_duration_min`, `total_emissions_g`, `total_emissions_kg`, `total_cost_usd`, `emission_factor_source`, `cost_source`) are non-null
    - Assert each segment has non-null `mode`, `distance_km`, `duration_min`, `emissions_g`, `cost_usd`, `description`
    - **Validates: Requirements 1.1, 1.2**
  - [ ]* 5.2 Write property test for emission factors endpoint completeness in `backend/tests/test_factor_endpoints.py`
    - **Property 2: Emission factors endpoint completeness**
    - Use Hypothesis to sample random `TransitMode` values and verify each appears in the endpoint response
    - Assert total entries equals number of `TransitMode` enum members
    - Assert each entry has non-negative `g_co2e_per_pkm` and non-empty `source`
    - **Validates: Requirements 2.1**
  - [ ]* 5.3 Write property test for cost factors endpoint completeness in `backend/tests/test_factor_endpoints.py`
    - **Property 3: Cost factors endpoint completeness**
    - Use Hypothesis to sample random `TransitMode` values and verify each appears in the endpoint response
    - Assert total entries equals number of `TransitMode` enum members
    - Assert each entry has non-negative `base_fare` and `per_km_cost`, and non-empty `source`
    - **Validates: Requirements 2.2**
  - [ ]* 5.4 Write property test for schedule response event field completeness in `backend/tests/test_schedule_contracts.py`
    - **Property 4: Schedule response event field completeness**
    - Use Hypothesis to generate random `CalendarEvent` objects with valid ISO 8601 datetimes and non-empty locations
    - Assert each event has non-empty `summary`, `start`, `end`, and `location`
    - **Validates: Requirements 4.1**
  - [ ]* 5.5 Write property test for error response structural consistency in `backend/tests/test_error_handlers.py`
    - **Property 5: Error response structural consistency**
    - Use Hypothesis to generate random HTTP status codes (≥400) and error messages
    - Assert every error response contains `status_code` (int matching HTTP status), `message` (non-empty string), and `detail` (string or null)
    - **Validates: Requirements 5.1, 5.4**
  - [ ]* 5.6 Write property test for validation error field-level detail in `backend/tests/test_error_handlers.py`
    - **Property 6: Validation error field-level detail**
    - Use Hypothesis to generate random invalid request payloads (empty strings, wrong types, missing fields)
    - Assert every 422 response contains an `errors` array with at least one entry, each having non-empty `field` and `reason`
    - **Validates: Requirements 5.2**

- [ ] 6. Add contract tests for response shape validation
  - [ ]* 6.1 Write contract tests in `backend/tests/test_contracts.py`
    - Test `POST /api/v1/plan-route` response matches `RouteComparison` shape with `options`, `greenest`, `fastest`, `cheapest`, `savings_vs_driving_kg`, `reasoning`
    - Test `GET /api/v1/emission-factors` response is an array of `{mode, g_co2e_per_pkm, source, notes}`
    - Test `GET /api/v1/cost-factors` response is an array of `{mode, base_fare, per_km_cost, source, notes}`
    - Test invalid request returns `ErrorResponse` shape with `{status_code, message, detail, errors}`
    - Test triggered 500 returns `ErrorResponse` shape with `{status_code, message, detail}` where `detail` is null
    - Verify consistent field naming across all error responses from different endpoints
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 5.1, 5.2, 5.3, 5.4_

- [ ] 7. Add hypothesis dependency to requirements.txt
  - [ ] 7.1 Add `hypothesis>=6.100.0` and `pytest-asyncio>=0.23.0` to `backend/requirements.txt`
    - Only add if not already present
    - Required for property-based tests in tasks 5.1–5.6

- [ ] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design uses Python (FastAPI/Pydantic), so no language selection was needed
- Existing response models (`RouteOption`, `RouteComparison`, etc.) are validated by contract tests but not modified
- Exception handlers are non-invasive — they intercept errors without changing existing `raise HTTPException(...)` calls
- Property tests use Hypothesis with a minimum of 100 iterations per property
- The emission/cost factor endpoints read from existing `EMISSION_FACTORS` and `COST_FACTORS` dicts in `backend/core/emission_factors.py`
