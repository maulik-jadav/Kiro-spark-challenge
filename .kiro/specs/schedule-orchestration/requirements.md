# Requirements: Schedule Orchestration (Phase 1.3)

## Introduction

This phase adds full itinerary planning via calendar integration. The system ingests a user's day of events through OAuth-connected calendars (Google Calendar or Outlook), detects gaps between events, and uses the multi-agent pipeline to optimize sustainable transit for each transition. The Schedule Agent orchestrates route optimization across the full day rather than treating each gap independently.

## Glossary

- **Route_Planner**: The PathProject backend system responsible for computing, analyzing, and recommending routes
- **Schedule_Agent**: The agent responsible for ingesting calendar events, detecting inter-event gaps, and orchestrating route optimization across a full day's itinerary
- **Decision_Agent**: The agent responsible for comparing route options, applying user constraints, ranking results, and generating natural language justifications
- **Calendar_Event**: A structured representation of a user's scheduled event with start time, end time, and location
- **Inter_Event_Gap**: The time window between the end of one Calendar_Event and the start of the next
- **Itinerary**: A full-day plan containing Calendar_Events and optimized routes for each Inter_Event_Gap
- **User_Constraint**: A condition specified by the user that restricts route selection (e.g., arrival deadline, maximum cost, preferred modes)
- **Transit_Mode**: One of the 11 supported transportation modes

## Dependencies

- Requires Phase 1.1 (core-route-mvp) and Phase 1.2 (agentic-reasoning-layer) to be complete — the full multi-agent pipeline must be functional.

## Requirements

### Requirement 1: Calendar Integration via OAuth

**User Story:** As a user, I want to connect my Google Calendar or Outlook calendar, so that the system can read my schedule and plan routes around my events.

#### Acceptance Criteria

1. WHEN a user initiates calendar connection, THE Route_Planner SHALL redirect the user to the OAuth 2.0 authorization endpoint for the selected calendar provider (Google Calendar or Microsoft Outlook)
2. WHEN the OAuth callback is received with a valid authorization code, THE Route_Planner SHALL exchange the code for access and refresh tokens
3. THE Route_Planner SHALL store OAuth tokens securely and associate them with the user session
4. WHEN an access token expires, THE Route_Planner SHALL use the refresh token to obtain a new access token without requiring user re-authorization
5. IF the OAuth authorization is denied or fails, THEN THE Route_Planner SHALL return a descriptive error message to the user
6. THE Route_Planner SHALL request only the minimum calendar read scope required to fetch event data

---

### Requirement 2: Calendar Event Ingestion

**User Story:** As a user, I want the system to read my day's events including times and locations, so that it can plan routes between them.

#### Acceptance Criteria

1. WHEN a user requests schedule optimization for a specific date, THE Schedule_Agent SHALL fetch all Calendar_Events for that date from the connected calendar provider
2. THE Schedule_Agent SHALL parse each Calendar_Event into a structured representation containing: event title, start time, end time, and location
3. WHEN a Calendar_Event has no location field, THE Schedule_Agent SHALL exclude that event from route planning and note the exclusion
4. THE Schedule_Agent SHALL sort Calendar_Events by start time in ascending order
5. IF the calendar API returns an error or empty response, THEN THE Schedule_Agent SHALL return a descriptive error indicating no events were found or the calendar is unreachable

---

### Requirement 3: Inter-Event Gap Detection and Route Optimization

**User Story:** As a user, I want the system to detect gaps between my events and suggest optimal sustainable routes for each transition, so that I can minimize my carbon footprint across my entire day.

#### Acceptance Criteria

1. THE Schedule_Agent SHALL compute Inter_Event_Gaps as the time between the end of one Calendar_Event and the start of the next Calendar_Event
2. WHEN an Inter_Event_Gap is detected and both adjacent events have locations, THE Schedule_Agent SHALL invoke the multi-agent pipeline (Routing_Agent, Emissions_Agent, Decision_Agent) for that origin-destination pair
3. THE Schedule_Agent SHALL apply an implicit arrival deadline User_Constraint equal to the start time of the next Calendar_Event for each Inter_Event_Gap route
4. WHEN an Inter_Event_Gap is shorter than 5 minutes, THE Schedule_Agent SHALL flag the transition as infeasible and skip route planning for that gap
5. THE Schedule_Agent SHALL aggregate total emissions across all Inter_Event_Gap routes to produce a full-day carbon footprint estimate
6. THE Schedule_Agent SHALL return a complete Itinerary containing all Calendar_Events and recommended routes for each Inter_Event_Gap

---

### Requirement 4: Itinerary-Level Optimization

**User Story:** As a user, I want the system to optimize my entire day's travel holistically rather than gap-by-gap, so that globally better combinations are considered.

#### Acceptance Criteria

1. WHEN optimizing a full-day Itinerary, THE Schedule_Agent SHALL consider the cumulative effect of mode choices across all Inter_Event_Gaps
2. THE Schedule_Agent SHALL prefer mode consistency where practical (e.g., if a user drives to event A, the car is available for event B) and note mode-switching costs
3. WHEN a user specifies a daily carbon budget, THE Schedule_Agent SHALL distribute the budget across Inter_Event_Gaps and flag transitions that would exceed the remaining budget
4. THE Schedule_Agent SHALL provide a summary comparing the optimized Itinerary total emissions against an all-driving baseline

---

### Requirement 5: API Endpoint for Schedule Optimization

**User Story:** As a frontend developer, I want an API endpoint for full-day schedule optimization, so that I can build the itinerary planner interface.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a POST /api/v1/optimize-schedule endpoint that accepts a date and optional daily carbon budget
2. WHEN a valid request is received and the user has a connected calendar, THE Route_Planner SHALL return a complete Itinerary with routes for each Inter_Event_Gap
3. IF the user has no connected calendar, THEN THE Route_Planner SHALL return HTTP 401 with a message directing the user to connect a calendar
4. THE Route_Planner SHALL include per-gap and total-day emissions summaries in the response

---

### Requirement 6: OAuth Token Security

**User Story:** As a developer, I want OAuth tokens handled securely, so that user calendar data is protected.

#### Acceptance Criteria

1. WHEN OAuth tokens are stored, THE Route_Planner SHALL encrypt tokens at rest and transmit them only over HTTPS
2. THE Route_Planner SHALL not expose OAuth tokens in any API response or log output
3. THE Route_Planner SHALL provide a mechanism for users to revoke calendar access and delete stored tokens
