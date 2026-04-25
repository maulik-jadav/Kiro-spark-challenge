"""
Scoring Engine — Priority-Based Route Recommendation

Deterministic, pure-function module for scoring route options.
Computes practicality penalties, Pareto filtering, min-max normalization,
weighted scoring, and explanation generation.

All functions are pure — no I/O, no side effects, no LLM calls.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum

from core.emission_factors import TransitMode


# ---------------------------------------------------------------------------
# Priority enum and weight vectors
# ---------------------------------------------------------------------------

class Priority(str, Enum):
    FASTEST = "fastest"
    GREENEST = "greenest"
    BEST_TRADEOFF = "best_tradeoff"


@dataclass(frozen=True)
class WeightVector:
    """Scoring weights for a priority. All four should sum to 1.0."""
    duration: float
    emissions: float
    cost: float
    practicality: float


WEIGHT_VECTORS: dict[Priority, WeightVector] = {
    Priority.FASTEST:       WeightVector(duration=1.0,  emissions=0.0,  cost=0.0,  practicality=0.0),
    Priority.GREENEST:      WeightVector(duration=0.10, emissions=0.70, cost=0.05, practicality=0.15),
    Priority.BEST_TRADEOFF: WeightVector(duration=0.40, emissions=0.30, cost=0.15, practicality=0.15),
}


# ---------------------------------------------------------------------------
# Practicality penalty thresholds
# ---------------------------------------------------------------------------

# Modes that receive practicality penalties
_PENALIZED_MODES = {TransitMode.WALKING, TransitMode.BICYCLING}

_WALK_THRESHOLDS = {
    "soft_distance_km": 3.0,
    "soft_duration_min": 35.0,
    "max_duration_ratio": 2.5,
}

_BIKE_THRESHOLDS = {
    "soft_distance_km": 8.0,
    "soft_duration_min": 45.0,
    "max_duration_ratio": 2.0,
}


# ---------------------------------------------------------------------------
# Pure functions
# ---------------------------------------------------------------------------

def compute_practicality_penalty(
    mode: TransitMode,
    distance_km: float,
    duration_min: float,
    fastest_duration_min: float,
) -> float:
    """
    Return a soft penalty in [0.0, 1.0] for impractical human-powered routes.

    Driving, transit, rideshare, and e-scooter always return 0.0.
    Walking and bicycling receive increasing penalties as distance or duration
    exceeds comfortable thresholds, or when duration is disproportionately
    long relative to the fastest route.
    """
    if mode not in _PENALIZED_MODES:
        return 0.0

    thresholds = _WALK_THRESHOLDS if mode == TransitMode.WALKING else _BIKE_THRESHOLDS
    penalties: list[float] = []

    soft_dist = thresholds["soft_distance_km"]
    soft_dur = thresholds["soft_duration_min"]
    max_ratio = thresholds["max_duration_ratio"]

    if distance_km > soft_dist:
        penalties.append((distance_km - soft_dist) / soft_dist)

    if duration_min > soft_dur:
        penalties.append((duration_min - soft_dur) / soft_dur)

    if fastest_duration_min > 0 and duration_min > max_ratio * fastest_duration_min:
        ratio = duration_min / fastest_duration_min
        penalties.append((ratio - max_ratio) / max_ratio)

    if not penalties:
        return 0.0

    return min(max(penalties), 1.0)


def normalize_values(values: list[float]) -> list[float]:
    """
    Min-max normalize a list of floats to [0.0, 1.0].

    Returns all 0.0 if all values are equal (max == min).
    Lower original values produce lower normalized values (closer to 0 = better).
    """
    if not values:
        return []

    min_val = min(values)
    max_val = max(values)

    if max_val == min_val:
        return [0.0] * len(values)

    span = max_val - min_val
    return [(v - min_val) / span for v in values]


def pareto_filter(routes: list[dict]) -> list[bool]:
    """
    Return a list of booleans: True if the route at that index is dominated.

    A route is dominated if another route is at least as good on duration,
    emissions, and cost, and strictly better on at least one dimension.

    Each dict must have keys: 'duration', 'emissions', 'cost'.
    Missing cost is treated as 0.0.
    """
    n = len(routes)
    dominated = [False] * n

    def safe_cost(c: float | None) -> float:
        return c if c is not None else 0.0

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            ri, rj = routes[i], routes[j]
            # Check if j dominates i
            d_j = rj["duration"]
            d_i = ri["duration"]
            e_j = rj["emissions"]
            e_i = ri["emissions"]
            c_j = safe_cost(rj.get("cost"))
            c_i = safe_cost(ri.get("cost"))

            at_least_as_good = (d_j <= d_i and e_j <= e_i and c_j <= c_i)
            strictly_better = (d_j < d_i or e_j < e_i or c_j < c_i)

            if at_least_as_good and strictly_better:
                dominated[i] = True
                break

    return dominated


def compute_final_score(
    normalized_duration: float,
    normalized_emissions: float,
    normalized_cost: float,
    practicality_penalty: float,
    weights: WeightVector,
) -> float:
    """Weighted sum of normalized metrics. Lower is better."""
    return (
        weights.duration * normalized_duration
        + weights.emissions * normalized_emissions
        + weights.cost * normalized_cost
        + weights.practicality * practicality_penalty
    )


def generate_explanation(
    priority: Priority,
    mode: TransitMode,
    duration_min: float,
    emissions_g: float,
    cost_usd: float,
    practicality_penalty: float,
    final_score: float,
) -> str:
    """
    Deterministic explanation string for why a route was recommended.

    Produces identical output for identical inputs.
    """
    mode_label = mode.value.replace("_", " ").title()

    if priority == Priority.FASTEST:
        return (
            f"This route was selected because it has the shortest travel time "
            f"at {duration_min:.0f} minutes via {mode_label}."
        )

    if priority == Priority.GREENEST:
        base = (
            f"This route was selected because it has low emissions "
            f"({emissions_g:.0f}g CO₂) via {mode_label}"
        )
        if practicality_penalty > 0:
            base += f" while remaining practical for the trip distance (penalty: {practicality_penalty:.2f})"
        base += "."
        return base

    # BEST_TRADEOFF
    return (
        f"This route provides the best balance of travel time ({duration_min:.0f} min), "
        f"emissions ({emissions_g:.0f}g CO₂), and cost (${cost_usd:.2f}) "
        f"via {mode_label} with a score of {final_score:.3f}."
    )


# ---------------------------------------------------------------------------
# Top-level scoring orchestration
# ---------------------------------------------------------------------------

def score_routes(
    options: list,
    priority: Priority,
) -> dict:
    """
    Top-level orchestration: penalties → Pareto → normalize → score → recommend.

    Accepts a list of RouteOption objects and a Priority.
    Returns a dict with 'priority', 'recommended', and 'routes' keys.
    Each route in 'routes' is a dict with all original fields plus scoring metadata.

    This function is kept schema-agnostic (works with dicts) so it can be
    unit-tested without importing Pydantic models.
    """
    if not options:
        return {"priority": priority.value, "recommended": None, "routes": []}

    # Convert RouteOption objects to dicts for scoring
    route_dicts = []
    for opt in options:
        d = opt.model_dump() if hasattr(opt, "model_dump") else dict(opt)
        route_dicts.append(d)

    # Find fastest duration for relative penalty calculation
    fastest_duration = min(d["total_duration_min"] for d in route_dicts)

    # Step 1: Compute practicality penalties
    for d in route_dicts:
        mode = d["mode"]
        if isinstance(mode, str):
            mode = TransitMode(mode)
        d["practicality_penalty"] = compute_practicality_penalty(
            mode=mode,
            distance_km=d["total_distance_km"],
            duration_min=d["total_duration_min"],
            fastest_duration_min=fastest_duration,
        )

    # Step 2: Pareto filtering
    pareto_input = [
        {
            "duration": d["total_duration_min"],
            "emissions": d["total_emissions_g"],
            "cost": d.get("total_cost_usd", 0.0),
        }
        for d in route_dicts
    ]
    dominated_flags = pareto_filter(pareto_input)
    for d, is_dom in zip(route_dicts, dominated_flags):
        d["is_dominated"] = is_dom

    # Step 3: Normalize
    durations = [d["total_duration_min"] for d in route_dicts]
    emissions = [d["total_emissions_g"] for d in route_dicts]
    costs = [d.get("total_cost_usd", 0.0) or 0.0 for d in route_dicts]

    norm_durations = normalize_values(durations)
    norm_emissions = normalize_values(emissions)
    norm_costs = normalize_values(costs)

    for i, d in enumerate(route_dicts):
        d["normalized_duration"] = round(norm_durations[i], 6)
        d["normalized_emissions"] = round(norm_emissions[i], 6)
        d["normalized_cost"] = round(norm_costs[i], 6)

    # Step 4: Compute final scores
    weights = WEIGHT_VECTORS[priority]
    for d in route_dicts:
        d["final_score"] = round(
            compute_final_score(
                normalized_duration=d["normalized_duration"],
                normalized_emissions=d["normalized_emissions"],
                normalized_cost=d["normalized_cost"],
                practicality_penalty=d["practicality_penalty"],
                weights=weights,
            ),
            6,
        )

    # Step 5: Select recommended route (lowest final_score)
    recommended_idx = min(range(len(route_dicts)), key=lambda i: route_dicts[i]["final_score"])

    # Step 6: Generate explanations
    rec = route_dicts[recommended_idx]
    rec_mode = rec["mode"]
    if isinstance(rec_mode, str):
        rec_mode = TransitMode(rec_mode)

    rec["explanation_reason"] = generate_explanation(
        priority=priority,
        mode=rec_mode,
        duration_min=rec["total_duration_min"],
        emissions_g=rec["total_emissions_g"],
        cost_usd=rec.get("total_cost_usd", 0.0) or 0.0,
        practicality_penalty=rec["practicality_penalty"],
        final_score=rec["final_score"],
    )

    # Set empty explanation for non-recommended routes
    for i, d in enumerate(route_dicts):
        if i != recommended_idx:
            d.setdefault("explanation_reason", "")

    return {
        "priority": priority.value,
        "recommended": route_dicts[recommended_idx],
        "routes": route_dicts,
    }
