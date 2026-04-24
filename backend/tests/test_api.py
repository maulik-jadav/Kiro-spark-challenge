"""
Tests for api/routes.py
Integration tests hitting the FastAPI endpoints directly.
"""

import os
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import create_app


@pytest.fixture
def app():
    """Create a test app with mock routing mode."""
    os.environ["ROUTING_MODE"] = "mock"
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
        assert data["routing_mode"] == "mock"
        assert "version" in data


class TestPlanRouteEndpoint:
    @pytest.mark.asyncio
    async def test_basic_request(self, client):
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
