# Implementation Plan: Backend-Frontend Integration

## Overview

This plan integrates the PathProject FastAPI backend with the Next.js frontend by resolving all identified type mismatches (C1–C5, C7–C9; C6 deferred), adding missing API client functions, creating new UI components (ReasoningPanel, ConstraintInput), building the Plan Day page, and establishing structured error handling. The approach is type-first: mirror backend models in frontend TypeScript types, then update the API client, then build/modify components.

## Tasks

- [x] 1. Mirror backend Pydantic models as frontend TypeScript types
  - [x] 1.1 Add AgentReasoning interface and update RouteComparison with reasoning field
    - Add `AgentReasoning` interface with `recommended_mode`, `summary`, `justification`, `constraint_analysis` fields
    - Add `reasoning: AgentReasoning | null` to existing `RouteComparison` interface
    - _Requirements: 1.1, 1.2, 9.3_
  - [x] 1.2 Add calendar and itinerary types
    - Add `CalendarEvent`, `TransitRecommendation`, `TransitWindow`, `DayPlanRequest`, `DayPlanResponse` interfaces to `frontend/src/types/api.ts`
    - All field names and types must match the backend Pydantic models in `backend/models/schemas.py`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_
  - [x] 1.3 Add auth, error, and factor response types
    - Add `AuthUrlResponse`, `AuthCallbackResponse` interfaces
    - Add `ErrorResponse`, `ValidationErrorDetail` interfaces
    - Add `EmissionFactorResponse`, `CostFactorResponse` interfaces
    - _Requirements: 4.1, 4.2, 7.1, 7.2, 8.1, 8.2_
  - [ ]* 1.4 Write property test for backend-frontend type round-trip compatibility
    - **Property 1: Backend-frontend type round-trip compatibility**
    - Use fast-check to generate random instances of each model type, serialize to JSON, parse into frontend types, verify all fields preserved
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.1, 10.2, 10.3**

- [x] 2. Implement shared error handling in API client
  - [x] 2.1 Create ApiError class and handleApiError helper
    - Add `ApiError` class extending `Error` with `statusCode`, `detail`, `errors` fields to `frontend/src/lib/api.ts`
    - Implement `handleApiError(res: Response)` that attempts JSON parse as `ErrorResponse`, falls back to raw text
    - Handle 422 responses by preserving the `errors` array for field-level validation feedback
    - _Requirements: 7.3, 7.4, 7.5, 7.6_
  - [ ]* 2.2 Write property test for structured error parsing
    - **Property 2: API client structured error parsing**
    - Use fast-check to generate random `ErrorResponse` JSON payloads, mock fetch, verify thrown `ApiError` contains `message` and `detail`
    - **Validates: Requirements 7.3, 7.4**
  - [ ]* 2.3 Write property test for non-JSON error fallback
    - **Property 3: API client non-JSON error fallback**
    - Use fast-check to generate random non-JSON strings as response bodies, mock fetch with non-OK status, verify thrown error contains raw text
    - **Validates: Requirements 7.5**

- [x] 3. Update planRoute and add new API client functions
  - [x] 3.1 Update planRoute to accept constraint parameter and use handleApiError
    - Add optional `constraint?: string | null` parameter to `planRoute()`
    - Include `constraint` in the request body sent to `POST /api/v1/plan-route`
    - Replace existing error handling with the shared `handleApiError` helper
    - _Requirements: 2.1, 2.2, 2.3, 1.3_
  - [x] 3.2 Add planDay API client function
    - Export `planDay(req: DayPlanRequest): Promise<DayPlanResponse>` that POSTs to `/api/v1/plan-day`
    - Use `handleApiError` for error handling
    - _Requirements: 3.6, 3.7_
  - [x] 3.3 Add getAuthUrl API client function
    - Export `getAuthUrl(): Promise<AuthUrlResponse>` that GETs `/api/v1/auth/google`
    - Handle 503 status as "OAuth not configured" error
    - _Requirements: 4.3, 4.5_
  - [x] 3.4 Add getEmissionFactors and getCostFactors API client functions
    - Export `getEmissionFactors(): Promise<EmissionFactorResponse[]>` that GETs `/api/v1/emission-factors`
    - Export `getCostFactors(): Promise<CostFactorResponse[]>` that GETs `/api/v1/cost-factors`
    - _Requirements: 8.3, 8.4_
  - [ ]* 3.5 Write property test for constraint in request body
    - **Property 4: API client request body includes constraint**
    - Use fast-check to generate random non-null constraint strings, mock fetch, call `planRoute`, verify request body `constraint` field matches
    - **Validates: Requirements 2.2**

- [x] 4. Checkpoint
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Build ConstraintInput component with voice support
  - [x] 5.1 Create ConstraintInput component
    - Create `frontend/src/components/ConstraintInput.tsx` with text input and microphone button
    - Use `window.SpeechRecognition` (or `webkitSpeechRecognition`) for voice input
    - Hide the mic button if the browser does not support the Web Speech API
    - On recognition result, populate the input field with transcribed text
    - Props: `value: string`, `onChange: (value: string) => void`, `disabled?: boolean`
    - _Requirements: 2.4, 2.5, 2.6, 2.7_
  - [ ]* 5.2 Write unit tests for ConstraintInput
    - Test text input renders and accepts input
    - Test mic button presence/absence based on SpeechRecognition support
    - Mock `SpeechRecognition` to test voice input flow
    - _Requirements: 2.4, 2.5, 2.6_

- [x] 6. Build ReasoningPanel component
  - [x] 6.1 Create ReasoningPanel component
    - Create `frontend/src/components/ReasoningPanel.tsx` with two visual states: loading (animated indicator) and complete (showing output)
    - Display `recommended_mode` and `summary` when reasoning is available
    - Add expand toggle to reveal full `justification` and `constraint_analysis` (if non-null)
    - Do not render when `reasoning` is `null` and `loading` is `false`
    - Props: `reasoning: AgentReasoning | null`, `loading: boolean`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - [ ]* 6.2 Write property test for ReasoningPanel rendering
    - **Property 5: ReasoningPanel renders all AgentReasoning fields**
    - Use fast-check to generate random `AgentReasoning` objects (with and without `constraint_analysis`), render `ReasoningPanel`, verify all expected fields appear in output
    - **Validates: Requirements 9.3, 9.5**
  - [ ]* 6.3 Write unit tests for ReasoningPanel states
    - Test loading state shows animated indicator
    - Test null reasoning hides the panel
    - Test complete state displays recommended_mode and summary
    - Test expand toggle reveals justification
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

- [x] 7. Integrate ConstraintInput and ReasoningPanel into existing pages
  - [x] 7.1 Update TripForm to include ConstraintInput
    - Add `constraint` state variable to `TripForm`
    - Render `ConstraintInput` between the mode chips and the submit button
    - Update `onSubmit` callback signature to include `constraint: string | null`
    - _Requirements: 2.4, 2.7_
  - [x] 7.2 Update Home page to wire constraint and reasoning
    - Update `handleSubmit` in `frontend/src/app/page.tsx` to accept and pass `constraint` to `planRoute()`
    - Render `ReasoningPanel` with `loading` state and `result?.reasoning`
    - Place `ReasoningPanel` between the loading indicator and `ResultsPanel`
    - _Requirements: 1.3, 1.4, 1.5, 2.1_

- [x] 8. Build Plan Day page and add sidebar navigation
  - [x] 8.1 Create PlanDayPage
    - Create `frontend/src/app/plan-day/page.tsx` with date input, home address input, optional "Connect Google Calendar" button, and submit button
    - On submit, call `planDay()` and display results: event timeline, transit windows with recommended modes, summary totals (emissions, cost, transit time)
    - Handle errors using `ApiError` — display field-level errors for 422, "OAuth not configured" for 503
    - _Requirements: 3.8, 3.9, 4.4_
  - [x] 8.2 Add Plan Day link to sidebar navigation
    - Add "Plan Day" nav item to the desktop sidebar and mobile bottom nav in `frontend/src/app/page.tsx`
    - Link to `/plan-day` route
    - _Requirements: 3.8_
  - [ ]* 8.3 Write unit tests for PlanDayPage
    - Test date and address inputs render
    - Test submit calls planDay with correct parameters
    - Test results display events and transit windows
    - _Requirements: 3.8, 3.9_

- [x] 9. Verify end-to-end data flow and TransitMode parity
  - [x] 9.1 Verify TransitMode parity between backend and frontend
    - Compare backend `TransitMode` enum values in `backend/core/emission_factors.py` with frontend `TransitMode` union type in `frontend/src/types/api.ts`
    - Ensure exact match of all string values
    - _Requirements: 10.4_
  - [x] 9.2 Verify Next.js rewrite proxy passes requests through without modification
    - Confirm `next.config.js` rewrite rule forwards `/api/v1/*` to the FastAPI backend unchanged
    - _Requirements: 10.5_

- [x] 10. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using fast-check
- Unit tests validate specific examples and edge cases
- C6 (health check) is deferred per requirements and excluded from this plan
- Backend OAuth endpoints are stubs only — frontend auth flow is built against the contract
