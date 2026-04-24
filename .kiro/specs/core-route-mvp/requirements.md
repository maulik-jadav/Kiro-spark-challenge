# Requirements: Core Data & Single-Route MVP (Phase 1.1)

## Introduction

This phase establishes the foundational route planning engine for PathProject. It covers multi-modal route fetching, multi-segment route composition, emissions and cost computation, route ranking, input validation, emission factor data integrity, health monitoring, CORS/security configuration, and the core `/plan-route` API endpoint. The goal is a working static function: `f(route, mode) -> (time, carbon_cost, monetary_cost)`.

## Glossary

- **Route_Planner**: The PathProject backend system responsible for computing, analyzing, and recommending routes
- **Routing_Agent**: The agent responsible for fetching all possible paths and transit modes between two points
- **Emissions_Agent**: The agent responsible for computing carbon cost (g CO2e) for each route option using EPA/IPCC/FTA emission factors
- **Maps_Client**: The service layer that interfaces with Google Maps Routes API or returns mock routing data
- **Emission_Factor**: A data record containing grams CO2-equivalent per passenger-kilometer for a specific transit mode, with source provenance
- **Cost_Factor**: A data record containing base fare (USD) and per-kilometer cost for a specific transit mode, with source provenance
- **Transit_Mode**: One of the 11 supported transportation modes: driving, carpool_2, carpool_4, bus, light_rail, subway, commuter_rail, walking, bicycling, e_scooter, rideshare
- **Route_Option**: A complete route from origin to destination via a specific primary transit mode, containing one or more segments
- **Route_Segment**: A single leg within a route (e.g., walk to station, ride light rail, walk to destination)
- **Route_Comparison**: The full response containing all evaluated route options with rankings and savings metrics
- **Raw_Route_Result**: The intermediate data structure returned by the Maps_Client before emissions analysis

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

### Requirement 6: API Endpoint for Route Planning

**User Story:** As a frontend developer, I want a well-structured API endpoint for route planning, so that I can build the route comparison interface.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a POST /api/v1/plan-route endpoint that accepts a JSON body containing origin, destination, and optional modes list
2. WHEN a valid RouteRequest is received, THE Route_Planner SHALL return a RouteComparison JSON response containing all Route_Options sorted by emissions
3. THE Route_Planner SHALL validate that origin and destination are non-empty strings
4. IF origin or destination is missing or empty, THEN THE Route_Planner SHALL return HTTP 422 with a descriptive validation error

---

### Requirement 7: Health Check and System Status

**User Story:** As a developer, I want a health check endpoint that reports system status and configuration, so that I can monitor the backend.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a GET /api/v1/health endpoint that returns HTTP 200 with status "ok"
2. THE Route_Planner SHALL include the current routing_mode (mock or live) in the health response
3. THE Route_Planner SHALL include the application version in the health response

---

### Requirement 8: Input Validation and Error Handling

**User Story:** As a user, I want clear error messages when I provide invalid input, so that I can correct my request.

#### Acceptance Criteria

1. WHEN a request body fails Pydantic validation, THE Route_Planner SHALL return HTTP 422 with a JSON body describing each validation error including field name and reason
2. WHEN an unsupported Transit_Mode value is provided, THE Route_Planner SHALL return HTTP 422 with the list of valid Transit_Mode values
3. IF an internal error occurs during route computation, THEN THE Route_Planner SHALL return HTTP 500 with a generic error message and log the full error details server-side
4. THE Route_Planner SHALL not expose internal stack traces or implementation details in error responses

---

### Requirement 9: Emission Factor Data Integrity

**User Story:** As a developer, I want emission and cost factors to be complete and well-sourced, so that the system produces trustworthy results.

#### Acceptance Criteria

1. THE Route_Planner SHALL define an Emission_Factor for every Transit_Mode in the TransitMode enum
2. THE Route_Planner SHALL define a Cost_Factor for every Transit_Mode in the TransitMode enum
3. THE Route_Planner SHALL ensure every Emission_Factor has a non-empty source provenance string
4. THE Route_Planner SHALL ensure every Cost_Factor has a non-empty source provenance string
5. THE Route_Planner SHALL ensure all Emission_Factor g_co2e_per_pkm values are non-negative
6. THE Route_Planner SHALL ensure all Cost_Factor per_km_cost and base_fare values are non-negative

---

### Requirement 10: CORS and Security Configuration

**User Story:** As a developer, I want the backend to handle cross-origin requests securely, so that the frontend can communicate with the API.

#### Acceptance Criteria

1. THE Route_Planner SHALL enable CORS middleware with configurable allowed origins
2. THE Route_Planner SHALL read allowed origins from the cors_origins configuration setting
3. THE Route_Planner SHALL not expose the Google Maps API key in any API response

---

### Requirement 11: API Endpoint for Visualization Data

**User Story:** As a frontend developer, I want API endpoints that return data formatted for charts and visualizations, so that I can build the emissions comparison dashboard.

#### Acceptance Criteria

1. THE Route_Planner SHALL expose a GET /api/v1/emission-factors endpoint that returns all Emission_Factors with their source provenance
2. THE Route_Planner SHALL expose a GET /api/v1/cost-factors endpoint that returns all Cost_Factors with their source provenance
3. WHEN a Route_Comparison is returned from any planning endpoint, THE Route_Planner SHALL include per-mode emissions, cost, and duration values suitable for bar chart rendering
4. THE Route_Planner SHALL include the savings_vs_driving_kg metric in every Route_Comparison response that contains a driving option
