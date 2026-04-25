---
title: Emission Factors Policy
applies_to: backend/core/emission_factors.py, anywhere new TransitMode values, factors, or cost factors are introduced
priority: hard-rule
---

# Emission Factors Policy

The credibility of PathProject rests on every gram of CO2e being traceable to a real, verifiable public dataset. Numbers without citations are not acceptable in this codebase, even temporarily.

## Hard rules

1. **Every `EmissionFactor` and `CostFactor` MUST have a non-empty `source` string** that names the publishing organization AND the publication year (e.g. `"EPA 2024 – avg passenger vehicle, single occupancy"`). Generic strings like `"estimated"`, `"approx"`, `"rough"`, `"TBD"`, `"placeholder"`, or `"synthetic"` are not allowed.

2. **Approved primary sources** — prefer these in this order:
   - **EPA** — Inventory of U.S. Greenhouse Gas Emissions and Sinks (current/most recent year)
   - **IPCC AR6 WG3, Chapter 10: Transport** (2022)
   - **FTA National Transit Database (NTD)** — passenger-mile metrics, current year
   - **AAA "Your Driving Costs"** — cost factors for personal vehicles, current year
   - **Local transit agency published fares** (e.g. NYC MTA, BART, Valley Metro) — for `base_fare` values, cite the agency by name and year

   Secondary sources (DEFRA, ICCT, peer-reviewed journals) may be used only when no primary source covers the mode. If you reach for a secondary source, add a one-line `notes=` explaining why a primary source did not apply.

3. **Units are fixed.** Emission factors are `g CO2e/pkm` (grams CO2-equivalent per passenger-kilometer). Cost factors are `USD` for `base_fare` and `USD/km` for `per_km_cost`. Do not introduce per-mile, per-mph, or kg-based factors — convert at ingestion time and cite the conversion (e.g. `400 g CO2/mi ÷ 1.609 = 251 g CO2/km`).

4. **No synthetic, fabricated, or LLM-generated factors.** If a number cannot be traced to a published dataset by URL or document title, it does not ship. The mock router in `services/maps_client.py` is permitted to synthesize *distances and durations* for local dev, but it must never invent emission or cost numbers — those always flow through the canonical `EMISSION_FACTORS` / `COST_FACTORS` tables.

5. **Updates require a commit message that names the source.** When changing an existing factor, the commit message must say where the new number came from (e.g. `"Update bus factor: FTA NTD 2023 → 2024 release"`). Silent number changes are a regression risk.

## When adding a new TransitMode

When the user asks to add a new mode (e.g. `FERRY`, `ELECTRIC_BUS`, `HIGH_SPEED_RAIL`):

1. Add the enum value to `TransitMode` in `core/emission_factors.py`.
2. Add an `EmissionFactor` entry — required fields: `mode`, `g_co2e_per_pkm`, `source`. Add `notes` if the source needed interpretation.
3. Add a `CostFactor` entry with `base_fare`, `per_km_cost`, and `source`.
4. Add the mode to `_MOCK_SPEEDS` and `_DETOUR` in `services/maps_client.py` so mock routes work, citing a reasonable real-world average for the speed.
5. If the mode is realistically multi-segment (rail-like), add it to the `multi_segment_modes` set in `_build_transit_segments`.
6. Add to `_MODE_TO_GOOGLE` in `services/maps_client.py` so live routing maps it to the closest Google travelMode.
7. Add a unit test in `backend/tests/test_emission_factors.py` that asserts the factor is in expected range (sanity-bound the number against a published comparable mode).

## When the user asks for a quick estimate

If the user says "just give me a rough number for X", refuse and offer to look up the real factor. A wrong-but-plausible number quietly poisoning every downstream comparison is a worse outcome than a 30-second pause to find a real source.

## Live routing only — no mock by default in production

Production deployments must run with `routing_mode=live` and a configured `GOOGLE_MAPS_API_KEY`. The mock router exists for local development and tests only. Any code path that would silently fall back to mock data in production must log a `WARNING` and surface a `routing_mode_degraded: true` flag in the response so the caller knows the data is synthetic. Do not silently substitute mock results for live results.
