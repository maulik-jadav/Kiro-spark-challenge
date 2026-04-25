# Requirements Document

## Introduction

Replace the current route recommendation system (Greenest, Cheapest, Fastest) with a priority-based recommendation engine. The new system introduces three priorities — Fastest, Greenest, and Best Trade-off — and removes Cheapest as a top-level priority. Routes are scored using min-max normalization, configurable weight vectors, Pareto filtering for dominated routes, and practicality penalties for walking and bicycling on long trips. Scoring is fully deterministic and testable; the LLM may generate natural-language explanations but does not influence route selection.

## Glossary

- **Scoring_Engine**: The backend module that computes practicality penalties, performs Pareto filtering, normalizes metrics, calculates weighted scores, and selects the recommended route for a given priority.
- **Priority_Selector**: The frontend UI component that allows the user to choose between FASTEST, GREENEST, and BEST_TRADEOFF priorities.
- **Candidate_Route**: A single route option from origin to destination via a specific transit mode, enriched with scoring metadata (normalizedDuration, normalizedEmissions, normalizedCost, practicalityPenalty, finalScore, isDominated, explanationReason).
- **Priority**: One of three recommendation strategies: FASTEST, GREENEST, or BEST_TRADEOFF.
- **Practicality_Penalty**: A soft numeric penalty (0.0–1.0) applied to walking and bicycling routes when distance or duration exceeds comfortable thresholds, or when duration is disproportionately long relative to the fastest route.
- **Pareto_Filter**: A module that marks a Candidate_Route as dominated when another Candidate_Route is at least as good on all scored dimensions (duration, emissions, cost) and strictly better on at least one.
- **Normalizer**: A module that applies min-max normalization to duration, emissions, and cost across all Candidate_Routes, producing values in the range [0, 1].
- **Weight_Vector**: A set of four weights (duration, emissions, cost, practicality) that sum to 1.0, used to compute the finalScore for a given Priority.
- **Explanation_Generator**: A module that produces a deterministic, human-readable explanationReason string for the recommended Candidate_Route based on the selected Priority and scoring data.

## Requirements

### Requirement 1: Priority Options

**User Story:** As a user, I want to choose between Fastest, Greenest, and Best Trade-off priorities, so that I can get route recommendations aligned with what matters most to me.

#### Acceptance Criteria

1. THE Priority_Selector SHALL offer exactly three options: FASTEST, GREENEST, and BEST_TRADEOFF.
2. WHEN no priority is explicitly selected, THE Priority_Selector SHALL default to BEST_TRADEOFF.
3. THE Priority_Selector SHALL NOT include a CHEAPEST option.
4. WHEN the user selects a Priority, THE Priority_Selector SHALL send the selected Priority value to the backend as part of the route request.

### Requirement 2: Candidate Route Data Model

**User Story:** As a developer, I want each route to carry scoring metadata, so that the frontend can display detailed recommendation reasoning.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL enrich each Candidate_Route with the following fields: mode, duration, distance, emissions, cost, practicalityPenalty, normalizedDuration, normalizedEmissions, normalizedCost, finalScore, isDominated, and explanationReason.
2. THE Scoring_Engine SHALL set practicalityPenalty to a float in the range [0.0, 1.0].
3. THE Scoring_Engine SHALL set normalizedDuration, normalizedEmissions, and normalizedCost to floats in the range [0.0, 1.0].
4. THE Scoring_Engine SHALL set isDominated to a boolean value.
5. THE Scoring_Engine SHALL set explanationReason to a non-empty string for the recommended Candidate_Route.

### Requirement 3: Practicality Penalty Calculation

**User Story:** As a user, I want walking and bicycling to be penalized on long trips, so that the system does not recommend impractical human-powered routes for long distances.

#### Acceptance Criteria

1. WHEN the mode is walking and the distance exceeds 3 km or the duration exceeds 35 minutes, THE Scoring_Engine SHALL apply a Practicality_Penalty greater than 0.0.
2. WHEN the mode is bicycling and the distance exceeds 8 km or the duration exceeds 45 minutes, THE Scoring_Engine SHALL apply a Practicality_Penalty greater than 0.0.
3. WHEN the mode is walking and the duration exceeds 2.5 times the fastest Candidate_Route duration, THE Scoring_Engine SHALL apply a Practicality_Penalty greater than 0.0.
4. WHEN the mode is bicycling and the duration exceeds 2.0 times the fastest Candidate_Route duration, THE Scoring_Engine SHALL apply a Practicality_Penalty greater than 0.0.
5. WHEN the mode is driving, transit, rideshare, or e-scooter, THE Scoring_Engine SHALL set the Practicality_Penalty to 0.0.
6. THE Scoring_Engine SHALL clamp the Practicality_Penalty to the range [0.0, 1.0].

### Requirement 4: Pareto Filtering

**User Story:** As a user, I want dominated routes to be identified, so that I can focus on routes that are not strictly worse than another option.

#### Acceptance Criteria

1. WHEN another Candidate_Route is at least as good on duration, emissions, and cost, and strictly better on at least one of those dimensions, THE Pareto_Filter SHALL mark the inferior Candidate_Route as dominated (isDominated = true).
2. WHEN no other Candidate_Route dominates a given route, THE Pareto_Filter SHALL mark that route as not dominated (isDominated = false).
3. THE Pareto_Filter SHALL evaluate all Candidate_Routes pairwise before scoring begins.
4. FOR ALL pairs of Candidate_Routes A and B, WHEN A dominates B and B dominates A, THE Pareto_Filter SHALL mark neither as dominated (this situation implies equality on all dimensions).

### Requirement 5: Min-Max Normalization

**User Story:** As a developer, I want route metrics normalized to [0, 1], so that the scoring engine can combine duration, emissions, and cost on a common scale.

#### Acceptance Criteria

1. THE Normalizer SHALL compute normalizedDuration as (duration − minDuration) / (maxDuration − minDuration) across all Candidate_Routes.
2. THE Normalizer SHALL compute normalizedEmissions as (emissions − minEmissions) / (maxEmissions − minEmissions) across all Candidate_Routes.
3. THE Normalizer SHALL compute normalizedCost as (cost − minCost) / (maxCost − minCost) across all Candidate_Routes.
4. WHEN all Candidate_Routes share the same value for a metric, THE Normalizer SHALL set the normalized value to 0.0 for that metric across all routes.
5. WHEN a Candidate_Route has a missing or null cost, THE Normalizer SHALL treat the cost as 0.0 for normalization purposes.

### Requirement 6: Weighted Scoring

**User Story:** As a user, I want routes scored according to my selected priority, so that the recommendation reflects my preference for speed, sustainability, or balance.

#### Acceptance Criteria

1. WHEN the Priority is FASTEST, THE Scoring_Engine SHALL use the Weight_Vector: duration=1.0, emissions=0.0, cost=0.0, practicality=0.0.
2. WHEN the Priority is GREENEST, THE Scoring_Engine SHALL use the Weight_Vector: duration=0.10, emissions=0.70, cost=0.05, practicality=0.15.
3. WHEN the Priority is BEST_TRADEOFF, THE Scoring_Engine SHALL use the Weight_Vector: duration=0.40, emissions=0.30, cost=0.15, practicality=0.15.
4. THE Scoring_Engine SHALL compute finalScore as: (duration_weight × normalizedDuration) + (emissions_weight × normalizedEmissions) + (cost_weight × normalizedCost) + (practicality_weight × practicalityPenalty).
5. THE Scoring_Engine SHALL select the Candidate_Route with the lowest finalScore as the recommended route for the given Priority.

### Requirement 7: Priority Behavior

**User Story:** As a user, I want each priority to produce meaningfully different recommendations, so that switching priorities changes the suggested route when trade-offs exist.

#### Acceptance Criteria

1. WHEN the Priority is FASTEST, THE Scoring_Engine SHALL select the Candidate_Route with the lowest total duration.
2. WHEN the Priority is GREENEST, THE Scoring_Engine SHALL prioritize low emissions while penalizing impractical walking or bicycling routes via the Practicality_Penalty.
3. WHEN the Priority is BEST_TRADEOFF, THE Scoring_Engine SHALL balance duration, emissions, cost, and practicality according to the BEST_TRADEOFF Weight_Vector.
4. WHEN a walking or bicycling route has zero emissions but a high Practicality_Penalty, THE Scoring_Engine SHALL rank that route lower than a low-emission motorized route under the GREENEST Priority.

### Requirement 8: Response Shape

**User Story:** As a frontend developer, I want the API response to include the selected priority, the recommended route with all scoring fields, and the full routes array, so that the UI can render detailed recommendation data.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL include a selectedPriority field in the response indicating which Priority was used.
2. THE Scoring_Engine SHALL include a recommendedRoute object containing all Candidate_Route fields (mode, duration, distance, emissions, cost, practicalityPenalty, normalizedDuration, normalizedEmissions, normalizedCost, finalScore, isDominated, explanationReason).
3. THE Scoring_Engine SHALL include a routes array containing all Candidate_Routes with their full scoring metadata.
4. THE Scoring_Engine SHALL preserve existing response fields (origin, destination, savings_vs_driving_kg, reasoning) alongside the new fields.

### Requirement 9: Deterministic Explanation Generation

**User Story:** As a user, I want a clear, deterministic explanation of why a route was recommended, so that I can understand the trade-offs without relying on unpredictable LLM output.

#### Acceptance Criteria

1. THE Explanation_Generator SHALL produce an explanationReason string based solely on the selected Priority and the Candidate_Route scoring data.
2. WHEN the Priority is FASTEST, THE Explanation_Generator SHALL state that the route was selected for having the shortest duration.
3. WHEN the Priority is GREENEST, THE Explanation_Generator SHALL reference the route's emissions and any Practicality_Penalty applied.
4. WHEN the Priority is BEST_TRADEOFF, THE Explanation_Generator SHALL reference the balance of duration, emissions, cost, and practicality in the explanation.
5. THE Explanation_Generator SHALL produce identical output for identical inputs (deterministic behavior).
6. THE Explanation_Generator SHALL NOT use an LLM to select or rank routes; the LLM may only augment the deterministic explanation with natural-language phrasing.

### Requirement 10: Frontend Priority Selector Update

**User Story:** As a user, I want the trip form to show Fastest, Greenest, and Best Trade-off options, so that I can select my preferred priority before searching.

#### Acceptance Criteria

1. THE Priority_Selector SHALL display three selectable options labeled "Fastest", "Greenest", and "Best Trade-off".
2. THE Priority_Selector SHALL visually indicate the currently selected priority.
3. WHEN the page loads, THE Priority_Selector SHALL have "Best Trade-off" selected by default.
4. THE Priority_Selector SHALL NOT display a "Cheapest" option.
5. WHEN a Candidate_Route has a Practicality_Penalty greater than 0.0, THE frontend SHALL display a practicality note indicating the penalty reason (e.g., "Long walk — 45 min").

### Requirement 11: Removal of Cheapest as Top-Level Priority

**User Story:** As a product owner, I want Cheapest removed as a standalone priority, so that cost is factored into scoring without dominating the recommendation.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL NOT offer CHEAPEST as a selectable Priority.
2. THE Scoring_Engine SHALL include cost as a weighted factor within the GREENEST and BEST_TRADEOFF Weight_Vectors.
3. THE frontend SHALL remove the "Cheapest" badge from route cards.
4. THE backend response SHALL NOT include a top-level cheapest field in the route comparison.

### Requirement 12: Scoring Determinism and Testability

**User Story:** As a developer, I want all scoring computations to be deterministic and unit-testable, so that I can verify correctness with automated tests.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL produce identical finalScore values for identical input data across repeated invocations.
2. THE Scoring_Engine SHALL expose the Practicality_Penalty calculation as a pure function accepting mode, distance, duration, and fastest route duration, and returning a float.
3. THE Normalizer SHALL expose normalization as a pure function accepting a list of values and returning a list of normalized values.
4. THE Pareto_Filter SHALL expose Pareto filtering as a pure function accepting a list of Candidate_Routes and returning a list of booleans indicating domination status.
5. FOR ALL valid Candidate_Route lists, scoring then re-scoring with the same Priority and inputs SHALL produce identical finalScore values (idempotence property).
6. FOR ALL Candidate_Route lists with at least one route, THE Scoring_Engine SHALL select exactly one recommended route.

### Requirement 13: Emissions and Cost Handling

**User Story:** As a user, I want emissions and cost computed accurately for all modes, so that the scoring reflects real-world trade-offs.

#### Acceptance Criteria

1. THE Scoring_Engine SHALL use the existing emissions computation system (emission_factors module) to calculate emissions for each Candidate_Route.
2. WHEN the mode is walking or bicycling, THE Scoring_Engine SHALL compute emissions as 0.0 grams.
3. THE Scoring_Engine SHALL compute estimated cost using the existing cost factor system for each Candidate_Route.
4. WHEN a Candidate_Route has a missing or null cost, THE Scoring_Engine SHALL treat the cost as 0.0 for scoring purposes.
5. THE Scoring_Engine SHALL NOT allow cost alone to cause a route to be selected as the top recommendation under any Priority.
