# PathProject — Carbon-Aware Route Planner

An agentic multi-modal route planner that computes real-time carbon emissions for every transit option between two points, using verifiable EPA/IPCC emission factors.

## Architecture

```
Request → Routing Agent → Maps API (or mock) → Raw routes
                                                    ↓
                                              Emissions Agent → Per-segment CO2 analysis
                                                    ↓
                                              API Response → Ranked options with sources
```

### Agent Responsibilities

| Agent | Role |
|-------|------|
| **Routing Agent** | Fetches all viable routes across modes (driving, transit, bike, walk). Filters impractical options (e.g., 40km walk). |
| **Emissions Agent** | Applies EPA/IPCC emission factors per segment. Handles mixed-mode routes (walk → rail → walk) with segment-level accuracy. |
| **Decision Agent** | *(Phase 1.2)* Ranks options against user constraints, generates natural language justification. |

### Emission Factors

All factors sourced from:
- **EPA 2024** — Inventory of U.S. Greenhouse Gas Emissions and Sinks
- **IPCC AR6 WG3** — Chapter 10: Transport (2022)
- **FTA NTD 2023** — National Transit Database passenger-mile metrics

| Mode | g CO2e/pkm | Source |
|------|-----------|--------|
| Driving (solo) | 251 | EPA 2024 |
| Carpool (2) | 126 | EPA 2024 / 2 |
| Bus | 55 | FTA NTD 2023 |
| Light Rail | 22 | FTA NTD 2023 |
| Subway | 17 | FTA NTD 2023 |
| Rideshare | 300 | EPA 2024 + deadhead |
| Walking/Cycling | 0 | — |

## Quick Start

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The server starts on `http://localhost:8000` in mock mode (no API key needed).

### Example Request

```bash
curl -X POST http://localhost:8000/api/v1/plan-route \
  -H "Content-Type: application/json" \
  -d '{"origin":"33.4242,-111.9281","destination":"33.4484,-112.0740"}'
```

### Example Response (truncated)

```json
{
  "origin": "33.4242,-111.9281",
  "destination": "33.4484,-112.0740",
  "greenest": { "mode": "bicycling", "total_emissions_kg": 0.0 },
  "fastest": { "mode": "driving", "total_duration_min": 23.9 },
  "savings_vs_driving_kg": 4.503,
  "options": [ ... ]
}
```

### Switch to Live Routing

```bash
# .env
ROUTING_MODE=live
GOOGLE_MAPS_API_KEY=your_key_here
```

## Roadmap

- [x] **Phase 1.1** — Core emissions engine + single-route MVP
- [ ] **Phase 1.2** — Decision Agent with LLM-powered justification
- [ ] **Phase 1.3** — Google Calendar integration + schedule orchestration
- [ ] **Phase 1.4** — React/Next.js frontend with data visualizations

## Project Structure

```
backend/
├── agents/
│   ├── routing_agent.py       # Fetches multi-modal routes
│   └── emissions_agent.py     # Per-segment carbon analysis
├── api/
│   └── routes.py              # FastAPI endpoints
├── core/
│   ├── config.py              # Environment config
│   └── emission_factors.py    # EPA/IPCC verified dataset
├── models/
│   └── schemas.py             # Pydantic request/response models
├── services/
│   └── maps_client.py         # Google Maps client + mock fallback
└── main.py                    # Application entry point
```
