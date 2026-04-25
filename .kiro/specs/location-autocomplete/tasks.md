# Implementation Plan: Location Autocomplete

## Overview

This plan implements Google Places Autocomplete for all location inputs and removes the mock routing mode from the backend. Tasks are ordered to build the reusable component first, integrate it into existing forms, then clean up the backend, and finally wire everything together with validation and tests.

## Tasks

- [x] 1. Create the PlaceAutocompleteInput component
  - [x] 1.1 Create `frontend/src/components/PlaceAutocompleteInput.tsx` with the full component implementation
    - Define the `PlaceAutocompleteInputProps` interface (`value`, `onChange`, `onPlaceSelect`, `placeholder`, `id`, `className`, `required`, `label`)
    - Use `useMapsLibrary('places')` from `@vis.gl/react-google-maps` to load the Places library
    - Implement internal state: `suggestions`, `isOpen`, `highlightedIndex`, `isLoading`
    - Query `AutocompleteService.getPlacePredictions()` when input has ≥ 2 characters, debounced ~300ms
    - Display up to 5 suggestions in a custom dropdown
    - On selection, call `PlacesService.getDetails()` to resolve `formatted_address`, then invoke `onPlaceSelect`
    - On clear (empty input), call `onPlaceSelect(null)` and close dropdown
    - If `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is missing, render as a standard text input without autocomplete
    - Wrap internally with `<APIProvider>` using the env var API key so the component is self-contained
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.3, 5.4_

  - [x] 1.2 Add keyboard navigation and ARIA attributes to PlaceAutocompleteInput
    - Implement ArrowDown/ArrowUp to move highlight through suggestions (clamped to `[0, suggestions.length - 1]`)
    - Enter selects the highlighted suggestion; Escape closes the dropdown
    - Add ARIA: input gets `role="combobox"`, `aria-expanded`, `aria-activedescendant`, `aria-autocomplete="list"`, `aria-controls`
    - Dropdown gets `role="listbox"` with matching `id`
    - Each suggestion gets `role="option"`, unique `id`, and `aria-selected` on the highlighted item
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.3 Add error handling and graceful degradation to PlaceAutocompleteInput
    - On Places API failure, catch error silently, close dropdown, allow manual typing
    - Show "No results found" message when API returns zero results
    - If `getDetails()` fails after selection, fall back to the prediction's `description` field as the address
    - _Requirements: 1.6, 1.7, 5.4_

- [x] 2. Integrate PlaceAutocompleteInput into TripForm
  - [x] 2.1 Replace origin and destination inputs in `frontend/src/components/TripForm.tsx`
    - Replace the origin `<input>` with `<PlaceAutocompleteInput>` bound to `origin` state
    - Replace the destination `<input>` with `<PlaceAutocompleteInput>` bound to `destination` state
    - Preserve existing styling classes and form validation logic
    - On submit, send the formatted address strings to the API (no change to API contract)
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 3. Integrate PlaceAutocompleteInput into PlanDay page
  - [x] 3.1 Replace home address input in `frontend/src/app/plan-day/page.tsx`
    - Replace the home address `<input>` with `<PlaceAutocompleteInput>` bound to `homeAddress` state
    - Preserve existing styling, label, and validation
    - On submit, send the formatted address string as `home_address` (no change to API contract)
    - _Requirements: 3.1, 3.2_

- [x] 4. Checkpoint - Verify frontend integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Remove mock routing mode from backend
  - [x] 5.1 Remove `routing_mode` from Settings and add API key validation in `backend/core/config.py`
    - Remove the `routing_mode: str = "mock"` field from the `Settings` class
    - Add a `model_validator` that logs a warning if `google_maps_api_key` is empty at startup
    - _Requirements: 4.1, 5.1, 5.2_

  - [x] 5.2 Remove mock routing logic from `backend/services/maps_client.py`
    - Remove functions: `mock_route`, `_deterministic_seed`, `_haversine_estimate`
    - Remove constants: `_MOCK_SPEEDS`, `_DETOUR`
    - Keep `_build_transit_segments` (used by `live_route`), `live_route`, `_parse_latlng`, `_parse_duration`, `_MODE_TO_GOOGLE`, `ROUTES_API_URL`, `RawRouteResult`
    - Modify `fetch_route`: remove `routing_mode` parameter, always call `live_route`, raise on failure instead of falling back to mock
    - Modify `fetch_all_routes`: remove `routing_mode` parameter
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [x] 5.3 Update `backend/agents/routing_agent.py` to remove `routing_mode`
    - Remove `routing_mode` parameter from `get_routes`
    - Update call to `fetch_all_routes` to pass only `api_key`
    - _Requirements: 4.6_

  - [x] 5.4 Update `backend/agents/orchestrator.py` to remove `routing_mode`
    - Remove `routing_mode` parameter from `plan_route` and `plan_day` functions
    - Remove `routing_mode` from calls to `get_routes`
    - _Requirements: 4.6_

  - [x] 5.5 Update `backend/api/routes.py` to remove `routing_mode` references
    - Remove `settings.routing_mode` from `plan_route` and `plan_day` endpoint calls
    - Remove `routing_mode` from health endpoint response
    - _Requirements: 4.6, 4.7_

  - [x] 5.6 Remove `routing_mode` from `HealthResponse` in `backend/models/schemas.py`
    - Remove the `routing_mode: str` field from `HealthResponse`
    - _Requirements: 4.7_

- [x] 6. Checkpoint - Verify backend changes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Install test dependencies and set up test infrastructure
  - [x] 7.1 Install fast-check and testing libraries for frontend
    - Add `fast-check` as a dev dependency in `frontend/package.json`
    - Add `vitest`, `@testing-library/react`, `@testing-library/jest-dom` as dev dependencies if not already present
    - Configure vitest in `frontend/vitest.config.ts` if not present
    - _Requirements: 1.1, 1.2, 6.1_

  - [x] 7.2 Install Hypothesis for backend
    - Add `hypothesis` to `backend/requirements.txt`
    - _Requirements: 4.3, 4.5_

- [ ] 8. Write frontend property-based and unit tests
  - [ ]* 8.1 Write property test: Character threshold triggers autocomplete query
    - **Property 1: Character threshold triggers autocomplete query**
    - Generate random strings (0–100 chars). Assert `getPlacePredictions` is called iff string length ≥ 2.
    - **Validates: Requirements 1.1**

  - [ ]* 8.2 Write property test: Suggestion count is capped at 5
    - **Property 2: Suggestion count is capped at 5**
    - Generate random arrays of predictions (0–20 items). Assert displayed count = `min(length, 5)`.
    - **Validates: Requirements 1.2**

  - [ ]* 8.3 Write property test: Selection populates input and closes dropdown
    - **Property 3: Selection populates input and closes dropdown**
    - Generate random prediction lists (1–5) and random index. Assert input value matches selected address and dropdown closes.
    - **Validates: Requirements 1.3, 1.4**

  - [ ]* 8.4 Write property test: Form submission preserves selected addresses
    - **Property 4: Form submission preserves selected addresses**
    - Generate random address string pairs. Assert API payload contains exact strings.
    - **Validates: Requirements 2.2, 3.2**

  - [ ]* 8.5 Write property test: Keyboard navigation keeps highlight in bounds
    - **Property 7: Keyboard navigation keeps highlight in bounds with correct ARIA state**
    - Generate random suggestion lists (1–5) and random ArrowUp/ArrowDown sequences (1–50 presses). Assert highlight stays in `[0, suggestions.length - 1]` and `aria-selected` is correct.
    - **Validates: Requirements 6.1, 6.2, 6.3**

  - [ ]* 8.6 Write unit tests for PlaceAutocompleteInput
    - Test: renders as plain input when API key is missing (Req 5.4)
    - Test: "No results found" message displays when API returns empty results (Req 1.6)
    - Test: input remains functional when Places API fails (Req 1.7)
    - Test: clearing input resets selected place data (Req 1.5)
    - Test: Escape key closes dropdown without selecting (Req 6.4)
    - Test: ARIA attributes are present (`role="combobox"`, `aria-expanded`, `role="listbox"`) (Req 6.5)
    - _Requirements: 1.5, 1.6, 1.7, 5.4, 6.4, 6.5_

  - [ ]* 8.7 Write unit tests for TripForm and PlanDay integration
    - Test: TripForm renders PlaceAutocompleteInput for origin and destination (Req 2.1)
    - Test: TripForm initializes with empty inputs and placeholder text (Req 2.3)
    - Test: PlanDay page renders PlaceAutocompleteInput for home address (Req 3.1)
    - _Requirements: 2.1, 2.3, 3.1_

- [ ] 9. Write backend property-based and unit tests
  - [ ]* 9.1 Write property test: All route fetching uses live API
    - **Property 5: All route fetching uses live API**
    - Generate random (origin, destination, mode) tuples. Mock httpx. Assert `live_route` is called, never `mock_route`.
    - **Validates: Requirements 4.3, 4.4**

  - [ ]* 9.2 Write property test: API errors propagate without mock fallback
    - **Property 6: API errors propagate without mock fallback**
    - Generate random error types. Mock httpx to raise. Assert `fetch_route` raises, never returns mock data.
    - **Validates: Requirements 4.5**

  - [ ]* 9.3 Write unit tests for backend mock removal
    - Test: `Settings` class has no `routing_mode` field (Req 4.1)
    - Test: `mock_route`, `_deterministic_seed`, `_haversine_estimate` are not importable from `maps_client` (Req 4.2)
    - Test: Health endpoint response has no `routing_mode` field (Req 4.7)
    - Test: API routes don't pass `routing_mode` to orchestrator (Req 4.6)
    - Test: `Settings` logs warning when `google_maps_api_key` is empty (Req 5.1, 5.2)
    - _Requirements: 4.1, 4.2, 4.6, 4.7, 5.1, 5.2_

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Frontend uses TypeScript with fast-check for property-based tests
- Backend uses Python with Hypothesis for property-based tests
