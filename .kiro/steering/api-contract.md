---
title: API Contract
applies_to: backend/models/schemas.py, backend/api/routes.py, frontend/src/types/api.ts, frontend/src/lib/api.ts
priority: hard-rule
---

# API Contract

The frontend and backend are developed against a single shared contract. Drift between them is the most expensive bug class in this project — a silently-renamed field can take down both the route view and the day planner without any test catching it. These rules exist to prevent that.

## Source of truth

**Pydantic models in `backend/models/schemas.py` are the single source of truth for every request and response shape.** TypeScript types in `frontend/src/types/api.ts` mirror them — they never lead, they never extend, and they never contain fields that don't exist server-side.

When in conflict, the Pydantic model wins. The TypeScript types are updated to match.

## Hard rules

1. **No untyped responses.** Every FastAPI route in `backend/api/routes.py` declares a `response_model=...` pointing at a Pydantic class. Routes returning raw `dict` or `JSONResponse` without a model are not allowed (the only exception is `/auth/callback` which intentionally redirects).

2. **No untyped requests.** Every POST route accepts a Pydantic request model (`RouteRequest`, `DayPlanRequest`). Query/path params are typed with their Python type so FastAPI generates the right OpenAPI schema.

3. **`TransitMode` enum is shared verbatim.** The string values in `core/emission_factors.TransitMode` (`"driving"`, `"light_rail"`, `"bus"`, etc.) are the wire format. The TS `TransitMode` union must list exactly these strings — no aliases, no display-name variants. Display formatting (`"light_rail"` → `"Light Rail"`) happens in the UI layer only.

4. **Field names use `snake_case` on the wire.** Pydantic models use snake_case attributes; TS types match. No `camelCase` aliasing, no Pydantic `alias_generator`. This keeps the OpenAPI schema, the JSON, the Python code, and the TS types all reading the same.

5. **Optional fields are explicit.** A field that can be absent or null is typed `T | None = None` in Pydantic and `T | null` in TS. A field that's always present has no `| None` and no default. Don't paper over uncertainty with `Optional[...]` everywhere.

6. **Versioned URL prefix.** All routes are under `/api/v1/...`. Breaking changes to a response shape require a new prefix (`/api/v2/...`), not a silent in-place mutation.

## When a model changes

Any edit to `backend/models/schemas.py` triggers a checklist:

1. Update the matching interface in `frontend/src/types/api.ts`.
2. Update any consumer in `frontend/src/lib/api.ts` and the components that read the field.
3. If a field was removed or renamed, grep both `backend/` and `frontend/src/` for the old name to catch missed references.
4. Update `backend/tests/test_api.py` to assert the new shape — at minimum, that the field exists in the response and has the right type.
5. Update the relevant `.kiro/specs/*/design.md` if the change affects an existing spec's documented contract.

## Endpoints currently in the contract

These are the endpoints the frontend depends on. Any of them being silently removed or renamed is a release blocker.

| Method | Path | Request model | Response model |
|--------|------|---------------|----------------|
| GET    | `/api/v1/health`         | —                  | `HealthResponse` |
| POST   | `/api/v1/plan-route`     | `RouteRequest`     | `RouteComparison` |
| GET    | `/api/v1/auth/google`    | —                  | `AuthUrlResponse` |
| GET    | `/api/v1/auth/callback`  | query: `code`, `state` | `AuthCallbackResponse` (or redirect) |
| POST   | `/api/v1/plan-day`       | `DayPlanRequest`   | `DayPlanResponse` |

**Frontend-expected endpoints not yet implemented** (drift in progress — fix before next release): `frontend/src/lib/api.ts` calls `GET /api/v1/emission-factors` and `GET /api/v1/cost-factors`. These have TypeScript types (`EmissionFactorResponse`, `CostFactorResponse`) but no backend route. Either implement the backend routes (preferred — the data is right there in `core/emission_factors.py`) or remove the frontend functions. Don't let this drift sit.

## Error responses

Errors come back in a single consistent shape so `frontend/src/lib/api.ts::ApiError` can parse them:

```json
{
  "status_code": 422,
  "message": "Validation failed",
  "detail": "...",
  "errors": [{"field": "date", "reason": "Invalid date format"}]
}
```

- `422` is reserved for request validation failures. The frontend renders these as inline field errors using `errors[].field`.
- `401` is reserved for missing/expired session — the frontend prompts the user to re-authenticate.
- `503` is reserved for "feature not configured" (e.g. OAuth credentials missing). The frontend surfaces this as a friendly "not configured" message, not a generic error.
- All other 4xx/5xx use the same shape with `errors: null`.

## Real data only

Response payloads contain real, currently-computed values. There are no hardcoded sample responses, no committed JSON fixtures returned in place of a real call, and no `if request.origin == "demo": return CACHED_DEMO_RESPONSE` shortcuts. If a demo flow is needed, build it on top of the mock router (which still runs the real pipeline) — not by short-circuiting the contract.
