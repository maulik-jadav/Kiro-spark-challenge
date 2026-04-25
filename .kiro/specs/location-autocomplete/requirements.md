# Requirements Document

## Introduction

This feature replaces all plain-text location inputs across the PathProject frontend with Google Maps Places Autocomplete, providing real address suggestions as users type. It also removes the mock routing mode entirely from both the backend configuration and the maps client, ensuring the application always uses live Google Maps data for route computation.

The affected location inputs are:
- **Origin** and **Destination** fields in the TripForm component (main search page)
- **Home Address** field in the Plan Day page

## Glossary

- **Autocomplete_Input**: A text input component that queries the Google Places Autocomplete API and displays a dropdown of matching place suggestions as the user types.
- **Places_Library**: The Google Maps JavaScript API Places library (`google.maps.places`), loaded via the existing `@vis.gl/react-google-maps` API provider or a script tag, providing access to the Autocomplete service.
- **Place_Suggestion**: A single result returned by the Places Autocomplete service, containing a formatted address and a place ID.
- **TripForm**: The React component (`frontend/src/components/TripForm.tsx`) containing origin and destination inputs for route planning.
- **PlanDay_Page**: The React page (`frontend/src/app/plan-day/page.tsx`) containing the home address input for day planning.
- **Maps_Client**: The backend Python module (`backend/services/maps_client.py`) responsible for fetching route data from Google Maps or generating mock routes.
- **Settings**: The backend configuration class (`backend/core/config.py`) that holds environment variables including `routing_mode`.
- **Mock_Mode**: The current `routing_mode=mock` configuration that causes the Maps_Client to return synthetic route data instead of calling the Google Maps Routes API.

## Requirements

### Requirement 1: Autocomplete Input Component

**User Story:** As a user, I want location input fields to suggest real addresses as I type, so that I can quickly select accurate locations without typing full addresses.

#### Acceptance Criteria

1. WHEN a user types at least 2 characters into the Autocomplete_Input, THE Autocomplete_Input SHALL query the Places_Library and display a dropdown list of Place_Suggestions.
2. WHEN the Places_Library returns Place_Suggestions, THE Autocomplete_Input SHALL display up to 5 suggestions in a dropdown below the input field.
3. WHEN a user selects a Place_Suggestion from the dropdown, THE Autocomplete_Input SHALL populate the input field with the formatted address from the selected Place_Suggestion.
4. WHEN a user selects a Place_Suggestion, THE Autocomplete_Input SHALL close the dropdown.
5. WHEN the user clears the input field, THE Autocomplete_Input SHALL clear the selected place data and close the dropdown.
6. IF the Places_Library returns zero results, THEN THE Autocomplete_Input SHALL display a "No results found" message in the dropdown.
7. IF the Places_Library request fails, THEN THE Autocomplete_Input SHALL allow the user to continue typing a manual address without blocking input.

### Requirement 2: TripForm Integration

**User Story:** As a user, I want the origin and destination fields on the main search page to use autocomplete, so that I can plan routes using real, validated addresses.

#### Acceptance Criteria

1. THE TripForm SHALL use the Autocomplete_Input component for both the origin and destination fields.
2. WHEN a user submits the TripForm, THE TripForm SHALL send the formatted address string from each Autocomplete_Input to the route planning API.
3. WHEN the TripForm loads, THE TripForm SHALL initialize both Autocomplete_Input fields in an empty state with placeholder text.

### Requirement 3: Plan Day Page Integration

**User Story:** As a user, I want the home address field on the Plan Day page to use autocomplete, so that I can enter my home address accurately for day planning.

#### Acceptance Criteria

1. THE PlanDay_Page SHALL use the Autocomplete_Input component for the home address field.
2. WHEN a user submits the Plan Day form, THE PlanDay_Page SHALL send the formatted address string from the Autocomplete_Input to the day planning API.

### Requirement 4: Remove Mock Routing Mode

**User Story:** As a developer, I want to remove the mock routing mode, so that the application always uses real Google Maps data and there is no synthetic data path in production.

#### Acceptance Criteria

1. THE Settings SHALL remove the `routing_mode` configuration field.
2. THE Maps_Client SHALL remove the `mock_route` function and all mock routing logic including `_deterministic_seed`, `_haversine_estimate`, `_MOCK_SPEEDS`, `_DETOUR`, and related helper functions.
3. THE Maps_Client `fetch_route` function SHALL call the Google Maps Routes API directly without a mock fallback path.
4. THE Maps_Client `fetch_all_routes` function SHALL remove the `routing_mode` parameter and call the live routing API for all requests.
5. IF the Google Maps Routes API call fails, THEN THE Maps_Client SHALL raise an error to the caller instead of falling back to mock data.
6. THE backend API routes SHALL remove all references to `routing_mode` when calling the orchestrator.
7. THE backend health endpoint SHALL remove `routing_mode` from the health response.

### Requirement 5: Google Maps API Key Validation

**User Story:** As a developer, I want the application to validate that a Google Maps API key is configured at startup, so that missing configuration is caught early rather than at request time.

#### Acceptance Criteria

1. WHEN the backend application starts, THE Settings SHALL validate that `google_maps_api_key` is a non-empty string.
2. IF `google_maps_api_key` is empty at startup, THEN THE backend application SHALL log a warning message indicating that the Google Maps API key is not configured.
3. WHEN the frontend loads the Autocomplete_Input, THE Autocomplete_Input SHALL check that the Google Maps API key environment variable is available.
4. IF the Google Maps API key is not available on the frontend, THEN THE Autocomplete_Input SHALL render as a standard text input without autocomplete functionality.

### Requirement 6: Accessibility of Autocomplete Input

**User Story:** As a user who relies on assistive technology, I want the autocomplete dropdown to be navigable with a keyboard, so that I can select location suggestions without a mouse.

#### Acceptance Criteria

1. THE Autocomplete_Input SHALL support keyboard navigation of the suggestion dropdown using the ArrowUp and ArrowDown keys.
2. WHEN a suggestion is highlighted via keyboard navigation, THE Autocomplete_Input SHALL visually indicate the highlighted suggestion.
3. WHEN the user presses Enter while a suggestion is highlighted, THE Autocomplete_Input SHALL select the highlighted suggestion.
4. WHEN the user presses Escape, THE Autocomplete_Input SHALL close the dropdown without selecting a suggestion.
5. THE Autocomplete_Input SHALL use ARIA attributes including `role="combobox"`, `aria-expanded`, `aria-activedescendant`, and `role="listbox"` on the dropdown to communicate state to screen readers.
