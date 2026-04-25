"""
Tests for api/routes.py
Integration tests hitting the FastAPI endpoints directly.
"""

import os
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

from httpx import AsyncClient, ASGITransport
from main import create_app
from services.maps_client import RawRouteResult
from core.emission_factors import TransitMode


def _mock_raw_routes(origin="A", destination="B", modes=None):
    """Return a set of fake RawRouteResults for testing the pipeline."""
    all_routes = [
        RawRouteResult(
            mode=TransitMode.DRIVING,
            distance_km=15.0,
            duration_min=20.0,
            segments=[{
                "mode": "driving",
                "distance_km": 15.0,
                "duration_min": 20.0,
                "description": "driving for 15.0 km",
            }],
        ),
        RawRouteResult(
            mode=TransitMode.BUS,
            distance_km=16.0,
            duration_min=35.0,
            segments=[
                {"mode": "walking", "distance_km": 0.4, "duration_min": 4.8, "description": "Walk to station"},
                {"mode": "bus", "distance_km": 15.2, "duration_min": 25.2, "description": "bus (15.2 km)"},
                {"mode": "walking", "distance_km": 0.3, "duration_min": 3.6, "description": "Walk to destination"},
            ],
        ),
        RawRouteResult(
            mode=TransitMode.BICYCLING,
            distance_km=14.0,
            duration_min=45.0,
            segments=[{
                "mode": "bicycling",
                "distance_km": 14.0,
                "duration_min": 45.0,
                "description": "bicycling for 14.0 km",
            }],
        ),
        RawRouteResult(
            mode=TransitMode.WALKING,
            distance_km=13.0,
            duration_min=160.0,
            segments=[{
                "mode": "walking",
                "distance_km": 13.0,
                "duration_min": 160.0,
                "description": "walking for 13.0 km",
            }],
        ),
        RawRouteResult(
            mode=TransitMode.LIGHT_RAIL,
            distance_km=16.5,
            duration_min=30.0,
            segments=[
                {"mode": "walking", "distance_km": 0.4, "duration_min": 4.8, "description": "Walk to station"},
                {"mode": "light_rail", "distance_km": 15.7, "duration_min": 20.2, "description": "light_rail (15.7 km)"},
                {"mode": "walking", "distance_km": 0.3, "duration_min": 3.6, "description": "Walk to destination"},
            ],
        ),
        RawRouteResult(
            mode=TransitMode.RIDESHARE,
            distance_km=15.0,
            duration_min=22.0,
            segments=[{
                "mode": "rideshare",
                "distance_km": 15.0,
                "duration_min": 22.0,
                "description": "rideshare for 15.0 km",
            }],
        ),
    ]

    if modes:
        return [r for r in all_routes if r.mode in modes]
    return all_routes


@pytest.fixture
def app():
    """Create a test app."""
    os.environ["GROQ_API_KEY"] = ""  # force fallback
    # Clear the cached settings so env changes take effect
    from core.config import get_settings
    get_settings.cache_clear()
    a = create_app()
    yield a
    get_settings.cache_clear()


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


class TestHealthEndpoint:
    @pytest.mark.asyncio
    async def test_health(self, client):
        resp = await client.get("/api/v1/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "routing_mode" not in data
        assert "version" in data


class TestPlanRouteEndpoint:
    @pytest.mark.asyncio
    async def test_basic_request(self, client):
        with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock_get_routes:
            mock_get_routes.return_value = _mock_raw_routes()
            resp = await client.post("/api/v1/plan-route", json={
                "origin": "San Francisco, CA",
                "destination": "Oakland, CA",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["origin"] == "San Francisco, CA"
        assert data["destination"] == "Oakland, CA"
        assert len(data["options"]) > 0

    @pytest.mark.asyncio
    async def test_response_has_all_fields(self, client):
        with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock_get_routes:
            mock_get_routes.return_value = _mock_raw_routes()
            resp = await client.post("/api/v1/plan-route", json={
                "origin": "A",
                "destination": "B",
            })
        data = resp.json()
        assert "options" in data
        assert "greenest" in data
        assert "fastest" in data
        assert "cheapest" in data
        assert "savings_vs_driving_kg" in data
        assert "reasoning" in data

    @pytest.mark.asyncio
    async def test_options_have_cost_fields(self, client):
        with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock_get_routes:
            mock_get_routes.return_value = _mock_raw_routes()
            resp = await client.post("/api/v1/plan-route", json={
                "origin": "A",
                "destination": "B",
            })
        data = resp.json()
        for opt in data["options"]:
            assert "total_cost_usd" in opt
            assert "cost_source" in opt
            assert opt["total_cost_usd"] >= 0

    @pytest.mark.asyncio
    async def test_options_have_emission_fields(self, client):
        with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock_get_routes:
            mock_get_routes.return_value = _mock_raw_routes()
            resp = await client.post("/api/v1/plan-route", json={
                "origin": "A",
                "destination": "B",
            })
        data = resp.json()
        for opt in data["options"]:
            assert "total_emissions_g" in opt
            assert "total_emissions_kg" in opt
            assert "emission_factor_source" in opt

    @pytest.mark.asyncio
    async def test_segments_have_cost(self, client):
        with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock_get_routes:
            mock_get_routes.return_value = _mock_raw_routes()
            resp = await client.post("/api/v1/plan-route", json={
                "origin": "A",
                "destination": "B",
            })
        data = resp.json()
        for opt in data["options"]:
            for seg in opt["segments"]:
                assert "cost_usd" in seg
                assert "emissions_g" in seg

    @pytest.mark.asyncio
    async def test_with_constraint(self, client):
        with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock_get_routes:
            mock_get_routes.return_value = _mock_raw_routes()
            resp = await client.post("/api/v1/plan-route", json={
                "origin": "A",
                "destination": "B",
                "constraint": "I need the cheapest option",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["reasoning"] is not None

    @pytest.mark.asyncio
    async def test_with_specific_modes(self, client):
        with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock_get_routes:
            mock_get_routes.return_value = _mock_raw_routes(
                modes=[TransitMode.DRIVING, TransitMode.BUS]
            )
            resp = await client.post("/api/v1/plan-route", json={
                "origin": "A",
                "destination": "B",
                "modes": ["driving", "bus"],
            })
        assert resp.status_code == 200
        data = resp.json()
        modes = {opt["mode"] for opt in data["options"]}
        assert modes == {"driving", "bus"}

    @pytest.mark.asyncio
    async def test_sorted_by_emissions(self, client):
        with patch("agents.orchestrator.get_routes", new_callable=AsyncMock) as mock_get_routes:
            mock_get_routes.return_value = _mock_raw_routes()
            resp = await client.post("/api/v1/plan-route", json={
                "origin": "A",
                "destination": "B",
            })
        data = resp.json()
        emissions = [opt["total_emissions_g"] for opt in data["options"]]
        assert emissions == sorted(emissions)

    @pytest.mark.asyncio
    async def test_missing_origin_returns_422(self, client):
        resp = await client.post("/api/v1/plan-route", json={
            "destination": "B",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_missing_destination_returns_422(self, client):
        resp = await client.post("/api/v1/plan-route", json={
            "origin": "A",
        })
        assert resp.status_code == 422
