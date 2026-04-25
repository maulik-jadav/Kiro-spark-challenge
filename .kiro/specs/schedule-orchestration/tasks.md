# Implementation Plan: Schedule Orchestration (Phase 1.3)

## Overview

This plan implements full-day itinerary planning via OAuth-connected calendars (Google + Outlook). It adds new Pydantic models, extends the calendar client with provider-agnostic OAuth and token encryption, creates a new Schedule Agent for itinerary-level optimization, wires everything through the orchestrator, and exposes new API endpoints. Each task builds incrementally on the previous, ending with integration wiring and testing.

## Tasks

- [ ] 1. Add new Pydantic models and configuration settings
  - [ ] 1.1 Add new config settings to `backend/core/config.py`
    - Add `outlook_client_id`, `outlook_client_secret`, `outlook_redirect_uri` fields to `Settings`
    - Add `token_encryption_key` field (Fernet key for encrypting OAuth tokens at rest)
    - _Requirements: 1.1, 6.1_

  - [ ] 1.2 Add new Pydantic models to `backend/models/schemas.py`
    - Add `InterEventGap` model with `from_event`, `to_event`, `origin`, `destination`, `depart_after`, `arrive_by`, `available_minutes`, `is_feasible` fields
    - Add `GapRouteResult` model with `gap`, `route_comparison`, `recommended_mode`, `recommended_emissions_g`, `recommended_duration_min`, `recommended_cost_usd`, `infeasible_reason` fields
    - Add `ItinerarySummary` model with `total_emissions_g`, `total_cost_usd`, `total_transit_min`, `all_driving_baseline_g`, `savings_vs_driving_g`, `carbon_budget_g`, `budget_remaining_g` fields
    - Add `Itinerary` model with `date`, `events`, `excluded_events`, `gaps`, `summary`, `mode_sequence` fields
    - Add `ScheduleRequest` model with `date` (with YYYY-MM-DD validator), `session_id`, `daily_carbon_budget_g` (ge=0) fields
    - Add `ScheduleResponse` model with `itinerary`, `session_valid` fields
    - _Requirements: 2.2, 3.1, 3.5, 3.6, 4.4, 5.1, 5.4_

  - [ ]* 1.3 Write unit tests for new Pydantic models
    - Test `ScheduleRequest` date validation (valid YYYY-MM-DD, invalid format, negative budget rejected)
    - Test `InterEventGap` field defaults and `is_feasible` logic
    - Test `ItinerarySummary` field constraints
    - _Requirements: 5.1, 4.3_

- [ ] 2. Extend calendar client with provider-agnostic OAuth and token encryption
  - [ ] 2.1 Add Outlook OAuth constants and token encryption helpers to `backend/services/calendar_client.py`
    - Add `MICROSOFT_AUTH_URL`, `MICROSOFT_TOKEN_URL`, `MICROSOFT_GRAPH_API`, `OUTLOOK_SCOPES` constants
    - Add `TokenRecord` dataclass for structured token storage (provider, encrypted tokens, expiry)
    - Implement `_encrypt_token(token, key)` using `cryptography.fernet.Fernet`
    - Implement `_decrypt_token(encrypted, key)` using `cryptography.fernet.Fernet`
    - _Requirements: 6.1_

  - [ ]* 2.2 Write property tests for token encryption (Properties 1–2)
    - **Property 2: Token encryption round-trip** — for any non-empty token and valid Fernet key, encrypt then decrypt produces original; encrypted != plaintext
    - **Validates: Requirements 1.3, 6.1**
    - Create `backend/tests/test_calendar_client_props.py` with Hypothesis strategies
    - _Requirements: 1.3, 6.1_

  - [ ] 2.3 Refactor `generate_auth_url` to support both Google and Outlook providers
    - Update signature to accept `provider` parameter
    - For `"google"`: use existing Google OAuth URL with `calendar.readonly` scope
    - For `"outlook"`: use Microsoft OAuth URL with `Calendars.Read offline_access` scope
    - Return `(auth_url, state)` tuple
    - Preserve backward compatibility for existing Google-only callers
    - _Requirements: 1.1, 1.6_

  - [ ]* 2.4 Write property test for OAuth URL correctness (Property 1)
    - **Property 1: OAuth URL correctness** — for any valid provider, client_id, and redirect_uri, the URL contains the correct base URL, client_id, redirect_uri, and minimum scope
    - **Validates: Requirements 1.1, 1.6**
    - _Requirements: 1.1, 1.6_

  - [ ] 2.5 Implement provider-agnostic `exchange_code_for_tokens` with encryption
    - Update to accept `provider` and `encryption_key` parameters
    - For `"google"`: exchange via Google token endpoint (existing logic)
    - For `"outlook"`: exchange via Microsoft token endpoint
    - Encrypt tokens before storing using `_encrypt_token` if `encryption_key` is provided
    - Store as `TokenRecord` with provider metadata
    - Return `{"session_id": str, "provider": str}`
    - _Requirements: 1.2, 1.3, 6.1_

  - [ ] 2.6 Implement provider-agnostic `refresh_access_token` with encryption
    - Update to accept `encryption_key` parameter
    - Decrypt stored refresh token, call provider-specific refresh endpoint, re-encrypt new access token
    - Handle both Google and Outlook refresh flows
    - _Requirements: 1.4_

  - [ ] 2.7 Implement provider-agnostic `fetch_events` with Outlook support
    - Update to accept `encryption_key` parameter
    - Decrypt access token before API calls
    - For `"google"`: use existing Google Calendar API logic
    - For `"outlook"`: call Microsoft Graph API `/me/calendarview` endpoint
    - Handle token refresh transparently on 401 responses
    - _Requirements: 2.1, 1.4_

  - [ ] 2.8 Implement `revoke_session` and update `get_session`
    - `revoke_session(session_id)`: delete stored tokens, return True if existed
    - Update `get_session` to return metadata (provider) without exposing tokens
    - _Requirements: 6.3, 6.2_

  - [ ]* 2.9 Write property test for session revocation (Property 13)
    - **Property 13: Session revocation completeness** — for any stored session, `revoke_session` returns True and subsequent `get_session` returns None
    - **Validates: Requirements 6.3**
    - _Requirements: 6.3_

- [ ] 3. Checkpoint — Verify calendar client
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement Schedule Agent
  - [ ] 4.1 Create `backend/agents/schedule_agent.py` with `parse_events` function
    - Parse raw event dicts into `CalendarEvent` models
    - Exclude events without a location field, collect excluded summaries
    - Sort parsed events by start time ascending
    - Return `(parsed_events, excluded_summaries)` tuple
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ]* 4.2 Write property tests for event parsing (Properties 3–5)
    - **Property 3: Event parsing preserves fields** — for any raw event with non-empty summary, location, start, end, parsed CalendarEvent has matching values
    - **Validates: Requirements 2.2**
    - **Property 4: No-location events excluded** — events with empty/missing location are excluded; events with location are included; excluded summaries reported
    - **Validates: Requirements 2.3**
    - **Property 5: Events sorted by start time** — output list is sorted by start time ascending
    - **Validates: Requirements 2.4**
    - Create `backend/tests/test_schedule_agent_props.py` with Hypothesis strategies for CalendarEvent generation
    - _Requirements: 2.2, 2.3, 2.4_

  - [ ] 4.3 Implement `detect_gaps` function in `backend/agents/schedule_agent.py`
    - Compute `InterEventGap` for each consecutive pair of events with locations
    - Calculate `available_minutes` as `(next.start - current.end)` in minutes
    - Set `is_feasible = False` for gaps < 5 minutes
    - _Requirements: 3.1, 3.4_

  - [ ]* 4.4 Write property test for gap detection (Property 6)
    - **Property 6: Gap detection correctness** — for any sorted events with locations, produces one gap per consecutive pair; `available_minutes` matches time difference; `is_feasible` correct based on 5-minute threshold
    - **Validates: Requirements 3.1, 3.4**
    - _Requirements: 3.1, 3.4_

  - [ ] 4.5 Implement `plan_gap_route` function in `backend/agents/schedule_agent.py`
    - Run the full agent pipeline (Routing Agent → Emissions Agent → Decision Agent) for a single gap
    - Construct implicit arrival deadline `UserConstraint` from `gap.arrive_by`
    - Build `GapRouteResult` from the pipeline output
    - Skip infeasible gaps and set `infeasible_reason`
    - _Requirements: 3.2, 3.3_

  - [ ]* 4.6 Write property test for arrival deadline constraint (Property 7)
    - **Property 7: Arrival deadline constraint correctness** — for any feasible InterEventGap, the UserConstraint constructed by `plan_gap_route` has `arrival_by` equal to the gap's `arrive_by`
    - **Validates: Requirements 3.3**
    - _Requirements: 3.3_

  - [ ] 4.7 Implement `optimize_itinerary` function in `backend/agents/schedule_agent.py`
    - Pass 1 — Mode consistency: if driving chosen for gap N and driving is viable for gap N+1, prefer driving for gap N+1
    - Pass 2 — Carbon budget enforcement: distribute budget across gaps, swap to greener alternatives when budget exceeded
    - Return optimized list of `GapRouteResult` objects
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 4.8 Write property tests for itinerary optimization (Properties 10–11)
    - **Property 10: Mode consistency preference** — if gap N recommends DRIVING and gap N+1 has DRIVING as viable, optimizer recommends DRIVING for gap N+1
    - **Validates: Requirements 4.2**
    - **Property 11: Carbon budget enforcement** — after optimization, cumulative emissions do not exceed budget when feasible; otherwise minimizes total emissions
    - **Validates: Requirements 4.3**
    - _Requirements: 4.2, 4.3_

  - [ ] 4.9 Implement `compute_all_driving_baseline` function in `backend/agents/schedule_agent.py`
    - Compute total emissions if all gaps were driven (for savings comparison)
    - Use Routing Agent in driving-only mode for each gap
    - _Requirements: 4.4_

  - [ ] 4.10 Implement `plan_itinerary` function in `backend/agents/schedule_agent.py`
    - Fetch events from connected calendar (or mock) via calendar client
    - Call `parse_events` to filter and sort
    - Call `detect_gaps` to find inter-event gaps
    - Call `plan_gap_route` for each feasible gap
    - Call `optimize_itinerary` for mode consistency and carbon budget
    - Call `compute_all_driving_baseline` for savings comparison
    - Assemble `ItinerarySummary` with aggregated totals
    - Build and return `Itinerary` with events, excluded events, gaps, summary, mode sequence
    - _Requirements: 2.1, 3.2, 3.5, 3.6, 4.1, 4.4_

  - [ ]* 4.11 Write property tests for aggregation and completeness (Properties 8–9, 12)
    - **Property 8: Total emissions aggregation** — `ItinerarySummary.total_emissions_g` equals sum of `recommended_emissions_g` across all gaps (within tolerance); same for cost and duration
    - **Validates: Requirements 3.5**
    - **Property 9: Itinerary completeness** — returned Itinerary contains all input events and one GapRouteResult per feasible gap; infeasible gaps have `infeasible_reason` set
    - **Validates: Requirements 3.6**
    - **Property 12: Savings vs driving computation** — `savings_vs_driving_g` equals `all_driving_baseline_g - total_emissions_g` within tolerance
    - **Validates: Requirements 4.4**
    - _Requirements: 3.5, 3.6, 4.4_

- [ ] 5. Checkpoint — Verify Schedule Agent
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Wire orchestrator and API endpoints
  - [ ] 6.1 Add `optimize_schedule` function to `backend/agents/orchestrator.py`
    - Delegate to Schedule Agent's `plan_itinerary`
    - Wrap result in `ScheduleResponse`
    - _Requirements: 5.2_

  - [ ] 6.2 Add `POST /api/v1/optimize-schedule` endpoint to `backend/api/routes.py`
    - Accept `ScheduleRequest`, validate date format
    - If `session_id` provided, validate session exists (return 401 if invalid)
    - If no `session_id`, use mock calendar data
    - Call `orchestrator.optimize_schedule` and return `ScheduleResponse`
    - Include per-gap and total-day emissions summaries in response
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 6.3 Add `GET /api/v1/auth/calendar/{provider}` endpoint to `backend/api/routes.py`
    - Validate provider is "google" or "outlook" (return 422 if invalid)
    - Check OAuth is configured for the provider (return 503 if not)
    - Call `generate_auth_url` with provider-specific client_id and redirect_uri
    - Return `AuthUrlResponse`
    - _Requirements: 1.1, 1.6_

  - [ ] 6.4 Add `GET /api/v1/auth/callback/{provider}` endpoint to `backend/api/routes.py`
    - Exchange authorization code for tokens via `exchange_code_for_tokens`
    - Return `AuthCallbackResponse` with session_id
    - Return HTTP 400 on OAuth failure with descriptive error
    - _Requirements: 1.2, 1.3, 1.5_

  - [ ] 6.5 Add `DELETE /api/v1/auth/calendar` endpoint to `backend/api/routes.py`
    - Accept `session_id` query parameter
    - Call `revoke_session`, return success or 404 if session not found
    - _Requirements: 6.3_

  - [ ]* 6.6 Write unit tests for new API endpoints
    - Test `POST /optimize-schedule` returns 200 with mock data (no session_id)
    - Test `POST /optimize-schedule` returns 401 with invalid session_id
    - Test `POST /optimize-schedule` returns 422 with invalid date format
    - Test `POST /optimize-schedule` returns 422 with negative carbon budget
    - Test `GET /auth/calendar/google` returns auth URL
    - Test `GET /auth/calendar/outlook` returns auth URL
    - Test `GET /auth/calendar/invalid` returns 422
    - Test `DELETE /auth/calendar` with valid session returns success
    - Test `DELETE /auth/calendar` with unknown session returns 404
    - Test response does not contain OAuth tokens (Req 6.2)
    - Create `backend/tests/test_schedule_api.py`
    - _Requirements: 5.1, 5.3, 1.1, 1.5, 6.2, 6.3_

- [ ] 7. Checkpoint — Verify full pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Integration tests
  - [ ]* 8.1 Write integration tests for the full optimize-schedule pipeline
    - Test full `POST /optimize-schedule` with mock data returns complete Itinerary shape
    - Test pipeline invokes Routing → Emissions → Decision agents for each feasible gap
    - Test mode consistency across gaps (driving carries forward)
    - Test carbon budget reduces emissions vs unconstrained run
    - Test all-driving baseline matches sum of driving emissions per gap
    - Test Google OAuth full flow with mocked endpoints (auth URL → callback → session)
    - Test Outlook OAuth full flow with mocked endpoints (auth URL → callback → session)
    - Test token refresh on 401 (mock expired token → refresh → retry)
    - Create `backend/tests/test_schedule_integration.py`
    - _Requirements: 5.2, 3.2, 4.2, 4.3, 4.4, 1.1, 1.2, 1.4_

- [ ] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major component
- Property tests validate the 13 universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The existing `/plan-day`, `/auth/google`, and `/auth/callback` endpoints are preserved for backward compatibility
- All new code uses Python with Pydantic models, FastAPI endpoints, and Hypothesis for property-based testing
