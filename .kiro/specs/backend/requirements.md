# Requirements Document

## Introduction

PathProject is a carbon-aware route planning platform that helps users make sustainable transportation choices. The backend provides multi-modal route computation, emissions analysis, agentic reasoning for tradeoff evaluation, schedule-aware itinerary optimization, and a client-facing API. This document specifies requirements across four implementation phases: Core Data & Single-Route MVP, Agentic Reasoning Layer, Schedule Orchestration, and Backend API for Client Interface.

## Glossary

- **Route_Planner**: The PathProject backend system responsible for computing, analyzing, and recommending routes
- **Routing_Agent**: The agent responsible for fetching all possible paths and transit modes between two points
- **Emissions_Agent**: The agent responsible for computing carbon cost (g CO2e) for each route option using EPA/IPCC/FTA emission factors
- **Decision_Agent**: The agent responsible for comparing route options, applying user constraints, ranking results, and generating natural language justifications
- **Schedule_Agent**: The agent responsible for ingesting calendar events, detecting inter-event gaps, and orchestrating route optimization across a full day's itinerary
- **Maps_Client**: The service layer that interfaces with Google Maps Routes API or returns mock routing data
- **Emission_Factor**: A data record containing grams CO2-equivalent per passenger-kilometer for a specific transit mode, with source provenance
- **Cost_Factor**: A data record containing base fare (USD) and per-kilometer cost for a specific transit mode, with source provenance
- **Transit_Mode**: One of the 11 supported transportation modes: driving, carpool_2, carpool_4, bus, light_rail, subway, commuter_rail, walking, bicycling, e_scooter, rideshare
- **Route_Option**: A complete route from origin to destination via a specific primary transit mode, containing one or more segments
- **Route_Segment**: A single leg within a route (e.g., walk to station, ride light rail, walk to destination)
- **Route_Comparison**: The full response containing all evaluated route options with rankings and savings metrics
- **Raw_Route_Result**: The intermediate data structure returned by the Maps_Client before emissions analysis
- **User_Constraint**: A condition specified by the user that restricts route selection (e.g., arrival deadline, maximum cost, preferred modes)
- **Tradeoff_Summary**: A structured comparison between two route options quantifying differences in emissions, time, and cost
- **Calendar_Event**: A structured representation of a user's scheduled event with start time, end time, and location
- **Inter_Event_Gap**: The time window between the end of one Calendar_Event and the start of the next
- **Itinerary**: A full-day plan containing Calendar_Events and optimized routes for each Inter_Event_Gap

## Requirements

### Requirement 1: Multi-Modal Route Fetching

**User Story:** As a user, I want to request routes between two locations across multiple transit modes, so that I can compare my transportation options.

#### Acceptance Criteria

1. WHEN a valid origin and destination are provided, THE Routing_Agent SHALL return route data for each requested Transit_Mode
2. WHEN no Transit_Mode list is specified, THE Routing_Agent SHALL evaluate the default set of modes: driving, light_rail, bus, bicycling, walking, and rideshare
3. WHILE operating in mock routing mode, THE Maps_Client SHALL return deterministic route data for the same origin-destination pair across repeated requests
4. WHILE operating in live routing mode, THE Maps_Client SHALL call the Google Maps Routes API and return distance and duration for each Transit_Mode
5. IF the Google Maps Routes API call fails, THEN THE Maps_Client SHALL fall back to mock routing and log a warning
6. WHEN the computed walking distance exceeds 8 km, THE Routing_Agent SHALL exclude the walking option from results
7. WHEN the computed bicycling distance exceeds 25 km, THE Routing_Agent SHALL exclude the bicycling option from results

---

### Requirement 2: Multi-Segment Route Composition

**User Story:** As a user, I want transit routes to include realistic segments (walk to station, ride, walk to destination), so that I get accurate time and distance estimates.

#### Acceptance Criteria

1. WHEN the Transit_Mode is bus, light_rail, subway, or commuter_rail, THE Maps_Client SHALL generate a multi-segment route consisting of a walking segment to the station, a transit segment, and a walking segment to the destination
2. WHEN the Transit_Mode is driving, walking, bicycling, e_scooter, or rideshare, THE Maps_Client SHALL generate a single-segment route
3. THE Route_Planner SHALL ensure the sum of all Route_Segment distances within a Route_Option equals the Route_Option total distance
4. THE Route_Planner SHALL ensure the sum of all Route_Segment durations within a Route_Option does not exceed the Route_Option total duration plus wait time allowance

---

### Requirement 3: Emissions Computation

**User Story:** As a user, I want to see the carbon footprint of each route option, so that I can make environmentally informed travel decisions.

#### Acceptance Criteria

1. THE Emissions_Agent SHALL compute emissions for each Route_Segment as the product of the segment distance in kilometers and the Emission_Factor for that segment's Transit_Mode
2. THE Emissions_Agent SHALL compute total Route_Option emissions as the sum of all Route_Segment emissions within that option
3. THE Emissions_Agent SHALL express emissions in both grams CO2e and kilograms CO2e, where kilograms equals grams divided by 1000
4. THE Emissions_Agent SHALL attach the Emission_Factor source provenance string to each Route_Option
5. WHEN the Transit_Mode is walking or bicycling, THE Emissions_Agent SHALL compute zero emissions for that segment
6. FOR ALL Transit_Modes and positive distances, THE Emissions_Agent SHALL produce non-negative emission values

---

### Requirement 4: Cost Computation

**User Story:** As a user, I want to see the estimated monetary cost of each route option, so that I can factor price into my decision.

#### Acceptance Criteria

1. THE Emissions_Agent SHALL compute per-segment cost as the product of the segment distance in kilometers and the Cost_Factor per-kilometer rate for that segment's Transit_Mode
2. THE Emissions_Agent SHALL add the Cost_Factor base fare exactly once per Route_Option for the primary Transit_Mode
3. THE Emissions_Agent SHALL attach the Cost_Factor source provenance string to each Route_Option
4. WHEN the Transit_Mode is walking or bicycling, THE Emissions_Agent SHALL compute zero cost for that segment
5. FOR ALL Transit_Modes and positive distances, THE Emissions_Agent SHALL produce non-negative cost values

---

### Requirement 5: Route Ranking and Comparison

**User Story:** As a user, I want routes ranked by carbon impact with the greenest, fastest, and cheapest options highlighted, so that I can quickly identify the best option for my priorities.

#### Acceptance Criteria

1. THE Route_Planner SHALL sort all Route_Options by total emissions in ascending order
2. THE Route_Planner SHALL identify the greenest Route_Option as the one with the lowest total_emissions_g among all options
3. THE Route_Planner SHALL identify the fastest Route_Option as the one with the lowest total_duration_min among all options
4. THE Route_Planner SHALL identify the cheapest Route_Option as the one with the lowest total_cost_usd among all options
5. WHEN a driving Route_Option exists, THE Route_Planner SHALL compute savings_vs_driving_kg as the difference between driving emissions and greenest option emissions divided by 1000
6. WHEN no driving Route_Option exists, THE Route_Planner SHALL set savings_vs_driving_kg to null

---

### Requirement 6: Decision Agent Constraint-Based Evaluation

**User Story:** As a user, I want to specify constraints like "arrive by 10 AM" or "spend under $5", so that the system recommends routes that fit my real-world needs.

#### Acceptance Criteria

1. WHEN a User_Constraint specifying an arrival deadline is provided, THE Decision_Agent SHALL exclude all Route_Options whose total duration exceeds the available time window
2. WHEN a User_Constraint specifying a maximum cost is provided, THE Decision_Agent SHALL exclude all Route_Options whose total cost exceeds the specified maximum
3. WHEN a User_Constraint specifying preferred Transit_Modes is provided, THE Decision_Agent SHALL prioritize Route_Options using those modes in the ranking
4. WHEN multiple User_Constraints are provided, THE Decision_Agent SHALL apply all constraints conjunctively, excluding options that violate any single constraint
5. IF no Route_Options satisfy all User_Constraints, THEN THE Decision_Agent SHALL return the closest viable options with an explanation of which constraints could not be met
6. THE Decision_Agent SHALL rank remaining Route_Options by a weighted score combining emissions, duration, and cost based on user preference weights

---

### Requirement 7: Tradeoff Analysis and Natural Language Justification

**User Story:** As a user, I want the system to explain tradeoffs between route options in plain language, so that I understand why a particular route is recommended.

#### Acceptance Criteria

1. THE Decision_Agent SHALL generate a Tradeoff_Summary for each pair of the top-ranked Route_Option and every alternative Route_Option
2. WHEN comparing two Route_Options, THE Decision_Agent SHALL compute the difference in emissions (kg CO2e), duration (minutes), and cost (USD)
3. THE Decision_Agent SHALL produce a natural language justification string for the recommended Route_Option that references specific tradeoff values
4. WHEN the recommended route has higher duration than an alternative, THE Decision_Agent SHALL include the time penalty in the justification (e.g., "saves 3.2 kg CO2 for a 4-minute longer trip")
5. THE Decision_Agent SHALL ensure every justification string is non-empty and contains at least one quantified tradeoff value

---

### Requirement 8: Multi-Agent Pipeline Orchestration

**User Story:** As a developer, I want the routing, emissions, and decision agents to operate as a coordinated pipeline, so that each agent's output feeds cleanly into the next.

#### Acceptance Criteria

1. THE Route_Planner SHALL execute the pipeline in order: Routing_Agent, then Emissions_Agent, then Decision_Agent
2. THE Emissions_Agent SHALL produce exactly one Route_Option for each Raw_Route_Result received from the Routing_Agent
3. THE Decision_Agent SHALL receive all Route_Options produced by the Emissions_Agent without data loss
4. IF the Routing_Agent returns an empty list of routes, THEN THE Route_Planner SHALL return an empty Route_Comparison with a descriptive message
5. IF the Emissions_Agent encounters an unknown Transit_Mode in a segment, THEN THE Emissions_Agent SHALL fall back to walking emission factors for that segment

---

### Requirement 9: Calendar Integration via OAuth

**User Story:** As a user, I want to connect my Google Calendar or Outlook calendar, so that the system can read my schedule and plan routes around my events.

#### Acceptance Criteria

1. WHEN a user initiates calendar connection, THE Route_Planner SHALL redirect the user to the OAuth 2.0 authorization endpoint for the selected calendar provider (Google Calendar or Microsoft Outlook)
2. WHEN the OAuth callback is received with a valid authorization code, THE Route_Planner SHALL exchange the code for access and refresh tokens
3. THE Route_Planner SHALL store OAuth tokens securely and associate them with the user session
4. WHEN an access token expires, THE Route_Planner SHALL use the refresh token to obtain a new access token without requiring user re-authorization
5. IF the OAuth authorization is denied or fails, THEN THE Route_Planner SHALL return a descriptive error message to the user
6. THE Route_Planner SHALL request only the minimum calendar read scope required to fetch event data

---

### Requirement 10: Calendar Event Ingestion

**User Story:** As a user, I want the system to read my day's events including times and locations, so that it can plan routes between them.

#### Acceptance Criteria

1. WHEN a user requests schedule optimization for a specific date, THE Schedule_Agent SHALL fetch all Calendar_Events for that date from the connected calendar provider
2. THE Schedule_Agent SHALL parse each Calendar_Event into a structured representation containing: event title, start time, end time, and location
3. WHEN a Calendar_Event has no location field, THE Schedule_Agent SHALL exclude that event from route planning and note the exclusion
4. THE Schedule_Agent SHALL sort Calendar_Events by start time in ascending order
5. IF the calendar API returns an error or empty response, THEN THE Schedule_Agent SHALL return a descriptive error indicating no events were found or the calendar is unreachable

---

### Requirement 11: Inter-Event Gap Detection and Route Optimization

**User Story:** As a user, I want the system to detect gaps between my events and suggest optimal sustainable routes for each transition, so that I can minimize my carbon footprint across my entire day.

#### Acceptance Criteria

1. THE Schedule_Agent SHALL compute Inter_Event_Gaps as the time between the end of one Calendar_Event and the start of the next Calendar_Event
2. WHEN an Inter_Event_Gap is detected and both adjacent events have locations, THE Schedule_Agent SHALL invoke the multi-agent pipeline (Routing_Agent, Emissions_Agent, Decision_Agent) for that origin-destination pair
3. THE Schedule_Agent SHALL apply an implicit arrival deadline User_Constraint equal to the start time of the next Calendar_Event for each Inter_Event_Gap route
4. WHEN an Inter_Event_Gap is shorter than 5 minutes, THE Schedule_Agent SHALL flag the transition as infeasible and skip route planning for that gap
5. THE Schedule_Agent SHALL aggregate total emissions across all Inter_Event_Gap routes to produce a full-day carbon footprint estimate
6. THE Schedule_Agent SHALL return a complete Itinerary containing all Calendar_Events and recommended routes for each Inter_Event_Gap

---

### Requirement 12: Itinerary-Level Optimization

**User Story:** As a user, I want the system to optimize my entire day's travel holistically rather than gap-by-gap, so that globally better combinations are considered.

#### Acceptance Criteria

1. WHEN optimizing a full-day Itinerary, THE Schedule_Agent SHALL consider the cumulative effect of mode choices across all Inter_Event_Gaps
2. THE Schedule_Agent SHALL prefer mode consistency where practical (e.g., if a user drives to event A, the car is available for event B) and note mode-switching costs
3. WHEN a user specifies a daily carbon budget, THE Schedule_Agent SHALL distribute the budget across Inter_Event_Gaps and flag transitions that would exceed the remaining budget
4. THE Schedule_Agent SHALL provide a summary comparing the optimized Itinerary total emissions against an all-driving baseline

---

### Requirement 13: API Endpoint for Route Planning

**User Story:** As a frontend developer, I want a well-structured API endpoint for route planning, so that I can build the route comparison interface.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a POST /api/v1/plan-route endpoint that accepts a JSON body containing origin, destination, and optional modes list
2. WHEN a valid RouteRequest is received, THE Route_Planner SHALL return a RouteComparison JSON response containing all Route_Options sorted by emissions
3. THE Route_Planner SHALL validate that origin and destination are non-empty strings
4. IF origin or destination is missing or empty, THEN THE Route_Planner SHALL return HTTP 422 with a descriptive validation error

---

### Requirement 14: API Endpoint for Constrained Route Planning

**User Story:** As a frontend developer, I want an API endpoint that accepts user constraints, so that I can build the agentic recommendation interface.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a POST /api/v1/plan-route-constrained endpoint that accepts origin, destination, optional modes, and a list of User_Constraints
2. WHEN User_Constraints include an arrival_by timestamp, THE Route_Planner SHALL pass the constraint to the Decision_Agent for filtering
3. WHEN User_Constraints include a max_cost value, THE Route_Planner SHALL pass the constraint to the Decision_Agent for filtering
4. THE Route_Planner SHALL return a response containing ranked Route_Options, the recommended Route_Option, and a natural language justification string
5. IF no constraints are provided, THEN THE Route_Planner SHALL behave identically to the unconstrained plan-route endpoint

---

### Requirement 15: API Endpoint for Schedule Optimization

**User Story:** As a frontend developer, I want an API endpoint for full-day schedule optimization, so that I can build the itinerary planner interface.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a POST /api/v1/optimize-schedule endpoint that accepts a date and optional daily carbon budget
2. WHEN a valid request is received and the user has a connected calendar, THE Route_Planner SHALL return a complete Itinerary with routes for each Inter_Event_Gap
3. IF the user has no connected calendar, THEN THE Route_Planner SHALL return HTTP 401 with a message directing the user to connect a calendar
4. THE Route_Planner SHALL include per-gap and total-day emissions summaries in the response

---

### Requirement 16: API Endpoint for Visualization Data

**User Story:** As a frontend developer, I want API endpoints that return data formatted for charts and visualizations, so that I can build the emissions comparison dashboard.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a GET /api/v1/emission-factors endpoint that returns all Emission_Factors with their source provenance
2. THE Route_Planner SHALL expose a GET /api/v1/cost-factors endpoint that returns all Cost_Factors with their source provenance
3. WHEN a Route_Comparison is returned from any planning endpoint, THE Route_Planner SHALL include per-mode emissions, cost, and duration values suitable for bar chart rendering
4. THE Route_Planner SHALL include the savings_vs_driving_kg metric in every Route_Comparison response that contains a driving option

---

### Requirement 17: Health Check and System Status

**User Story:** As a developer, I want a health check endpoint that reports system status and configuration, so that I can monitor the backend.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a GET /api/v1/health endpoint that returns HTTP 200 with status "ok"
2. THE Route_Planner SHALL include the current routing_mode (mock or live) in the health response
3. THE Route_Planner SHALL include the application version in the health response

---

### Requirement 18: Input Validation and Error Handling

**User Story:** As a user, I want clear error messages when I provide invalid input, so that I can correct my request.

#### Acceptance Criteria

1. WHEN a request body fails Pydantic validation, THE Route_Planner SHALL return HTTP 422 with a JSON body describing each validation error including field name and reason
2. WHEN an unsupported Transit_Mode value is provided, THE Route_Planner SHALL return HTTP 422 with the list of valid Transit_Mode values
3. IF an internal error occurs during route computation, THEN THE Route_Planner SHALL return HTTP 500 with a generic error message and log the full error details server-side
4. THE Route_Planner SHALL not expose internal stack traces or implementation details in error responses

---

### Requirement 19: Emission Factor Data Integrity

**User Story:** As a developer, I want emission and cost factors to be complete and well-sourced, so that the system produces trustworthy results.

#### Acceptance Criteria

1. THE Route_Planner SHALL define an Emission_Factor for every Transit_Mode in the TransitMode enum
2. THE Route_Planner SHALL define a Cost_Factor for every Transit_Mode in the TransitMode enum
3. THE Route_Planner SHALL ensure every Emission_Factor has a non-empty source provenance string
4. THE Route_Planner SHALL ensure every Cost_Factor has a non-empty source provenance string
5. THE Route_Planner SHALL ensure all Emission_Factor g_co2e_per_pkm values are non-negative
6. THE Route_Planner SHALL ensure all Cost_Factor per_km_cost and base_fare values are non-negative

---

### Requirement 20: CORS and Security Configuration

**User Story:** As a developer, I want the backend to handle cross-origin requests securely, so that the frontend can communicate with the API.

#### Acceptance Criteria

1. THE Route_Planner SHALL enable CORS middleware with configurable allowed origins
2. THE Route_Planner SHALL read allowed origins from the cors_origins configuration setting
3. THE Route_Planner SHALL not expose the Google Maps API key in any API response
4. WHEN OAuth tokens are stored, THE Route_Planner SHALL encrypt tokens at rest and transmit them only over HTTPS
