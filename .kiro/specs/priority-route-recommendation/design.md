# Design Document: Priority-Based Route Recommendation

## Overview

This feature replaces the current route recommendation system (Greenest / Cheapest / Fastest badges) with a deterministic, priority-based scoring engine. Users select one of three priorities — **Fastest**, **Greenest**, or **Best Trade-off** — and the system scores all candidate routes using min-max normalization, configurable weight vectors, Pareto filtering, and practicality penalties for human-powered modes on long trips.

The scoring engine is a new pure-function module (`backend/core/scoring_engine.py`) that sits between the existing Emissions Agent and the Decision Agent. The Decision Agent's LLM-based reasoning is preserved for natural-language explanations but no longer influences route selection — it only explains the deterministic result.

### Key Design Decisions

1. **Scoring engine as pure functions in `backend/core/`** — not in `agents/` — because it performs deterministic computation, not agentic reasoning. This keeps it trivially unit-testable.
2. **`cheapest` field removed from `RouteComparison`** — cost is folded into the weighted score instead of being a standalone category.
3. **Priority sent from frontend to backend** — the backend computes scores for the requested priority and returns enriched route data. The frontend does not re-score.
4. **Existing `decision_agent.py` preserved** — it receives the already-selected recommended route and generates a natural-language justification. It does not pick the route.

## Architecture

```mermaid
flowchart TD
    subgraph Frontend
        TF[TripForm + PrioritySelector]
        RP[ResultsPanel]
        RC[RouteCard]
        MV[MapView]
    end

    subgraph Backend
        API["/plan-route"]
        RA[Routing Agent]
        EA[Emissions Agent]
        SE[Scoring Engine]
        DA[Decision Agent]
    end

    TF -->|POST origin, dest, modes, priority| API
    API --> RA
    RA -->|RawRouteResult[]| EA
    EA -->|RouteOption[]| SE
    SE -->|ScoredRouteComparison| DA
    DA -->|AgentReasoning| API
    API -->|ScoredRouteComparison + reasoning| RP
    RP --> RC
    RP --> MV
```

### Data Flow

1. **TripForm** sends `{ origin, destination, modes, priority }` to `POST /plan-route`.
2. **Routing Agent** fetches raw routes from Google Maps.
3. **Emissions Agent** computes emissions and cost per route (unchanged).
4. **Scoring Engine** (new):
   - Computes practicality penalties for walking/bicycling.
   - Runs Pareto filtering to mark dominated routes.
   - Normalizes duration, emissions, and cost via min-max.
   - Computes weighted `finalScore` per route using the priority's weight vector.
   - Selects the route with the lowest `finalScore` as recommended.
   - Generates a deterministic `explanationReason` string.
5. **Decision Agent** receives the scored routes and recommended route, then generates a natural-language justification (LLM or fallback). It does **not** change the recommendation.
6. **API** returns the full `ScoredRouteComparison` response.
7. **Frontend** renders the recommended route badge, scoring metadata, practicality notes, and polyline colors based on the response.

## Components and Interfaces

### 1. `Priority` Enum (`backend/core/scoring_engine.py`)

```python
from enum import Enum

class Priority(str, Enum):
    FASTEST = "fastest"
    GREENEST = "greenest"
    BEST_TRADEOFF = "best_tradeoff"
```

### 2. Weight Vector Configuration (`backend/core/scoring_engine.py`)

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class WeightVector:
    duration: float
    emissions: float
    cost: float
    practicality: float

WEIGHT_VECTORS: dict[Priority, WeightVector] = {
    Priority.FASTEST:       WeightVector(duration=1.0,  emissions=0.0,  cost=0.0,  practicality=0.0),
    Priority.GREENEST:      WeightVector(duration=0.10, emissions=0.70, cost=0.05, practicality=0.15),
    Priority.BEST_TRADEOFF: WeightVector(duration=0.40, emissions=0.30, cost=0.15, practicality=0.15),
}
```

### 3. Pure Scoring Functions (`backend/core/scoring_engine.py`)

All functions are pure — no I/O, no side effects, no LLM calls.

```python
def compute_practicality_penalty(
    mode: TransitMode,
    distance_km: float,
    duration_min: float,
    fastest_duration_min: float,
) -> float:
    """Return a penalty in [0.0, 1.0] for impractical human-powered routes."""

def normalize_values(values: list[float]) -> list[float]:
    """Min-max normalize a list of floats to [0.0, 1.0]. Returns all 0.0 if all values are equal."""

def pareto_filter(routes: list[dict]) -> list[bool]:
    """Return a list of booleans: True if the route at that index is dominated."""

def compute_final_score(
    normalized_duration: float,
    normalized_emissions: float,
    normalized_cost: float,
    practicality_penalty: float,
    weights: WeightVector,
) -> float:
    """Weighted sum of normalized metrics."""

def generate_explanation(
    priority: Priority,
    route: dict,
    all_routes: list[dict],
) -> str:
    """Deterministic explanation string for why a route was recommended."""

def score_routes(
    options: list[RouteOption],
    priority: Priority,
) -> ScoringResult:
    """
    Top-level orchestration: penalties → Pareto → normalize → score → recommend.
    Returns a ScoringResult with all enriched routes and the recommended route.
    """
```

### 4. `ScoredRoute` and `ScoringResult` Models (`backend/models/schemas.py`)

```python
class ScoredRoute(BaseModel):
    """A RouteOption enriched with scoring metadata."""
    mode: TransitMode
    segments: list[RouteSegment]
    total_distance_km: float
    total_duration_min: float
    total_emissions_g: float
    total_emissions_kg: float
    total_cost_usd: float
    emission_factor_source: str
    cost_source: str
    polyline: str | None = None
    # Scoring fields
    practicality_penalty: float = 0.0
    normalized_duration: float = 0.0
    normalized_emissions: float = 0.0
    normalized_cost: float = 0.0
    final_score: float = 0.0
    is_dominated: bool = False
    explanation_reason: str = ""

class ScoringResult(BaseModel):
    """Output of the scoring engine."""
    priority: Priority
    recommended: ScoredRoute
    routes: list[ScoredRoute]
```

### 5. Updated `RouteComparison` (`backend/models/schemas.py`)

```python
class RouteComparison(BaseModel):
    origin: str
    destination: str
    options: list[RouteOption]          # kept for backward compat
    greenest: RouteOption | None = None
    fastest: RouteOption | None = None
    # cheapest: REMOVED
    savings_vs_driving_kg: float | None = None
    reasoning: AgentReasoning | None = None
    # New scoring fields
    selected_priority: Priority | None = None
    recommended_route: ScoredRoute | None = None
    scored_routes: list[ScoredRoute] = []
```

### 6. Updated `RouteRequest` (`backend/models/schemas.py`)

```python
class RouteRequest(BaseModel):
    origin: str
    destination: str
    modes: list[TransitMode] | None = None
    constraint: str | None = None
    priority: Priority = Priority.BEST_TRADEOFF  # NEW — defaults to best_tradeoff
```

### 7. Orchestrator Changes (`backend/agents/orchestrator.py`)

The `plan_route` function gains a `priority` parameter. After the Emissions Agent produces `RouteOption` objects, the orchestrator calls `score_routes(options, priority)` to get the `ScoringResult`, then passes the result to the Decision Agent for explanation.

```python
async def plan_route(
    origin, destination, modes=None, constraint=None, priority=Priority.BEST_TRADEOFF,
    google_maps_api_key="", groq_api_key="",
) -> RouteComparison:
    raw_routes = await get_routes(...)
    options = analyze_all(raw_routes)
    scoring = score_routes(options, priority)

    greenest = find_greenest(options)
    fastest = find_fastest(options)
    savings = savings_vs_driving(options)

    reasoning = await decide(
        origin, destination, options, constraint,
        recommended_mode=scoring.recommended.mode,
        api_key=groq_api_key,
    )

    return RouteComparison(
        origin=origin, destination=destination,
        options=options,
        greenest=greenest, fastest=fastest,
        savings_vs_driving_kg=savings,
        reasoning=reasoning,
        selected_priority=priority,
        recommended_route=scoring.recommended,
        scored_routes=scoring.routes,
    )
```

### 8. Decision Agent Changes (`backend/agents/decision_agent.py`)

The `decide` function receives an additional `recommended_mode` parameter. The LLM prompt is updated to explain the already-selected route rather than pick one. The fallback reasoning uses the provided `recommended_mode` instead of computing its own score.

### 9. Frontend Type Updates (`frontend/src/types/api.ts`)

```typescript
export type Priority = "fastest" | "greenest" | "best_tradeoff";

export interface ScoredRoute extends RouteOption {
  practicality_penalty: number;
  normalized_duration: number;
  normalized_emissions: number;
  normalized_cost: number;
  final_score: number;
  is_dominated: boolean;
  explanation_reason: string;
}

export interface RouteComparison {
  origin: string;
  destination: string;
  options: RouteOption[];
  greenest: RouteOption | null;
  fastest: RouteOption | null;
  // cheapest: REMOVED
  savings_vs_driving_kg: number | null;
  reasoning: AgentReasoning | null;
  selected_priority: Priority | null;
  recommended_route: ScoredRoute | null;
  scored_routes: ScoredRoute[];
}
```

### 10. Frontend Component Changes

**TripForm** — Add a `PrioritySelector` section (three radio-style buttons: Fastest, Greenest, Best Trade-off). Default to Best Trade-off. Pass the selected priority to `onSubmit`. Remove any reference to "Cheapest".

**RouteCard** — Replace `isCheapest` prop with `isRecommended` prop. Show a "RECOMMENDED" badge on the recommended route. Show a practicality note when `practicality_penalty > 0`. Remove the "CHEAPEST" badge.

**ResultsPanel** — Use `scored_routes` instead of `options` for rendering. Pass `isRecommended` based on `recommended_route.mode`. Remove `cheapest` references.

**MapView** — Replace `cheapest` polyline color with `recommended` polyline color. Use green for greenest, amber for fastest, and blue for recommended (if different from greenest/fastest).

## Data Models

### Practicality Penalty Thresholds

| Mode | Distance Threshold | Duration Threshold | Relative Duration Multiplier |
|------|-------------------|--------------------|------------------------------|
| Walking | 3 km | 35 min | 2.5× fastest route |
| Bicycling | 8 km | 45 min | 2.0× fastest route |
| All others | N/A | N/A | N/A (penalty = 0.0) |

The penalty is computed as the maximum of the applicable sub-penalties (distance-based, duration-based, relative-duration-based), each scaled linearly from 0.0 at the threshold to 1.0 at 2× the threshold, then clamped to [0.0, 1.0].

```python
def compute_practicality_penalty(mode, distance_km, duration_min, fastest_duration_min):
    if mode not in (TransitMode.WALKING, TransitMode.BICYCLING):
        return 0.0

    penalties = []
    if mode == TransitMode.WALKING:
        if distance_km > 3.0:
            penalties.append(min((distance_km - 3.0) / 3.0, 1.0))
        if duration_min > 35.0:
            penalties.append(min((duration_min - 35.0) / 35.0, 1.0))
        if fastest_duration_min > 0 and duration_min > 2.5 * fastest_duration_min:
            ratio = duration_min / fastest_duration_min
            penalties.append(min((ratio - 2.5) / 2.5, 1.0))
    elif mode == TransitMode.BICYCLING:
        if distance_km > 8.0:
            penalties.append(min((distance_km - 8.0) / 8.0, 1.0))
        if duration_min > 45.0:
            penalties.append(min((duration_min - 45.0) / 45.0, 1.0))
        if fastest_duration_min > 0 and duration_min > 2.0 * fastest_duration_min:
            ratio = duration_min / fastest_duration_min
            penalties.append(min((ratio - 2.0) / 2.0, 1.0))

    return max(penalties) if penalties else 0.0
```

### Weight Vectors

| Priority | Duration | Emissions | Cost | Practicality |
|----------|----------|-----------|------|-------------|
| FASTEST | 1.00 | 0.00 | 0.00 | 0.00 |
| GREENEST | 0.10 | 0.70 | 0.05 | 0.15 |
| BEST_TRADEOFF | 0.40 | 0.30 | 0.15 | 0.15 |

### Pareto Dominance

Route A dominates Route B iff:
- `A.duration ≤ B.duration` AND `A.emissions ≤ B.emissions` AND `A.cost ≤ B.cost`
- AND at least one inequality is strict (`<`)

If A and B are equal on all three dimensions, neither dominates the other.

### Min-Max Normalization

For a metric `v` across routes with values `[v₁, v₂, ..., vₙ]`:
- `normalized(vᵢ) = (vᵢ - min) / (max - min)` when `max ≠ min`
- `normalized(vᵢ) = 0.0` when `max = min` (all routes have the same value)

Lower normalized values are better (closer to the minimum).

### Final Score

```
finalScore = w_duration × normalizedDuration
           + w_emissions × normalizedEmissions
           + w_cost × normalizedCost
           + w_practicality × practicalityPenalty
```

The route with the **lowest** `finalScore` is recommended.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Scoring output completeness

*For any* non-empty list of RouteOptions and any valid Priority, the scoring engine SHALL produce a ScoringResult where every ScoredRoute contains all required fields (mode, total_duration_min, total_distance_km, total_emissions_g, total_cost_usd, practicality_penalty, normalized_duration, normalized_emissions, normalized_cost, final_score, is_dominated, explanation_reason) with correct types, and the recommended route's explanation_reason is a non-empty string.

**Validates: Requirements 2.1, 2.4, 2.5, 8.2, 8.3**

### Property 2: Practicality penalty range invariant

*For any* transit mode, distance, duration, and fastest-route duration, the practicality penalty SHALL be a float in the range [0.0, 1.0].

**Validates: Requirements 2.2, 3.6**

### Property 3: Normalized values range invariant

*For any* list of RouteOptions with at least one route, all normalized values (normalized_duration, normalized_emissions, normalized_cost) SHALL be floats in the range [0.0, 1.0].

**Validates: Requirements 2.3, 5.1, 5.2, 5.3**

### Property 4: Practicality penalty correctness

*For any* route, the practicality penalty SHALL be greater than 0.0 if and only if the mode is walking or bicycling AND at least one threshold is exceeded (distance, absolute duration, or relative duration vs. fastest route). For all motorized modes (driving, transit, rideshare, e-scooter), the penalty SHALL be exactly 0.0.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 5: Pareto dominance correctness

*For any* list of candidate routes, a route SHALL be marked as dominated (is_dominated = true) if and only if there exists another route that is at least as good on duration, emissions, and cost, and strictly better on at least one of those dimensions. Routes that are equal on all dimensions SHALL NOT be marked as dominated.

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 6: Min-max normalization formula

*For any* list of non-negative float values, the normalize_values function SHALL return values where each element equals `(v - min) / (max - min)` when max ≠ min, and 0.0 when max = min.

**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 7: Weighted scoring formula and recommendation selection

*For any* list of RouteOptions and any valid Priority, the finalScore of each ScoredRoute SHALL equal the weighted sum `(w.duration × normalizedDuration) + (w.emissions × normalizedEmissions) + (w.cost × normalizedCost) + (w.practicality × practicalityPenalty)`, and the recommended route SHALL be the one with the lowest finalScore.

**Validates: Requirements 6.4, 6.5**

### Property 8: FASTEST selects minimum duration

*For any* non-empty list of RouteOptions, when the Priority is FASTEST, the recommended route SHALL be the route with the lowest total_duration_min.

**Validates: Requirements 7.1**

### Property 9: Scoring idempotence

*For any* list of RouteOptions and any valid Priority, calling score_routes twice with identical inputs SHALL produce identical ScoringResult objects (same finalScore values, same recommended route, same is_dominated flags).

**Validates: Requirements 9.1, 9.5, 12.1, 12.5**

### Property 10: Exactly one recommendation

*For any* non-empty list of RouteOptions and any valid Priority, the scoring engine SHALL select exactly one recommended route.

**Validates: Requirements 12.6**

## Error Handling

### Backend

| Scenario | Handling |
|----------|----------|
| Empty route list (all modes filtered out) | Return `RouteComparison` with empty `scored_routes`, `recommended_route = None`, and a reasoning summary explaining no routes were available. |
| Single route in list | Normalization returns 0.0 for all metrics (max = min). That route is recommended with `finalScore = 0.0`. |
| All routes have identical metrics | Normalization returns 0.0 for all. Pareto marks none as dominated. First route (by input order) is recommended. |
| Invalid priority value in request | Pydantic validation rejects the request with a 422 error before reaching the scoring engine. |
| LLM call fails in Decision Agent | Fallback reasoning uses the deterministic recommended route from the scoring engine (existing behavior, now using the scoring engine's pick instead of the old weighted fallback). |
| Null/missing cost on a route | Treated as 0.0 for normalization and scoring. |

### Frontend

| Scenario | Handling |
|----------|----------|
| `recommended_route` is null | Fall back to displaying routes without a "RECOMMENDED" badge. |
| `scored_routes` is empty | Show "No routes found" message (existing behavior). |
| `selected_priority` is null | Treat as BEST_TRADEOFF for display purposes. |
| Old API response without scoring fields | Graceful degradation — render using `options` array and legacy `greenest`/`fastest` fields. |

## Testing Strategy

### Property-Based Tests (Hypothesis)

The project already uses **Hypothesis** (Python) for property-based testing. Each correctness property above maps to one or more Hypothesis tests in `backend/tests/test_scoring_engine.py`.

**Configuration:**
- Minimum 100 examples per property test (`@settings(max_examples=100)`)
- Each test tagged with a comment: `# Feature: priority-route-recommendation, Property N: <title>`
- Custom Hypothesis strategies for generating valid `RouteOption` objects with realistic ranges

**Strategy for generating RouteOption:**
```python
@st.composite
def route_option_strategy(draw):
    mode = draw(st.sampled_from(list(TransitMode)))
    distance = draw(st.floats(min_value=0.1, max_value=100.0))
    duration = draw(st.floats(min_value=1.0, max_value=300.0))
    emissions = draw(st.floats(min_value=0.0, max_value=50000.0))
    cost = draw(st.floats(min_value=0.0, max_value=500.0))
    # ... build RouteOption
```

### Unit Tests (pytest)

Example-based tests for:
- Weight vector values for each priority (Req 6.1, 6.2, 6.3)
- Priority enum does not include CHEAPEST (Req 11.1)
- Specific practicality penalty scenarios (Req 7.4 — walking with high penalty ranked below transit under GREENEST)
- Explanation content checks per priority (Req 9.2, 9.3, 9.4)
- Response shape includes `selected_priority`, `recommended_route`, `scored_routes` (Req 8.1, 8.4)
- Backward compatibility — `options`, `greenest`, `fastest`, `savings_vs_driving_kg` still present (Req 8.4)
- `cheapest` field removed from response (Req 11.4)
- Null cost treated as 0.0 (Req 5.5, 13.4)

### Frontend Tests (Vitest)

- PrioritySelector renders three options, defaults to Best Trade-off (Req 1.1, 1.2, 10.1, 10.3)
- No "Cheapest" option or badge (Req 1.3, 10.4, 11.3)
- Priority value sent in API request (Req 1.4)
- Practicality note displayed when penalty > 0 (Req 10.5)
- RouteCard shows "RECOMMENDED" badge for recommended route
- MapView polyline colors updated (no cheapest blue, recommended gets distinct color)

### Integration Tests

- End-to-end `POST /plan-route` with `priority` field returns enriched response
- Decision Agent receives `recommended_mode` from scoring engine and does not override it
