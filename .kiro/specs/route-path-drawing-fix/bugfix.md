# Bugfix Requirements Document

## Introduction

When a user clicks "Calculate Routes" in the PathFinder application, routes are successfully calculated and displayed in the results panel (distances, durations, emissions, costs), but no polyline/path is drawn on the map. The map only shows origin (A) and destination (B) markers. This defeats the core purpose of a route-planning map view — users cannot visually see the route they would take. The bug spans the full stack: the backend never extracts polyline data from the Google Maps Routes API response, the API response models have no field for polyline data, and the frontend MapView component has no logic to render route paths.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user calculates routes THEN the backend requests route data from Google Maps Routes API with a field mask limited to `routes.distanceMeters,routes.staticDuration`, omitting polyline data entirely

1.2 WHEN the backend receives a Google Maps Routes API response containing encoded polyline data THEN the system discards the polyline because `RawRouteResult` has no field to store it and the parsing logic does not extract it

1.3 WHEN the backend constructs a `RouteOption` response THEN the system returns route options without any polyline or path coordinate data because the `RouteOption` schema has no polyline field

1.4 WHEN the frontend receives a `RouteComparison` response after route calculation THEN the system does not pass any route path data to the `MapView` component because no such data exists in the response

1.5 WHEN the `MapView` component renders after routes are calculated THEN the system only displays origin and destination markers (A and B pins) with no polyline or path drawn between them

### Expected Behavior (Correct)

2.1 WHEN a user calculates routes THEN the backend SHALL request polyline data from the Google Maps Routes API by including `routes.polyline.encodedPolyline` in the `X-Goog-FieldMask` header

2.2 WHEN the backend receives a Google Maps Routes API response containing encoded polyline data THEN the system SHALL extract and store the encoded polyline string in the route result

2.3 WHEN the backend constructs a `RouteOption` response THEN the system SHALL include the encoded polyline string in the response so it is available to the frontend

2.4 WHEN the frontend receives a `RouteComparison` response containing polyline data THEN the system SHALL pass the route path data to the `MapView` component for rendering

2.5 WHEN the `MapView` component receives route polyline data THEN the system SHALL decode and render polylines on the map for the best route options in each category: greenest (lowest emissions), cheapest (lowest cost), and fastest (shortest duration)

2.6 WHEN the map renders category polylines THEN each category SHALL be visually distinguishable using distinct colors (e.g., green for greenest, blue for cheapest, orange for fastest) so the user can identify which path corresponds to which category

2.7 WHEN multiple category polylines overlap (e.g., the same route is both greenest and cheapest) THEN the system SHALL render all applicable polylines, with the topmost line still clearly visible

### Unchanged Behavior (Regression Prevention)

3.1 WHEN routes are calculated THEN the system SHALL CONTINUE TO return correct distance, duration, emissions, and cost data for each route option

3.2 WHEN routes are calculated THEN the system SHALL CONTINUE TO display origin (A) and destination (B) markers on the map at the correct geocoded positions

3.3 WHEN routes are calculated THEN the system SHALL CONTINUE TO display route cards in the ResultsPanel with mode, duration, distance, emissions, cost, and expandable segments

3.4 WHEN routes are calculated THEN the system SHALL CONTINUE TO identify and badge the greenest, fastest, and cheapest route options

3.5 WHEN no routes have been calculated yet THEN the system SHALL CONTINUE TO show the default map view with no markers and no paths

3.6 WHEN the Google Maps API key is not configured THEN the system SHALL CONTINUE TO show the "Map unavailable" fallback message
