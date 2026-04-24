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

Your job:
1. Analyze the trade-offs between speed, cost, and carbon impact.
2. Recommend the best option, weighted toward sustainability but \
   respecting practical constraints the user provides.
3. Explain your reasoning in plain, concise language — no jargon.

Always ground your reasoning in the actual numbers provided. \
Never fabricate data or reference modes not in the options.

Respond with JSON only, no markdown fences:
{
  "recommended_mode": "<mode value>",
  "summary": "<1-2 sentence recommendation>",
  "justification": "<detailed reasoning comparing the trade-offs>",
  "constraint_analysis": "<how the recommendation satisfies the constraint, or null if no constraint>"
}\
"""


def _build_user_prompt(
    origin: str,
    destination: str,
    options: list[RouteOption],
    constraint: str | None,
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

    if constraint:
        prompt += f"\n\nUser constraint: {constraint}"

    return prompt


async def decide(
    origin: str,
    destination: str,
    options: list[RouteOption],
    constraint: str | None = None,
    api_key: str = "",
) -> AgentReasoning:
    """
    Send route options to Llama via Groq and get a reasoned recommendation.

    Falls back to a deterministic pick (greenest) if the API key is
    missing or the call fails, so the endpoint always returns data.
    """
    if not api_key or not options:
        return _fallback_reasoning(options)

    try:
        client = AsyncOpenAI(
            api_key=api_key,
            base_url="https://api.groq.com/openai/v1",
        )

        response = await client.chat.completions.create(
            model="llama-3.1-8b-instant",
            max_tokens=512,
            temperature=0.3,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _build_user_prompt(origin, destination, options, constraint),
                },
            ],
        )

        raw = response.choices[0].message.content
        data = json.loads(raw)

        return AgentReasoning(
            recommended_mode=TransitMode(data["recommended_mode"]),
            summary=data["summary"],
            justification=data["justification"],
            constraint_analysis=data.get("constraint_analysis"),
        )

    except Exception as e:
        print(f"[WARN] Decision agent failed: {e}. Using fallback.")
        return _fallback_reasoning(options)


def _fallback_reasoning(options: list[RouteOption]) -> AgentReasoning:
    """Deterministic fallback when the LLM is unavailable."""
    if not options:
        return AgentReasoning(
            recommended_mode=TransitMode.WALKING,
            summary="No route options available.",
            justification="No options were returned by the routing engine.",
        )

    greenest = min(options, key=lambda o: o.total_emissions_g)
    fastest = min(options, key=lambda o: o.total_duration_min)

    if greenest.mode == fastest.mode:
        summary = (
            f"{greenest.mode.value} is both the greenest and fastest option "
            f"at {greenest.total_emissions_g:.0f}g CO2 in {greenest.total_duration_min:.0f} min."
        )
    else:
        time_diff = greenest.total_duration_min - fastest.total_duration_min
        carbon_diff = fastest.total_emissions_g - greenest.total_emissions_g
        summary = (
            f"Take {greenest.mode.value} to save {carbon_diff:.0f}g CO2 "
            f"for only {time_diff:.0f} extra minutes vs {fastest.mode.value}."
        )

    return AgentReasoning(
        recommended_mode=greenest.mode,
        summary=summary,
        justification=(
            f"The greenest option is {greenest.mode.value} at "
            f"{greenest.total_emissions_g:.0f}g CO2 and ${greenest.total_cost_usd:.2f}. "
            f"The fastest is {fastest.mode.value} at {fastest.total_duration_min:.0f} min. "
            f"Defaulting to the lowest-emission choice (fallback mode — no LLM available)."
        ),
    )
