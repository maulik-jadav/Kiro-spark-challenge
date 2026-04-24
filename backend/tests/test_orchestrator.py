"""
Tests for agents/orchestrator.py
Verifies the full pipeline end-to-end in mock mode.
"""

import pytest
from agents.orchestrator import plan_route
from models.schemas import RouteComparison, AgentReasoning


class TestOrchestrator:
    @pytest.mark.asyncio
    async def test_returns_route_comparison(self):
        result = await plan_route("A", "B", routing_mode="mock")
        assert isinstance(result, RouteComparison)

    @pytest.mark.asyncio
    async def test_has_options(self):
        result = await plan_route("A", "B", routing_mode="mock")
        assert len(result.options) > 0

    @pytest.mark.asyncio
    async def test_has_greenest(self):
        result = await plan_route("A", "B", routing_mode="mock")
        assert result.greenest is not None

    @pytest.mark.asyncio
    async def test_has_fastest(self):
        result = await plan_route("A", "B", routing_mode="mock")
        assert result.fastest is not None

    @pytest.mark.asyncio
    async def test_has_cheapest(self):
        result = await plan_route("A", "B", routing_mode="mock")
        assert result.cheapest is not None

    @pytest.mark.asyncio
    async def test_has_reasoning(self):
        result = await plan_route("A", "B", routing_mode="mock")
        assert result.reasoning is not None
        assert isinstance(result.reasoning, AgentReasoning)

    @pytest.mark.asyncio
    async def test_options_sorted_by_emissions(self):
        result = await plan_route("A", "B", routing_mode="mock")
        emissions = [o.total_emissions_g for o in result.options]
        assert emissions == sorted(emissions)

    @pytest.mark.asyncio
    async def test_all_options_have_costs(self):
        result = await plan_route("A", "B", routing_mode="mock")
        for opt in result.options:
            assert opt.total_cost_usd >= 0
            assert opt.cost_source

    @pytest.mark.asyncio
    async def test_all_options_have_emissions(self):
        result = await plan_route("A", "B", routing_mode="mock")
        for opt in result.options:
            assert opt.total_emissions_g >= 0
            assert opt.emission_factor_source

    @pytest.mark.asyncio
    async def test_with_constraint(self):
        result = await plan_route("A", "B", constraint="Budget under $5", routing_mode="mock")
        assert result.reasoning is not None

    @pytest.mark.asyncio
    async def test_savings_vs_driving(self):
        result = await plan_route("A", "B", routing_mode="mock")
        assert result.savings_vs_driving_kg is not None
        assert result.savings_vs_driving_kg >= 0
