# Requirements: PathProject Frontend

## Introduction

PathProject is a commute itinerary planner that lets users compare route options across multiple transit modes, ranked by emissions, speed, cost, and a balanced score. The frontend is a React/Next.js single-page application that communicates with the existing FastAPI backend at `POST /api/v1/plan-route`.

---

## Requirements

### 1. Trip Input Form

**User Story**: As a user, I want to enter my origin, destination, and preferred transit modes so that I can get a route comparison.

#### Acceptance Criteria

- 1.1: The form MUST include an origin text field and a destination text field.
- 1.2: The form MUST include a multi-select control for transit modes, with options matching the backend's `TransitMode` enum: `driving`, `carpool_2`, `carpool_4`, `bus`, `light_rail`, `subway`, `commuter_rail`, `walking`, `bicycling`, `e_scooter`, `rideshare`.
- 1.3: When no modes are selected, the request MUST send `modes: null` so the backend evaluates all available modes.
- 1.4: The form MUST validate that both origin and destination are non-empty before submission.
- 1.5: The form MUST show a loading indicator while the backend request is in flight.
- 1.6: The form MUST display a user-friendly error message if the backend returns an error or the network request fails.

---

### 2. Route Comparison Display

**User Story**: As a user, I want to see all route options ranked and highlighted so that I can quickly identify the best option for my priority.

#### Acceptance Criteria

- 2.1: The results view MUST display all `options` returned in the `RouteComparison` response as individual route cards.
- 2.2: Each route card MUST show: transit mode, total distance (km), total duration (min), total emissions (kg CO₂), and total cost (USD).
- 2.3: The `greenest` option MUST be visually highlighted with a green badge/label.
- 2.4: The `fastest` option MUST be visually highlighted with a blue badge/label.
- 2.5: The `cheapest` option MUST be visually highlighted with a yellow/gold badge/label.
- 2.6: If `savings_vs_driving_kg` is present and positive, it MUST be displayed as a summary callout (e.g., "Save X kg CO₂ vs driving").
- 2.7: Route cards MUST be sorted by total emissions ascending (matching backend sort order).

---

### 3. Map Visualization

**User Story**: As a user, I want to see my origin and destination on a map so that I have geographic context for the route.

#### Acceptance Criteria

- 3.1: The app MUST embed a Google Maps JavaScript API map.
- 3.2: The map MUST display a marker for the origin and a marker for the destination after a successful route query.
- 3.3: The Google Maps API key MUST be read from the environment variable `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- 3.4: If the Google Maps API key is absent or the map fails to load, the app MUST still function (map section degrades gracefully with a fallback message).

---

### 4. Route Detail / Segment Breakdown

**User Story**: As a user, I want to expand a route card to see the individual segments so that I understand the full journey.

#### Acceptance Criteria

- 4.1: Each route card MUST be expandable to reveal its `segments` array.
- 4.2: Each segment row MUST show: mode, distance (km), duration (min), emissions (g CO₂), and cost (USD).
- 4.3: The expand/collapse interaction MUST be accessible via keyboard (Enter/Space) and mouse click.

---

### 5. Application Shell & Navigation

**User Story**: As a user, I want a clear, navigable interface so that I can use the app intuitively.

#### Acceptance Criteria

- 5.1: The app MUST display a header with the "PathProject" brand name.
- 5.2: The app MUST be responsive and usable on mobile viewports (≥ 320 px wide).
- 5.3: The app MUST use a consistent color scheme that visually distinguishes the three highlight categories (green = greenest, blue = fastest, yellow = cheapest).
- 5.4: The app MUST be a Next.js project bootstrapped with `create-next-app`, located in a `frontend/` directory at the workspace root.
- 5.5: The app MUST proxy API calls to `http://localhost:8000/api/v1` via Next.js `rewrites` so the frontend never hard-codes the backend URL.
