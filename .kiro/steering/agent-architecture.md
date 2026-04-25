---
title: Agent Architecture
applies_to: backend/agents/, backend/api/routes.py, anywhere a new agent or pipeline stage is proposed
priority: hard-rule
---

# Agent Architecture

PathProject is a three-stage agentic pipeline. Each stage has one job and a clean input/output contract. Keeping these layers separate is what lets us swap providers (mock → live Google, deterministic fallback → Groq Llama) without rewriting the system.

## The pipeline

```
Request
   │
   ▼
┌──────────────────────┐   raw multi-modal routes (RawRouteResult[])
│ 1. Routing Agent     │ ──────────────────────────────────────┐
│ agents/routing_agent │                                       │
└──────────────────────┘                                       ▼
                                                    ┌──────────────────────┐
                                                    │ 2. Emissions Agent   │
                                                    │ agents/emissions_..  │
                                                    └──────────────────────┘
                                                               │
                                                               │ RouteOption[] with per-segment CO2 + cost
                                                               ▼
                                                    ┌──────────────────────┐
                                                    │ 3. Decision Agent    │
                                                    │ agents/decision_a..  │
                                                    └──────────────────────┘
                                                               │
                                                               ▼
                                                       AgentReasoning
```

The orchestrator (`agents/orchestrator.py`) is the only file that calls all three agents in sequence. API routes call the orchestrator, never an agent directly.

## Stage responsibilities (and what each stage MUST NOT do)

### 1. Routing Agent — `agents/routing_agent.py`
- **Job:** fetch viable routes across requested modes from a routing provider (live Google Routes API or mock).
- **Allowed:** filter geometrically impractical routes (e.g. 40 km walks, 50 km bike rides), set default mode lists.
- **Forbidden:** computing emissions, computing dollar cost, ranking, recommending. The routing agent does not know what a gram of CO2 is.

### 2. Emissions Agent — `agents/emissions_agent.py`
- **Job:** apply per-segment emission and cost factors from `core/emission_factors.py` and produce a fully analyzed `RouteOption` per route.
- **Allowed:** the `find_greenest / find_fastest / find_cheapest / savings_vs_driving` extremum helpers (these are deterministic projections, not recommendations).
- **Forbidden:** calling out to LLMs, ranking by composite score, generating natural language. If you find yourself writing prose here, it belongs in the Decision Agent.

### 3. Decision Agent — `agents/decision_agent.py`
- **Job:** produce an `AgentReasoning` (recommended_mode, summary, justification, optional constraint_analysis) given the analyzed options and an optional user constraint.
- **Allowed:** call Groq Llama via the OpenAI-compatible client; fall back to the deterministic weighted-score function (`_score_option`) when no API key or on error.
- **Forbidden:** fetching new data, recomputing emissions, mutating route options. The decision agent reasons over what stages 1 and 2 produced; it never reaches around them.

## Cross-cutting rules

1. **One direction of dependency.** `decision_agent` may import from `emissions_agent` and `models.schemas`, but `emissions_agent` MUST NOT import from `decision_agent`, and `routing_agent` MUST NOT import from either of the others. Circular imports here mean the layers are bleeding.

2. **Pydantic models in `models/schemas.py` are the only inter-stage contract.** Agents do not pass dicts, dataclasses, or tuples between each other (the one allowed exception is `RawRouteResult` from `services/maps_client.py` → `emissions_agent`, because it is the boundary between the external provider and our internal model).

3. **Every external call has a fallback.** Live Google Routes failure → mock route (logged WARN). Groq failure → deterministic `_fallback_reasoning`. The `/plan-route` endpoint must never return a 500 because of an upstream provider outage.

4. **No real network calls in unit tests.** Tests in `backend/tests/` use the mock router and mock the Groq client. Integration tests that hit live APIs must be marked `@pytest.mark.integration` and excluded from the default `pytest` run.

5. **The orchestrator is sequential and explicit.** No magic auto-wiring, no agent registry, no plugin loader. If a new stage is needed, it is added as a named call in `plan_route()` / `plan_day()` so the pipeline is readable top-to-bottom.

## Adding a new agent

Before adding a fourth agent, ask: is this really a new stage, or does it belong inside an existing one?

A new stage is justified when it has its own external dependency (a new API or model), a clearly different responsibility, and produces a new field on the response model. Examples that *would* be a new stage: a Schedule Agent that resolves calendar conflicts, a Weather Agent that adjusts cycling viability. Examples that would NOT be: "a sub-agent that ranks options" (that's the Decision Agent), "a helper that converts units" (that's a utility function).

When you do add one:
1. Create `agents/<name>_agent.py` with a single async entry point.
2. Add a Pydantic model for its output to `models/schemas.py`.
3. Wire it into `orchestrator.py` as an explicit named stage. Update the docstring at the top of `orchestrator.py` to reflect the new pipeline diagram.
4. Add a deterministic fallback path so the orchestrator never raises if the new stage's external dependency is down.
5. Add a `tests/test_<name>_agent.py` covering the happy path, the fallback path, and at least one edge case.

## Live data is the default

The architecture is designed to run on live Google Maps + live Groq. Mock paths exist for local dev and tests, never as a production substitute. If a deployment is forced into a degraded mode (e.g. live key missing), the response model must indicate it via a `routing_mode` or `data_source` field — silent degradation is not allowed.
