# Bugfix Requirements Document

## Introduction

The `TripForm` component's `handleSubmit` function in `frontend/src/components/TripForm.tsx` has two related defects stemming from an incomplete refactor that removed the mode-selection UI:

1. **`selectedModes` ReferenceError** — The original code referenced an undeclared `selectedModes` variable, causing an unhandled `ReferenceError` crash on form submission. This appears to have been partially patched (modes is now passed as `null`), but the fix introduced a second problem.
2. **Hardcoded priority** — The `priority` argument is hardcoded to `"best_tradeoff"` instead of using the component's `priority` state variable. The user can interact with the priority selector UI (Fastest / Greenest / Best Trade-off) but their selection is silently ignored on submit.

The `onSubmit` prop signature expects 5 arguments: `(origin, destination, modes, constraint, priority)`. The parent component `page.tsx` defines `handleSubmit` which passes `priority` through to the `planRoute` API call, so the hardcoded value means the backend always receives `"best_tradeoff"` regardless of user intent.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user fills in origin and destination and submits the form THEN the system passes a hardcoded `"best_tradeoff"` string as the `priority` argument to `onSubmit`, ignoring the `priority` state variable controlled by the priority selector UI.

1.2 WHEN the user selects "Fastest" or "Greenest" priority and submits the form THEN the system still sends `"best_tradeoff"` to the backend API, so the route recommendation does not reflect the user's chosen priority.

### Expected Behavior (Correct)

2.1 WHEN the user fills in origin and destination and submits the form THEN the system SHALL pass the current value of the `priority` state variable as the fifth argument to `onSubmit`.

2.2 WHEN the user selects "Fastest" or "Greenest" priority and submits the form THEN the system SHALL send the selected priority value (`"fastest"`, `"greenest"`, or `"best_tradeoff"`) to the backend API so the route recommendation reflects the user's choice.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user submits the form without filling in origin THEN the system SHALL CONTINUE TO display the "Origin is required." validation error and prevent submission.

3.2 WHEN the user submits the form without filling in destination THEN the system SHALL CONTINUE TO display the "Destination is required." validation error and prevent submission.

3.3 WHEN no mode-selection UI is present in the form THEN the system SHALL CONTINUE TO pass `null` as the `modes` argument to `onSubmit`, indicating all modes should be considered.

3.4 WHEN the user enters a constraint and submits the form THEN the system SHALL CONTINUE TO pass the trimmed constraint string (or `null` if empty) as the fourth argument to `onSubmit`.

3.5 WHEN the user does not change the priority selector THEN the system SHALL CONTINUE TO default to `"best_tradeoff"` as the priority value.
