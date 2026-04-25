# Route Path Not Drawing on Map — Bugfix Design

## Overview

The PathFinder application calculates multi-modal route options with emissions, cost, and duration data, but never draws the actual route paths on the map. Users see only origin (A) and destination (B) markers. The bug spans the full stack: the backend never requests polyline data from the Google Maps Routes API, has no schema fields to carry it, and the frontend `MapView` component has no polyline rendering logic.

The fix adds `routes.polyline.encodedPolyline` to the API field mask, threads the encoded polyline string through `RawRouteResult` → `RouteOption` → `RouteComparison` → frontend, and renders decoded polylines on the map for the three best-category routes (greenest, cheapest, fastest) with distinct colors.

## Glossary

- **Bug_Condition (C)**: A route is calculated successfully but no polyline path is drawn on the map — the backend omits polyline data from the Google Maps API request and has no field to store or transmit it, and the frontend has no logic to render it
- **Property (P)**: When routes are calculated, the map SHALL display decoded polyline paths for the greenest, cheapest, and fastest category routes with distinct colors
- **Preservation**: All existing route calculation data (distance, duration, emissions, cost), marker rendering, route card display, badge logic, and fallback behaviors must remain unchanged
- **`RawRouteResult`**: Dataclass in `backend/services/maps_client.py` that holds raw route data from the Google Maps API
- **`RouteOption`**: Pydantic model in `backend/models/schemas.py` that represents a fully analyzed route option returned to the frontend
- **`RouteComparison`**: Pydantic model containing all route options plus `greenest`, `fastest`, `cheapest` references
- **`MapView`**: React component in `frontend/src/components/MapView.tsx` that renders the Google Map with markers
- **Encoded Polyline**: A string encoding of a series of lat/lng coordinates using Google's [Encoded Polyline Algorithm](https://developers.google.com/maps/documentation/utilities/polylinealgorithm)

## Bug Details

### Bug Condition

The bug manifests whenever a user calculates routes between an origin and destination. The backend requests route data from the Google Maps Routes API with a field mask of `routes.distanceMeters,routes.staticDuration`, which excludes polyline geometry. Even if the API were to return polyline data, `RawRouteResult` has no `polyline` field to store it, `RouteOption` has no field to serialize it, and `MapView` has no rendering logic for it. The result is a map that shows only point markers with no route paths.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type RouteCalculationRequest (origin, destination, modes)
  OUTPUT: boolean

  rawRoutes := callGoogleMapsAPI(input.origin, input.destination, input.modes)
  routeComparison := processRoutes(rawRoutes)

  RETURN routeComparison.greenest IS NOT NULL
         OR routeComparison.fastest IS NOT NULL
         OR routeComparison.cheapest IS NOT NULL
  // i.e., at least one route was successfully calculated,
  // but no polyline data exists anywhere in the pipeline
END FUNCTION
```

### Examples

- **Example 1**: User calculates routes from "San Francisco, CA" to "Los Angeles, CA". The results panel shows 5 route options with durations, distances, emissions, and costs. The map shows marker A at SF and marker B at LA, but no path is drawn between them. **Expected**: A green polyline for the greenest route, an orange polyline for the fastest, and a blue polyline for the cheapest should be visible on the map.

- **Example 2**: User calculates routes where the greenest and cheapest route are the same (e.g., walking). The map shows only markers. **Expected**: Both a green polyline (greenest) and a blue polyline (cheapest) should render on the same path, with the topmost one visible.

- **Example 3**: User calculates routes from "New York, NY" to "Boston, MA". Driving is fastest, subway is greenest, bus is cheapest. The map shows only markers. **Expected**: Three distinct polylines in orange (fastest/driving), green (greenest/subway), and blue (cheapest/bus) should be drawn on the map.

- **Edge case**: User calculates routes but only one mode is available (e.g., driving only). That single route is simultaneously greenest, fastest, and cheapest. **Expected**: All three colored polylines render on the same path.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Route calculation must continue to return correct distance, duration, emissions, and cost data for each `RouteOption`
- Origin (A) and destination (B) markers must continue to display at correct geocoded positions
- Route cards in `ResultsPanel` must continue to show mode, duration, distance, emissions, cost, and expandable segments
- Greenest, fastest, and cheapest badge logic must continue to work correctly
- Default map view (no markers, no paths) must display when no routes have been calculated
- "Map unavailable" fallback must display when the Google Maps API key is not configured
- The `AgentReasoning` response must continue to work unchanged
- The day-planning pipeline (`plan_day`) must continue to function correctly

**Scope:**
All inputs that do NOT involve polyline rendering should be completely unaffected by this fix. This includes:
- All existing `RouteOption` fields (mode, segments, distances, durations, emissions, costs, sources)
- All existing `RouteComparison` fields (options list, greenest/fastest/cheapest references, savings, reasoning)
- All existing API endpoint behavior (`/plan-route`, `/plan-day`, `/health`)
- All existing frontend components (`TripForm`, `ResultsPanel`, `RouteCard`, `ReasoningPanel`)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing Field Mask Entry**: In `backend/services/maps_client.py`, the `X-Goog-FieldMask` header is set to `"routes.distanceMeters,routes.staticDuration"`. This tells the Google Maps Routes API to return only distance and duration — polyline data is never requested.
   - Line: `"X-Goog-FieldMask": "routes.distanceMeters,routes.staticDuration"`
   - Fix: Add `routes.polyline.encodedPolyline` to the field mask

2. **Missing Data Model Fields**: `RawRouteResult` (dataclass) and `RouteOption` (Pydantic model) have no `polyline` field, so there is no way to store or transmit polyline data through the pipeline.
   - `RawRouteResult` in `backend/services/maps_client.py` — needs an optional `polyline: str | None` field
   - `RouteOption` in `backend/models/schemas.py` — needs an optional `polyline: str | None` field

3. **Missing Polyline Extraction**: The `live_route` function in `maps_client.py` parses `distanceMeters` and `staticDuration` from the API response but never reads `polyline.encodedPolyline`.

4. **Missing Polyline Pass-Through**: The `analyze_route` function in `emissions_agent.py` creates `RouteOption` objects from `RawRouteResult` but does not pass through any polyline data (because neither model has the field).

5. **Missing Frontend Props**: `page.tsx` passes only `origin` and `destination` strings to `MapView`. The `RouteComparison` result (which would contain polylines after the backend fix) is not passed to the map component.

6. **Missing Frontend Rendering**: `MapView.tsx` accepts only `origin` and `destination` props and renders only `GeocodedMarker` components. There is no polyline decoding or rendering logic.

## Correctness Properties

Property 1: Bug Condition — Polyline Data Flows Through Pipeline

_For any_ route calculation request where the Google Maps Routes API returns a valid route with polyline data, the fixed pipeline SHALL extract the encoded polyline string and include it in the `RouteOption` response, making it available to the frontend for rendering.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition — Polylines Render on Map

_For any_ `RouteComparison` result where `greenest`, `fastest`, or `cheapest` routes have non-null polyline data, the fixed `MapView` component SHALL decode and render polyline paths on the map with distinct colors: green (`#16a34a`) for greenest, blue (`#2563eb`) for cheapest, and orange (`#ea580c`) for fastest.

**Validates: Requirements 2.5, 2.6, 2.7**

Property 3: Preservation — Route Calculation Data Unchanged

_For any_ route calculation request, the fixed pipeline SHALL produce identical `RouteOption` values for all existing fields (mode, segments, total_distance_km, total_duration_min, total_emissions_g, total_emissions_kg, total_cost_usd, emission_factor_source, cost_source) as the original pipeline, preserving all route analysis accuracy.

**Validates: Requirements 3.1, 3.3, 3.4**

Property 4: Preservation — Map Markers and Fallback Unchanged

_For any_ map rendering scenario, the fixed `MapView` component SHALL continue to display origin (A) and destination (B) markers at correct positions, show the default empty view when no routes are calculated, and show the "Map unavailable" fallback when no API key is configured.

**Validates: Requirements 3.2, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `backend/services/maps_client.py`

**Function**: `live_route`

**Specific Changes**:
1. **Add polyline to field mask**: Change the `X-Goog-FieldMask` header from `"routes.distanceMeters,routes.staticDuration"` to `"routes.distanceMeters,routes.staticDuration,routes.polyline.encodedPolyline"`
2. **Add polyline field to RawRouteResult**: Add `polyline: str | None = None` to the dataclass
3. **Extract polyline from response**: After parsing distance and duration, extract `route.get("polyline", {}).get("encodedPolyline")` and store it in the result

---

**File**: `backend/models/schemas.py`

**Model**: `RouteOption`

**Specific Changes**:
4. **Add polyline field**: Add `polyline: str | None = None` to the `RouteOption` Pydantic model so it serializes to the API response

---

**File**: `backend/agents/emissions_agent.py`

**Function**: `analyze_route`

**Specific Changes**:
5. **Pass polyline through**: When constructing the `RouteOption`, pass `polyline=raw.polyline` from the `RawRouteResult`

---

**File**: `frontend/src/types/api.ts`

**Interface**: `RouteOption`

**Specific Changes**:
6. **Add polyline field**: Add `polyline?: string | null` to the `RouteOption` TypeScript interface

---

**File**: `frontend/src/app/page.tsx`

**Component**: `Home`

**Specific Changes**:
7. **Pass RouteComparison to MapView**: Pass the `result` state (which is `RouteComparison | null`) to `MapView` as a new `routeComparison` prop

---

**File**: `frontend/src/components/MapView.tsx`

**Component**: `MapView`

**Specific Changes**:
8. **Accept routeComparison prop**: Add `routeComparison: RouteComparison | null` to `MapViewProps`
9. **Decode polylines**: Use `@googlemaps/polyline-codec` (or a manual implementation of the Google Encoded Polyline Algorithm) to decode encoded polyline strings into arrays of `{lat, lng}` coordinates
10. **Render category polylines**: For each of `greenest`, `cheapest`, `fastest` in the `RouteComparison`, if the route has a non-null `polyline`, render a `<Polyline>` (from `@vis.gl/react-google-maps` or a custom component using the Maps JavaScript API) with the decoded path and a distinct stroke color:
    - Greenest: `#16a34a` (green)
    - Cheapest: `#2563eb` (blue)
    - Fastest: `#ea580c` (orange)
11. **Handle overlapping routes**: Render all three polylines independently even if they reference the same route, so overlapping categories are all visible
12. **Polyline styling**: Use a stroke weight of ~4px and slight opacity (~0.8) so overlapping lines remain distinguishable

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that inspect the field mask sent to the Google Maps API, check for polyline fields in data models, and verify MapView rendering. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Field Mask Test**: Assert that the `X-Goog-FieldMask` header includes `routes.polyline.encodedPolyline` (will fail on unfixed code — confirms root cause #1)
2. **RawRouteResult Polyline Field Test**: Assert that `RawRouteResult` has a `polyline` attribute (will fail on unfixed code — confirms root cause #2)
3. **RouteOption Polyline Field Test**: Assert that `RouteOption` schema includes a `polyline` field (will fail on unfixed code — confirms root cause #2)
4. **Polyline Extraction Test**: Mock a Google Maps API response with polyline data and assert it is extracted (will fail on unfixed code — confirms root cause #3)
5. **MapView Polyline Rendering Test**: Provide route data with polylines to MapView and assert polyline elements are rendered (will fail on unfixed code — confirms root cause #6)

**Expected Counterexamples**:
- Field mask string does not contain "polyline"
- `RawRouteResult` and `RouteOption` have no `polyline` attribute
- Polyline data from API response is silently discarded
- MapView renders no polyline elements regardless of input

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (routes are calculated successfully), the fixed pipeline produces polyline data and the map renders it.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := planRoute_fixed(input.origin, input.destination, input.modes)
  ASSERT result.greenest.polyline IS NOT NULL OR result.greenest IS NULL
  ASSERT result.fastest.polyline IS NOT NULL OR result.fastest IS NULL
  ASSERT result.cheapest.polyline IS NOT NULL OR result.cheapest IS NULL
  // For each non-null category route with a polyline:
  ASSERT mapRendersPolyline(result.greenest, color="green")
  ASSERT mapRendersPolyline(result.cheapest, color="blue")
  ASSERT mapRendersPolyline(result.fastest, color="orange")
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (existing data fields and behaviors), the fixed code produces the same result as the original code.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT planRoute_original(input).options[i].total_distance_km
       = planRoute_fixed(input).options[i].total_distance_km
  ASSERT planRoute_original(input).options[i].total_duration_min
       = planRoute_fixed(input).options[i].total_duration_min
  ASSERT planRoute_original(input).options[i].total_emissions_g
       = planRoute_fixed(input).options[i].total_emissions_g
  ASSERT planRoute_original(input).options[i].total_cost_usd
       = planRoute_fixed(input).options[i].total_cost_usd
  // All existing fields are identical
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many `RawRouteResult` inputs with varying distances, durations, modes, and segment configurations
- It catches edge cases where the polyline addition might accidentally alter emissions or cost calculations
- It provides strong guarantees that `analyze_route` output is unchanged for all existing fields

**Test Plan**: Observe behavior on UNFIXED code first for route analysis, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Route Analysis Preservation**: Generate random `RawRouteResult` inputs and verify that `analyze_route` produces identical values for all existing `RouteOption` fields (distance, duration, emissions, cost, segments) regardless of whether a polyline is present
2. **Marker Rendering Preservation**: Verify that MapView continues to render origin/destination markers correctly when route data is provided
3. **Empty State Preservation**: Verify that MapView shows default view when no routes are calculated
4. **Fallback Preservation**: Verify that MapView shows "Map unavailable" when API key is missing

### Unit Tests

- Test that `live_route` includes `routes.polyline.encodedPolyline` in the field mask header
- Test that `live_route` extracts polyline from a mocked API response and stores it in `RawRouteResult.polyline`
- Test that `live_route` handles missing polyline gracefully (sets `polyline=None`)
- Test that `analyze_route` passes polyline from `RawRouteResult` to `RouteOption`
- Test that `RouteOption` serializes with `polyline` field in JSON output
- Test that `MapView` renders polyline paths when `routeComparison` prop has polyline data
- Test that `MapView` renders polylines with correct colors per category
- Test that `MapView` renders multiple polylines when routes overlap across categories

### Property-Based Tests

- Generate random `RawRouteResult` objects (varying mode, distance, duration, segments, polyline presence) and verify `analyze_route` produces correct existing field values — the polyline field should not affect emissions, cost, or duration calculations
- Generate random encoded polyline strings and verify the decode function produces valid lat/lng coordinate arrays with values in valid ranges (-90 to 90 for lat, -180 to 180 for lng)
- Generate random `RouteComparison` objects with varying polyline presence across greenest/cheapest/fastest and verify the MapView renders the correct number of polyline elements

### Integration Tests

- Test the full backend pipeline: mock Google Maps API response with polyline → verify `plan_route` returns `RouteComparison` with polylines on category routes
- Test the full frontend flow: provide a `RouteComparison` with polylines → verify MapView renders markers AND polylines simultaneously
- Test that the `/plan-route` API endpoint returns polyline data in the JSON response
