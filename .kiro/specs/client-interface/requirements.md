# Requirements: Client Interface (Phase 1.4)

## Introduction

This phase covers the frontend web application that makes the backend data digestible through clean visualizations, fluid animations, and a premium user experience. It is a multi-page React/Next.js application that abstracts the heavy backend computation behind route comparison cards, carbon charts, interactive maps, and an itinerary planner. This spec focuses on the backend API contracts and data formatting needed to support the frontend.

## Glossary

- **Route_Planner**: The PathProject backend system
- **Route_Card**: A UI component displaying a single route option with mode, time, cost, and emissions
- **Carbon_Chart**: A visualization component comparing emissions across route options
- **Map_View**: An interactive map component showing route polylines
- **Itinerary_View**: A timeline component showing a full day's events and optimized routes
- **Transit_Mode**: One of the 11 supported transportation modes

## Dependencies

- Requires Phase 1.1 (core-route-mvp) for basic route data.
- Requires Phase 1.2 (agentic-reasoning-layer) for constrained recommendations and justifications.
- Requires Phase 1.3 (schedule-orchestration) for itinerary data.

## Requirements

### Requirement 1: Route Comparison Data Contract

**User Story:** As a frontend developer, I want the route comparison API response to contain all data needed for Route_Cards, so that I can render comparisons without additional API calls.

#### Acceptance Criteria

1. EACH Route_Option in the Route_Comparison response SHALL include: mode, total_distance_km, total_duration_min, total_emissions_g, total_emissions_kg, total_cost_usd, emission_factor_source, and cost_source
2. EACH Route_Option SHALL include a segments array with per-segment mode, distance, duration, emissions, cost, and description
3. THE Route_Comparison SHALL include greenest, fastest, and cheapest Route_Option references for badge rendering
4. THE Route_Comparison SHALL include savings_vs_driving_kg when a driving option is present

---

### Requirement 2: Chart-Ready Emissions Data

**User Story:** As a frontend developer, I want emissions and cost data formatted for bar charts, so that I can render the Carbon_Chart without client-side transformation.

#### Acceptance Criteria

1. THE /api/v1/emission-factors endpoint SHALL return an array of objects each containing mode, g_co2e_per_pkm, and source
2. THE /api/v1/cost-factors endpoint SHALL return an array of objects each containing mode, base_fare, per_km_cost, and source
3. EACH Route_Option in a Route_Comparison SHALL include numeric fields (total_emissions_g, total_cost_usd, total_duration_min) directly usable as chart values

---

### Requirement 3: Constrained Recommendation Response

**User Story:** As a frontend developer, I want the constrained route planning response to include the recommendation and justification, so that I can render the explanation panel.

#### Acceptance Criteria

1. THE /api/v1/plan-route-constrained response SHALL include a recommended Route_Option field
2. THE response SHALL include a justification string containing natural language explanation with quantified tradeoffs
3. THE response SHALL include the full list of ranked Route_Options after constraint filtering
4. WHEN constraints eliminate all options, THE response SHALL include a fallback explanation describing which constraints could not be met

---

### Requirement 4: Itinerary Response for Timeline Rendering

**User Story:** As a frontend developer, I want the schedule optimization response structured for timeline rendering, so that I can build the Itinerary_View.

#### Acceptance Criteria

1. THE /api/v1/optimize-schedule response SHALL include an ordered array of Calendar_Events with title, start_time, end_time, and location
2. THE response SHALL include route recommendations between each pair of adjacent events with locations
3. THE response SHALL include per-gap emissions and a total-day emissions summary
4. WHEN a gap is flagged as infeasible, THE response SHALL include the gap with an infeasible flag and reason

---

### Requirement 5: Error Response Consistency

**User Story:** As a frontend developer, I want all API errors to follow a consistent format, so that I can build a single error handling layer.

#### Acceptance Criteria

1. ALL error responses SHALL include a JSON body with at minimum: status_code, message, and detail fields
2. HTTP 422 validation errors SHALL include a field-level errors array with field name and reason for each validation failure
3. HTTP 500 errors SHALL return a generic message without exposing internal details
4. ALL error responses SHALL use consistent field naming across all endpoints
