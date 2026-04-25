# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Route Polyline Data Missing From Pipeline
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists across the full pipeline
  - **Scoped PBT Approach**: Use Hypothesis to generate `RawRouteResult` inputs with varying modes, distances, and durations. For each, assert that:
    1. The `X-Goog-FieldMask` header in `live_route` includes `routes.polyline.encodedPolyline`
    2. `RawRouteResult` has a `polyline` attribute
    3. `RouteOption` schema includes a `polyline` field
    4. `analyze_route` passes polyline data from `RawRouteResult` to `RouteOption`
  - Write tests in `backend/tests/test_polyline_bug_condition.py` using `pytest` and `hypothesis`
  - Test that the field mask string sent to Google Maps API does NOT contain `polyline` (confirms root cause #1)
  - Test that `RawRouteResult` does NOT have a `polyline` attribute (confirms root cause #2)
  - Test that `RouteOption` schema does NOT include a `polyline` field (confirms root cause #2)
  - Test that `analyze_route` with a mock polyline-bearing `RawRouteResult` does NOT produce a `RouteOption` with polyline (confirms root cause #3-4)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct — it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Route Analysis Data Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - `analyze_route(RawRouteResult(mode=DRIVING, distance_km=10.0, duration_min=15.0, segments=[...]))` returns `RouteOption` with `total_emissions_g=2510.0`, `total_cost_usd>0`, etc.
    - `analyze_route(RawRouteResult(mode=WALKING, distance_km=3.0, duration_min=36.0, segments=[...]))` returns `RouteOption` with `total_emissions_g=0.0`, `total_cost_usd=0.0`
    - `find_greenest`, `find_fastest`, `find_cheapest` return correct options based on emissions, duration, cost
  - Write property-based tests in `backend/tests/test_polyline_preservation.py` using `hypothesis`:
    - Generate random `RawRouteResult` objects with varying `mode` (sampled from `TransitMode`), `distance_km` (floats 0.1–500), `duration_min` (floats 1–600), and realistic segments
    - For each generated input, assert that `analyze_route` produces identical values for: `mode`, `total_distance_km`, `total_duration_min`, `total_emissions_g`, `total_emissions_kg`, `total_cost_usd`, `emission_factor_source`, `cost_source`, and all segment fields
    - Assert that `find_greenest`, `find_fastest`, `find_cheapest` return the same modes for any list of `RouteOption` objects
    - Assert that `savings_vs_driving` returns the same value
  - Write frontend preservation tests in `frontend/src/components/MapView.preservation.test.tsx` using `vitest`:
    - Verify MapView continues to render origin/destination markers when origin and destination are provided
    - Verify MapView shows default view (no markers) when origin and destination are null
    - Verify MapView shows "Map unavailable" fallback when API key is missing
  - Run all preservation tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix route path not drawing on map

  - [x] 3.1 Backend: Add polyline to field mask and data models
    - In `backend/services/maps_client.py`:
      - Add `polyline: str | None = None` field to `RawRouteResult` dataclass
      - Update `X-Goog-FieldMask` header in `live_route` from `"routes.distanceMeters,routes.staticDuration"` to `"routes.distanceMeters,routes.staticDuration,routes.polyline.encodedPolyline"`
      - Extract `route.get("polyline", {}).get("encodedPolyline")` from the API response and store in `RawRouteResult.polyline`
    - In `backend/models/schemas.py`:
      - Add `polyline: str | None = None` field to `RouteOption` Pydantic model
    - In `backend/agents/emissions_agent.py`:
      - Pass `polyline=raw.polyline` when constructing `RouteOption` in `analyze_route`
    - _Bug_Condition: isBugCondition(input) where routes are calculated but no polyline data exists in the pipeline_
    - _Expected_Behavior: Backend requests polyline data, extracts it, and includes it in RouteOption response_
    - _Preservation: All existing RouteOption fields (mode, segments, distances, durations, emissions, costs, sources) must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1_

  - [x] 3.2 Frontend: Add polyline type and pass data to MapView
    - In `frontend/src/types/api.ts`:
      - Add `polyline?: string | null` to the `RouteOption` interface
    - In `frontend/src/app/page.tsx`:
      - Pass the `result` state (`RouteComparison | null`) to `MapView` as a new `routeComparison` prop
    - _Bug_Condition: Frontend receives RouteComparison with polyline data but has no way to pass it to MapView_
    - _Expected_Behavior: RouteComparison with polyline data is passed to MapView component_
    - _Preservation: All existing frontend components (TripForm, ResultsPanel, RouteCard, ReasoningPanel) must remain unchanged_
    - _Requirements: 2.4, 3.2, 3.3_

  - [x] 3.3 Frontend: Render polylines on MapView
    - In `frontend/src/components/MapView.tsx`:
      - Accept `routeComparison: RouteComparison | null` prop in `MapViewProps`
      - Implement polyline decoding function (decode Google Encoded Polyline Algorithm to `{lat, lng}[]` array)
      - For each of `greenest`, `cheapest`, `fastest` in the `RouteComparison`, if the route has a non-null `polyline`, render a polyline path on the map
      - Use distinct stroke colors: green (`#16a34a`) for greenest, blue (`#2563eb`) for cheapest, orange (`#ea580c`) for fastest
      - Use stroke weight ~4px and opacity ~0.8 for visibility
      - Render all three polylines independently even if they reference the same route (overlapping categories)
      - Use `google.maps.Polyline` via `useMap` hook or `@vis.gl/react-google-maps` Polyline component
    - _Bug_Condition: MapView receives route data but has no polyline rendering logic_
    - _Expected_Behavior: MapView decodes and renders polylines with distinct colors per category_
    - _Preservation: Origin (A) and destination (B) markers must continue to display; default empty view and "Map unavailable" fallback must remain unchanged_
    - _Requirements: 2.5, 2.6, 2.7, 3.2, 3.5, 3.6_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Route Polyline Data Flows Through Pipeline
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from `backend/tests/test_polyline_bug_condition.py`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Route Analysis Data Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run backend preservation tests from `backend/tests/test_polyline_preservation.py`
    - Run frontend preservation tests from `frontend/src/components/MapView.preservation.test.tsx`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full backend test suite: `pytest` in `backend/`
  - Run full frontend test suite: `vitest --run` in `frontend/`
  - Ensure all existing tests plus new polyline tests pass
  - Ensure no regressions in route calculation, marker rendering, or UI components
  - Ask the user if questions arise
