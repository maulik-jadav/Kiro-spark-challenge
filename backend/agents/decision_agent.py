"""
Decision Agent

Uses an LLM (Llama via Groq) to evaluate route options, rank them based on
user constraints, and generate a natural language justification.
This is the reasoning layer — it doesn't fetch data, it interprets it.
"""

import json

from openai import AsyncOpenAI

from models.schemas import AgentReasoning, RouteOption
from core.emission_factors import TransitMode


SYSTEM_PROMPT = """\
You are a carbon-aware transit advisor. You receive structured route data \
comparing transit modes between two locations. Each option includes distance, \
duration, CO2 emissions, and cost.

A deterministic scoring engine has already selected a recommended route. \
By default, explain and justify that selection. However, if a user \
constraint is provided, you may override the pre-selected mode and choose \
whichever mode from the available options best satisfies the constraint.

Guidelines:
1. Analyze the trade-offs between speed, cost, and carbon impact.
2. Explain your reasoning in plain, concise language — no jargon.
3. Always ground your reasoning in the actual numbers provided.
4. Never fabricate data or reference modes not in the options.

Respond with JSON only, no markdown fences:
{
  "recommended_mode": "<mode value from the options that best fits>",
  "summary": "<1-2 sentence recommendation>",
  "justification": "<detailed reasoning comparing the trade-offs>",
  "constraint_analysis": "<how the recommendation satisfies the constraint, or null if no constraint>"
}\
"""


CONSTRAINT_OVERRIDE_BLOCK = (
    "--- USER CONSTRAINT ---\n"
    "The user has specified the following constraint. "
    "You MUST prioritize this constraint when selecting a mode and "
    "generating the constraint_analysis field.\n"
    "You MAY select a different mode from the available options if the "
    "constraint warrants it — you are NOT required to recommend the "
    "pre-selected mode. Choose the mode that best satisfies the constraint "
    "from the options provided.\n"
    "If the pre-selected mode already satisfies the constraint, keep it.\n"
    "You MUST only select a mode that appears in the provided route options.\n"
)


def build_system_prompt(base_prompt: str, constraint: str | None) -> str:
    """
    Assemble the system prompt for the Decision Agent.

    If a non-empty constraint is provided, appends override authority
    instructions and the constraint text. Otherwise returns the base
    prompt unchanged.
    """
    if not constraint or not constraint.strip():
        return base_prompt

    trimmed = constraint.strip()
    return (
        f"{base_prompt}\n\n"
        f"{CONSTRAINT_OVERRIDE_BLOCK}"
        f"{trimmed}"
    )


def _build_user_prompt(
    origin: str,
    destination: str,
    options: list[RouteOption],
    constraint: str | None,
    recommended_mode: TransitMode | None = None,
) -> str:
    """Build the user message with route data for the LLM."""
    rows = []
    for opt in options:
        rows.append({
            "mode": opt.mode.value,
            "distance_km": opt.total_distance_km,
            "duration_min": opt.total_duration_min,
            "emissions_g": opt.total_emissions_g,
            "emissions_kg": opt.total_emissions_kg,
            "cost_usd": opt.total_cost_usd,
        })

    prompt = f"Route: {origin} → {destination}\n\nOptions:\n{json.dumps(rows, indent=2)}"

    if recommended_mode:
        prompt += f"\n\nPre-selected recommended mode: {recommended_mode.value}"

    if constraint:
        prompt += f"\n\nUser constraint: {constraint}"

    return prompt


async def decide(
    origin: str,
    destination: str,
    options: list[RouteOption],
    constraint: str | None = None,
    recommended_mode: TransitMode | None = None,
    api_key: str = "",
) -> AgentReasoning:
    """
    Send route options to Llama via Groq and get a reasoned recommendation.

    The recommended_mode is pre-selected by the scoring engine. The LLM
    explains and justifies that selection rather than picking its own.

    Falls back to a deterministic pick if the API key is missing or the
    call fails, so the endpoint always returns data.
    """
    if not api_key or not options:
        return _fallback_reasoning(options, recommended_mode=recommended_mode, constraint=constraint)

    available_modes = {opt.mode for opt in options}

    try:
        client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
        )

        system_prompt = build_system_prompt(SYSTEM_PROMPT, constraint)

        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=512,
            temperature=0.3,
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": _build_user_prompt(
                        origin, destination, options, constraint,
                        recommended_mode=recommended_mode,
                    ),
                },
            ],
        )

        raw = response.choices[0].message.content
        data = json.loads(raw)

        llm_mode = TransitMode(data["recommended_mode"])

        # Validate: LLM must pick a mode that exists in the options
        if llm_mode not in available_modes:
            return _fallback_reasoning(options, recommended_mode=recommended_mode, constraint=constraint)

        # Compute override flag deterministically
        has_constraint = bool(constraint and constraint.strip())
        is_override = has_constraint and (llm_mode != recommended_mode)

        return AgentReasoning(
            recommended_mode=llm_mode,
            summary=data["summary"],
            justification=data["justification"],
            constraint_analysis=data.get("constraint_analysis"),
            constraint_override=is_override,
        )

    except Exception as e:
        print(f"[WARN] Decision agent failed: {e}. Using fallback.")
        return _fallback_reasoning(options, recommended_mode=recommended_mode, constraint=constraint)


def _score_option(opt: RouteOption, options: list[RouteOption]) -> float:
    """
    Score a route option from 0-100 using weighted criteria.
    Lower is better for all raw metrics, so we normalize and invert.

    Weights: 40% emissions, 35% time, 25% cost
    """
    all_emissions = [o.total_emissions_g for o in options]
    all_times = [o.total_duration_min for o in options]
    all_costs = [o.total_cost_usd for o in options]

    def _normalize(val: float, vals: list[float]) -> float:
        lo, hi = min(vals), max(vals)
        if hi == lo:
            return 1.0
        return 1.0 - (val - lo) / (hi - lo)  # 1.0 = best, 0.0 = worst

    emission_score = _normalize(opt.total_emissions_g, all_emissions)
    time_score = _normalize(opt.total_duration_min, all_times)
    cost_score = _normalize(opt.total_cost_usd, all_costs)

    return 0.40 * emission_score + 0.35 * time_score + 0.25 * cost_score


def _fallback_reasoning(
    options: list[RouteOption],
    recommended_mode: TransitMode | None = None,
    constraint: str | None = None,
) -> AgentReasoning:
    """
    Deterministic fallback when the LLM is unavailable.
    Uses the pre-selected recommended_mode from the scoring engine when
    available, otherwise falls back to weighted scoring.

    When a constraint is provided, attempts keyword-based override:
    cost/money/budget/cheap → cheapest mode,
    fast/quick/time/hurry → fastest mode,
    green/eco/emission/environment → greenest mode.
    """
    if not options:
        return AgentReasoning(
            recommended_mode=TransitMode.WALKING,
            summary="No route options available.",
            justification="No options were returned by the routing engine.",
            constraint_override=False,
        )

    # --- Constraint-aware override in fallback ---
    constraint_best = None
    constraint_reason = ""
    if constraint and constraint.strip():
        lower = constraint.strip().lower()
        cost_keywords = {"cost", "money", "budget", "cheap", "save", "affordable", "inexpensive", "price", "dollar", "usd", "expense"}
        time_keywords = {"fast", "quick", "time", "hurry", "rush", "soon", "early", "arrive", "speed", "rapid"}
        green_keywords = {"green", "eco", "emission", "environment", "carbon", "co2", "sustainable", "clean", "planet"}

        words = set(lower.split())
        # Also check substring matches for compound phrases
        has_cost = bool(words & cost_keywords) or any(k in lower for k in cost_keywords)
        has_time = bool(words & time_keywords) or any(k in lower for k in time_keywords)
        has_green = bool(words & green_keywords) or any(k in lower for k in green_keywords)

        if has_cost and not has_time and not has_green:
            constraint_best = min(options, key=lambda o: o.total_cost_usd)
            constraint_reason = f"Selected {constraint_best.mode.value} as the cheapest option (${constraint_best.total_cost_usd:.2f}) to satisfy your constraint: \"{constraint.strip()}\""
        elif has_time and not has_cost and not has_green:
            constraint_best = min(options, key=lambda o: o.total_duration_min)
            constraint_reason = f"Selected {constraint_best.mode.value} as the fastest option ({constraint_best.total_duration_min:.0f} min) to satisfy your constraint: \"{constraint.strip()}\""
        elif has_green and not has_cost and not has_time:
            constraint_best = min(options, key=lambda o: o.total_emissions_g)
            constraint_reason = f"Selected {constraint_best.mode.value} as the greenest option ({constraint_best.total_emissions_g:.0f}g CO2) to satisfy your constraint: \"{constraint.strip()}\""

    # If constraint override found a match, use it
    if constraint_best is not None:
        is_override = (recommended_mode is not None and constraint_best.mode != recommended_mode)
        return AgentReasoning(
            recommended_mode=constraint_best.mode,
            summary=(
                f"Take {constraint_best.mode.value} — {constraint_best.total_duration_min:.0f} min, "
                f"{constraint_best.total_emissions_g:.0f}g CO2, ${constraint_best.total_cost_usd:.2f}."
            ),
            justification=constraint_reason,
            constraint_analysis=constraint_reason,
            constraint_override=is_override,
        )

    # --- Default fallback (no constraint or unrecognized constraint) ---
    # Use the scoring engine's recommendation if provided
    if recommended_mode is not None:
        best = next((o for o in options if o.mode == recommended_mode), None)
        if best is None:
            best = options[0]
    else:
        # Legacy fallback: score and rank all options
        scored = [(opt, _score_option(opt, options)) for opt in options]
        scored.sort(key=lambda x: x[1], reverse=True)  # highest score first
        best = scored[0][0]

    greenest = min(options, key=lambda o: o.total_emissions_g)
    fastest = min(options, key=lambda o: o.total_duration_min)

    parts = [
        f"Recommended {best.mode.value} based on the selected priority.",
    ]

    if best.mode != greenest.mode:
        parts.append(
            f"The greenest option is {greenest.mode.value} "
            f"({greenest.total_emissions_g:.0f}g CO2) but takes "
            f"{greenest.total_duration_min:.0f} min."
        )
    if best.mode != fastest.mode:
        parts.append(
            f"The fastest option is {fastest.mode.value} "
            f"({fastest.total_duration_min:.0f} min) but emits "
            f"{fastest.total_emissions_g:.0f}g CO2."
        )

    parts.append(
        f"{best.mode.value}: {best.total_duration_min:.0f} min, "
        f"{best.total_emissions_g:.0f}g CO2, ${best.total_cost_usd:.2f}."
    )

    return AgentReasoning(
        recommended_mode=best.mode,
        summary=(
            f"Take {best.mode.value} — {best.total_duration_min:.0f} min, "
            f"{best.total_emissions_g:.0f}g CO2, ${best.total_cost_usd:.2f}."
        ),
        justification=" ".join(parts),
        constraint_override=False,
    )
