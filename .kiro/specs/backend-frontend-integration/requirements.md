# Requirements Document: Backend-Frontend Integration

## Introduction

This feature integrates the PathProject FastAPI backend with the Next.js frontend, resolving all identified conflicts and mismatches between the backend API contracts and the frontend type definitions, API client, and components. The goal is end-to-end data flow correctness across all existing and planned endpoints.

### Identified Conflicts and Resolutions

| # | Area | Backend | Frontend | Resolution |
|---|---|---|---|---|
| C1 | `RouteComparison.reasoning` | Returns `reasoning: AgentReasoning \| None` | No `reasoning` field on frontend type | Add `reasoning` field + UI "reasoning" loading state while waiting for model response |
| C2 | `RouteRequest.constraint` | Accepts optional `constraint: str \| None` | `planRoute()` has no `constraint` param | Add constraint text input field + microphone button for voice input |
| C3 | Day planning endpoint | `POST /api/v1/plan-day` returns `DayPlanResponse` | No API client, types, or UI | Create new sidebar page for "Plan Day" feature |
| C4 | OAuth flow | `GET /api/v1/auth/google` and callback | No auth flow in frontend | Build frontend auth flow; backend endpoints boilerplate only (no real logic) |
| C5 | Calendar/itinerary types | `CalendarEvent`, `TransitWindow`, etc. defined | Types missing from frontend | Mirror all backend types in frontend TypeScript definitions |
| C6 | Health endpoint | `GET /api/v1/health` | No health check client | **Deferred** — integration testing concern, not needed in frontend for now |
| C7 | Error response format | Structured `ErrorResponse` model | Errors parsed as raw text | Follow backend's structured `ErrorResponse` format in frontend |
| C8 | Factor endpoints | `GET /emission-factors`, `GET /cost-factors` | No client functions or types | Create frontend API client functions mirroring backend endpoints |
| C9 | `AgentReasoning` type | Full model with recommendation fields | Type missing from frontend | Create type + UI layout with "in process" state and output area for reasoning |

## Glossary

- **API_Client**: The frontend module at `frontend/src/lib/api.ts` that makes HTTP requests to the backend
- **Type_Definitions**: The frontend TypeScript type declarations at `frontend/src/types/api.ts`
- **Backend_API**: The FastAPI application serving endpoints under `/api/v1/`
- **RouteComparison**: The response model returned by `POST /api/v1/plan-route` containing route options and rankings
- **AgentReasoning**: The backend model containing the decision agent's recommendation, summary, and justification
- **DayPlanResponse**: The backend model returned by `POST /api/v1/plan-day` containing a full day's transit itinerary
- **ErrorResponse**: The standardized backend error response model with `status_code`, `message`, `detail`, and optional `errors` array
- **TransitWindow**: A gap between two calendar events where transit is needed, with a recommended route
- **Frontend_Components**: The React components in `frontend/src/components/` that render route data
- **ReasoningPanel**: A new frontend component that displays the agent reasoning loading state and output
- **PlanDayPage**: A new frontend page accessible from the sidebar for day planning

## Requirements

### Requirement 1: Align RouteComparison Type and Add Reasoning UI State

**User Story:** As a user, I want to see a "reasoning" loading state while the AI agent processes my route request, and then see the reasoning result when it arrives, so that I know the system is working and can understand the recommendation.

#### Acceptance Criteria

1. THE Type_Definitions SHALL include a `reasoning` field of type `AgentReasoning | null` on the `RouteComparison` interface
2. THE Type_Definitions SHALL define an `AgentReasoning` interface with fields: `recommended_mode` of type `TransitMode`, `summary` of type `string`, `justification` of type `string`, and `constraint_analysis` of type `string | null`
3. WHEN the Backend_API returns a `RouteComparison` with a non-null `reasoning` field, THE API_Client SHALL preserve the `reasoning` object in the returned data without modification
4. WHILE the API_Client is awaiting a response from `POST /api/v1/plan-route`, THE Frontend_Components SHALL display a "reasoning" loading state indicating the AI agent is processing
5. WHEN the response arrives with reasoning data, THE Frontend_Components SHALL transition from the loading state to displaying the reasoning result

### Requirement 2: Add Constraint Input with Microphone Support

**User Story:** As a user, I want to type or speak a constraint when planning a route (e.g., "Arrive by 10 AM", "Budget under $5"), so that the decision agent can factor it into its recommendation.

#### Acceptance Criteria

1. THE API_Client `planRoute` function SHALL accept an optional `constraint` parameter of type `string | null`
2. WHEN a non-null `constraint` is provided, THE API_Client SHALL include it in the request body sent to `POST /api/v1/plan-route`
3. WHEN no `constraint` is provided, THE API_Client SHALL send `constraint: null` in the request body
4. THE Frontend_Components SHALL render a text input field for the user to enter a constraint string
5. THE Frontend_Components SHALL render a microphone button adjacent to the constraint input field
6. WHEN the user clicks the microphone button, THE Frontend_Components SHALL use the Web Speech API (or equivalent) to capture voice input and populate the constraint text field with the transcribed text
7. THE constraint input field SHALL be optional — the user can submit a route plan without entering a constraint

### Requirement 3: Add Day Planning Page and API Integration

**User Story:** As a user, I want to access a "Plan Day" page from the sidebar to plan a full day's transit between my calendar events, so that I can see optimized routes for my entire schedule.

#### Acceptance Criteria

1. THE Type_Definitions SHALL define a `DayPlanRequest` interface with fields: `date` of type `string`, `session_id` of type `string | null`, and `home_address` of type `string`
2. THE Type_Definitions SHALL define a `DayPlanResponse` interface with fields: `date` of type `string`, `events` of type `CalendarEvent[]`, `transit_windows` of type `TransitWindow[]`, `total_emissions_g` of type `number`, `total_cost_usd` of type `number`, and `total_transit_min` of type `number`
3. THE Type_Definitions SHALL define a `CalendarEvent` interface with fields: `summary` of type `string`, `location` of type `string`, `start` of type `string`, and `end` of type `string`
4. THE Type_Definitions SHALL define a `TransitWindow` interface with fields: `from_event` of type `string`, `to_event` of type `string`, `origin` of type `string`, `destination` of type `string`, `depart_after` of type `string`, `arrive_by` of type `string`, `available_min` of type `number`, `recommended` of type `TransitRecommendation`, and `route` of type `RouteComparison`
5. THE Type_Definitions SHALL define a `TransitRecommendation` interface with fields: `mode` of type `TransitMode`, `duration_min` of type `number`, `emissions_g` of type `number`, `cost_usd` of type `number`, and `summary` of type `string`
6. THE API_Client SHALL export a `planDay` function that sends a `POST` request to `/api/v1/plan-day` with a `DayPlanRequest` body and returns a `Promise<DayPlanResponse>`
7. IF the Backend_API returns a non-OK HTTP status for the day plan request, THEN THE API_Client SHALL throw an error with the status code and response text
8. THE frontend SHALL include a new page/route for "Plan Day" accessible from the sidebar navigation
9. THE PlanDayPage SHALL include input fields for date and home address, and display the day plan results including events, transit windows, and summary totals

### Requirement 4: Add OAuth Flow Integration (Frontend Only, Backend Boilerplate)

**User Story:** As a user, I want to authenticate with Google Calendar from the frontend, so that the day planner can access my real calendar events.

#### Acceptance Criteria

1. THE Type_Definitions SHALL define an `AuthUrlResponse` interface with fields: `auth_url` of type `string` and `state` of type `string`
2. THE Type_Definitions SHALL define an `AuthCallbackResponse` interface with fields: `session_id` of type `string` and `message` of type `string`
3. THE API_Client SHALL export a `getAuthUrl` function that sends a `GET` request to `/api/v1/auth/google` and returns a `Promise<AuthUrlResponse>`
4. WHEN the user initiates Google Calendar authentication, THE API_Client SHALL redirect the user to the `auth_url` returned by the Backend_API
5. IF the Backend_API returns HTTP 503 for the auth request, THEN THE API_Client SHALL throw an error indicating that OAuth is not configured
6. THE Backend_API OAuth endpoints (`/api/v1/auth/google` and `/api/v1/auth/callback`) SHALL contain only boilerplate code with empty/stub logic — no real OAuth implementation yet
7. THE backend boilerplate SHALL define the correct request/response schemas and return placeholder responses so the frontend can be developed against the contract

### Requirement 5: Mirror Backend Calendar/Itinerary Types in Frontend

**User Story:** As a frontend developer, I want all backend calendar and itinerary types mirrored in the frontend TypeScript definitions, so that the frontend can correctly consume day planning data.

#### Acceptance Criteria

1. THE Type_Definitions SHALL define a `CalendarEvent` interface matching the backend `CalendarEvent` Pydantic model
2. THE Type_Definitions SHALL define a `TransitWindow` interface matching the backend `TransitWindow` Pydantic model
3. THE Type_Definitions SHALL define a `TransitRecommendation` interface matching the backend `TransitRecommendation` Pydantic model
4. THE Type_Definitions SHALL define a `DayPlanRequest` interface matching the backend `DayPlanRequest` Pydantic model
5. THE Type_Definitions SHALL define a `DayPlanResponse` interface matching the backend `DayPlanResponse` Pydantic model
6. FOR EACH mirrored type, all field names and types SHALL be compatible between the backend Pydantic model and the frontend TypeScript interface

### Requirement 6: Health Check Integration — DEFERRED

**Status:** Deferred — health check is an integration testing concern and is not needed in the frontend for now.

### Requirement 7: Implement Structured Error Handling Following Backend

**User Story:** As a frontend developer, I want the API client to parse structured error responses matching the backend's `ErrorResponse` format, so that the UI can display field-level validation errors and meaningful error messages.

#### Acceptance Criteria

1. THE Type_Definitions SHALL define an `ErrorResponse` interface with fields: `status_code` of type `number`, `message` of type `string`, `detail` of type `string | null`, and `errors` of type `ValidationErrorDetail[] | null`
2. THE Type_Definitions SHALL define a `ValidationErrorDetail` interface with fields: `field` of type `string` and `reason` of type `string`
3. WHEN the Backend_API returns a non-OK HTTP status, THE API_Client SHALL attempt to parse the response body as JSON conforming to the `ErrorResponse` interface
4. IF the response body is valid `ErrorResponse` JSON, THEN THE API_Client SHALL throw an error that includes the `message` and `detail` fields
5. IF the response body is not valid JSON, THEN THE API_Client SHALL fall back to using the raw response text as the error message
6. WHEN the Backend_API returns HTTP 422, THE API_Client SHALL make the `errors` array available so the UI can display field-level validation feedback

### Requirement 8: Add Emission and Cost Factor API Integration

**User Story:** As a frontend developer, I want to fetch emission and cost factor data from the backend, so that the frontend can render charts and reference data.

#### Acceptance Criteria

1. THE Type_Definitions SHALL define an `EmissionFactorResponse` interface with fields: `mode` of type `string`, `g_co2e_per_pkm` of type `number`, `source` of type `string`, and `notes` of type `string`
2. THE Type_Definitions SHALL define a `CostFactorResponse` interface with fields: `mode` of type `string`, `base_fare` of type `number`, `per_km_cost` of type `number`, `source` of type `string`, and `notes` of type `string`
3. THE API_Client SHALL export a `getEmissionFactors` function that sends a `GET` request to `/api/v1/emission-factors` and returns a `Promise<EmissionFactorResponse[]>`
4. THE API_Client SHALL export a `getCostFactors` function that sends a `GET` request to `/api/v1/cost-factors` and returns a `Promise<CostFactorResponse[]>`

### Requirement 9: Agent Reasoning UI Layout with In-Process and Output States

**User Story:** As a user, I want to see a dedicated UI area that shows the AI agent is reasoning (in-process state) and then displays the full reasoning output when complete, so that I have visibility into the agent's decision-making process.

#### Acceptance Criteria

1. THE Frontend_Components SHALL include a ReasoningPanel component with two visual states: "in process" (loading/thinking) and "complete" (showing output)
2. WHILE the agent is processing, THE ReasoningPanel SHALL display an animated "reasoning in process" indicator
3. WHEN the `RouteComparison` response contains a non-null `reasoning` field, THE ReasoningPanel SHALL display the `recommended_mode` and `summary` in the output area
4. WHEN the user expands the reasoning output, THE ReasoningPanel SHALL display the full `justification` text
5. WHEN the `reasoning` contains a non-null `constraint_analysis`, THE ReasoningPanel SHALL display the constraint analysis alongside the justification
6. WHEN the `RouteComparison` response contains a null `reasoning` field, THE ReasoningPanel SHALL not render

### Requirement 10: End-to-End Data Flow Validation

**User Story:** As a developer, I want to verify that data flows correctly from the backend through the API client to the frontend components, so that no fields are lost or mistyped in transit.

#### Acceptance Criteria

1. FOR ALL fields defined in the backend `RouteComparison` Pydantic model, THE frontend `RouteComparison` TypeScript interface SHALL have a corresponding field with a compatible type
2. FOR ALL fields defined in the backend `RouteOption` Pydantic model, THE frontend `RouteOption` TypeScript interface SHALL have a corresponding field with a compatible type
3. FOR ALL fields defined in the backend `RouteSegment` Pydantic model, THE frontend `RouteSegment` TypeScript interface SHALL have a corresponding field with a compatible type
4. THE `TransitMode` union type in the frontend SHALL contain exactly the same set of string values as the `TransitMode` enum in the backend
5. WHEN the Next.js rewrite proxy forwards a request to the backend, THE request body and response body SHALL pass through without modification
