"""
Tests for the day planning pipeline (Phase 1.3).
Tests the orchestrator's plan_day function and the transit window logic.
"""

import pytest
import pytest_asyncio
from datetime import date
from agents.orchestrator import plan_day, _build_transit_windows, _parse_dt
from models.schemas import DayPlanResponse, TransitWindow, TransitRecommendation
from services.calendar_client import mock_events


# ---------------------------------------------------------------------------
# _parse_dt
# ---------------------------------------------------------------------------

class TestParseDatetime:
    def test_parse_with_offset(self):
        dt = _parse_dt("2026-04-24T09:00:00-07:00")
        assert dt.hour == 9
        assert dt.minute == 0

    def test_parse_with_z(self):
        dt = _parse_dt("2026-04-24T16:00:00Z")
        assert dt.hour == 16

    def test_parse_iso_format(self):
        dt = _parse_dt("2026-04-24T14:30:00+00:00")
        assert dt.hour == 14
        assert dt.minute == 30


# ---------------------------------------------------------------------------
# _build_transit_windows
# ---------------------------------------------------------------------------

class TestBuildTransitWindows:
    def test_with_mock_events(self):
        events = mock_events(date(2026, 4, 24))
        windows = _build_transit_windows(events, home_address="")
        assert len(windows) > 0

    def test_windows_between_consecutive_events(self):
        events = mock_events(date(2026, 4, 24))
        windows = _build_transit_windows(events, home_address="")
        # Should have a window between each pair with different locations
        assert len(windows) >= 3

    def test_includes_home_to_first_event(self):
        events = mock_events(date(2026, 4, 24))
        windows = _build_transit_windows(events, home_address="33.4145,-111.9265")
        assert windows[0]["from_event"] == "Home"

    def test_includes_last_event_to_home(self):
        events = mock_events(date(2026, 4, 24))
        windows = _build_transit_windows(events, home_address="33.4145,-111.9265")
        assert windows[-1]["to_event"] == "Home"

    def test_no_home_windows_without_home_address(self):
        events = mock_events(date(2026, 4, 24))
        windows = _build_transit_windows(events, home_address="")
        from_events = [w["from_event"] for w in windows]
        to_events = [w["to_event"] for w in windows]
        assert "Home" not in from_events
        assert "Home" not in to_events

    def test_available_min_is_correct(self):
        events = [
            {"summary": "A", "location": "33.4,-111.9", "start": "2026-04-24T09:00:00-07:00", "end": "2026-04-24T10:00:00-07:00"},
            {"summary": "B", "location": "33.5,-111.8", "start": "2026-04-24T11:30:00-07:00", "end": "2026-04-24T12:30:00-07:00"},
        ]
        windows = _build_transit_windows(events, home_address="")
        assert windows[0]["available_min"] == 90.0

    def test_skips_events_without_location(self):
        events = [
            {"summary": "A", "location": "33.4,-111.9", "start": "2026-04-24T09:00:00-07:00", "end": "2026-04-24T10:00:00-07:00"},
            {"summary": "B", "location": "", "start": "2026-04-24T11:00:00-07:00", "end": "2026-04-24T12:00:00-07:00"},
        ]
        windows = _build_transit_windows(events, home_address="")
        assert len(windows) == 0

    def test_skips_same_location(self):
        events = [
            {"summary": "A", "location": "33.4,-111.9", "start": "2026-04-24T09:00:00-07:00", "end": "2026-04-24T10:00:00-07:00"},
            {"summary": "B", "location": "33.4,-111.9", "start": "2026-04-24T11:00:00-07:00", "end": "2026-04-24T12:00:00-07:00"},
        ]
        windows = _build_transit_windows(events, home_address="")
        assert len(windows) == 0

    def test_empty_events(self):
        windows = _build_transit_windows([], home_address="33.4,-111.9")
        assert len(windows) == 0

    def test_single_event_with_home(self):
        events = [
            {"summary": "A", "location": "33.5,-111.8", "start": "2026-04-24T09:00:00-07:00", "end": "2026-04-24T10:00:00-07:00"},
        ]
        windows = _build_transit_windows(events, home_address="33.4,-111.9")
        # Home -> A and A -> Home
        assert len(windows) == 2
        assert windows[0]["from_event"] == "Home"
        assert windows[1]["to_event"] == "Home"

    def test_window_has_all_required_fields(self):
        events = mock_events(date(2026, 4, 24))
        windows = _build_transit_windows(events, home_address="33.4145,-111.9265")
        for w in windows:
            assert "from_event" in w
            assert "to_event" in w
            assert "origin" in w
            assert "destination" in w
            assert "depart_after" in w
            assert "arrive_by" in w
            assert "available_min" in w


# ---------------------------------------------------------------------------
# plan_day (full pipeline)
# ---------------------------------------------------------------------------

class TestPlanDay:
    @pytest.mark.asyncio
    async def test_returns_day_plan_response(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        assert isinstance(result, DayPlanResponse)

    @pytest.mark.asyncio
    async def test_has_events(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        assert len(result.events) >= 4

    @pytest.mark.asyncio
    async def test_has_transit_windows(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        assert len(result.transit_windows) > 0

    @pytest.mark.asyncio
    async def test_transit_windows_have_recommendations(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        for tw in result.transit_windows:
            assert isinstance(tw.recommended, TransitRecommendation)
            assert tw.recommended.duration_min > 0
            assert tw.recommended.cost_usd >= 0
            assert tw.recommended.emissions_g >= 0
            assert len(tw.recommended.summary) > 0

    @pytest.mark.asyncio
    async def test_transit_windows_have_route_comparison(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        for tw in result.transit_windows:
            assert tw.route is not None
            assert len(tw.route.options) > 0
            assert tw.route.reasoning is not None

    @pytest.mark.asyncio
    async def test_day_totals_are_positive(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        assert result.total_emissions_g >= 0
        assert result.total_cost_usd >= 0
        assert result.total_transit_min > 0

    @pytest.mark.asyncio
    async def test_day_totals_match_window_sums(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        sum_emissions = sum(tw.recommended.emissions_g for tw in result.transit_windows)
        sum_cost = sum(tw.recommended.cost_usd for tw in result.transit_windows)
        sum_time = sum(tw.recommended.duration_min for tw in result.transit_windows)
        assert abs(result.total_emissions_g - sum_emissions) < 1.0
        assert abs(result.total_cost_usd - sum_cost) < 0.1
        assert abs(result.total_transit_min - sum_time) < 1.0

    @pytest.mark.asyncio
    async def test_with_home_address(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            home_address="33.4145,-111.9265",
            routing_mode="mock",
        )
        from_events = [tw.from_event for tw in result.transit_windows]
        to_events = [tw.to_event for tw in result.transit_windows]
        assert "Home" in from_events
        assert "Home" in to_events

    @pytest.mark.asyncio
    async def test_without_home_address(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        from_events = [tw.from_event for tw in result.transit_windows]
        to_events = [tw.to_event for tw in result.transit_windows]
        assert "Home" not in from_events
        assert "Home" not in to_events

    @pytest.mark.asyncio
    async def test_date_in_response(self):
        result = await plan_day(
            target_date=date(2026, 4, 24),
            routing_mode="mock",
        )
        assert result.date == "2026-04-24"

    @pytest.mark.asyncio
    async def test_varied_recommendations(self):
        """Short campus hops should not all be the same mode as long trips."""
        result = await plan_day(
            target_date=date(2026, 4, 24),
            home_address="33.4145,-111.9265",
            routing_mode="mock",
        )
        modes = {tw.recommended.mode for tw in result.transit_windows}
        assert len(modes) > 1, "All transit windows recommend the same mode — should vary by distance"

    @pytest.mark.asyncio
    async def test_short_trips_prefer_active_transit(self):
        """On-campus trips (< 1km) should recommend walking or bicycling."""
        result = await plan_day(
            target_date=date(2026, 4, 24),
            home_address="33.4145,-111.9265",
            routing_mode="mock",
        )
        active_modes = {"walking", "bicycling"}
        # At least one short trip should be active transit
        short_trip_modes = [
            tw.recommended.mode.value
            for tw in result.transit_windows
            if tw.recommended.duration_min < 10
        ]
        assert any(m in active_modes for m in short_trip_modes)


# ---------------------------------------------------------------------------
# plan-day API endpoint
# ---------------------------------------------------------------------------

class TestPlanDayEndpoint:
    @pytest.fixture
    def app(self):
        import os
        os.environ["ROUTING_MODE"] = "mock"
        os.environ["GROQ_API_KEY"] = ""
        from core.config import get_settings
        get_settings.cache_clear()
        from main import create_app
        a = create_app()
        yield a
        get_settings.cache_clear()

    @pytest_asyncio.fixture
    async def client(self, app):
        from httpx import AsyncClient, ASGITransport
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

    @pytest.mark.asyncio
    async def test_plan_day_endpoint(self, client):
        resp = await client.post("/api/v1/plan-day", json={
            "date": "2026-04-24",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["date"] == "2026-04-24"
        assert len(data["events"]) > 0
        assert len(data["transit_windows"]) > 0

    @pytest.mark.asyncio
    async def test_plan_day_with_home(self, client):
        resp = await client.post("/api/v1/plan-day", json={
            "date": "2026-04-24",
            "home_address": "33.4145,-111.9265",
        })
        assert resp.status_code == 200
        data = resp.json()
        froms = [tw["from_event"] for tw in data["transit_windows"]]
        assert "Home" in froms

    @pytest.mark.asyncio
    async def test_plan_day_has_totals(self, client):
        resp = await client.post("/api/v1/plan-day", json={
            "date": "2026-04-24",
        })
        data = resp.json()
        assert "total_emissions_g" in data
        assert "total_cost_usd" in data
        assert "total_transit_min" in data

    @pytest.mark.asyncio
    async def test_plan_day_windows_have_recommended(self, client):
        resp = await client.post("/api/v1/plan-day", json={
            "date": "2026-04-24",
        })
        data = resp.json()
        for tw in data["transit_windows"]:
            assert "recommended" in tw
            rec = tw["recommended"]
            assert "mode" in rec
            assert "duration_min" in rec
            assert "emissions_g" in rec
            assert "cost_usd" in rec
            assert "summary" in rec

    @pytest.mark.asyncio
    async def test_plan_day_invalid_date(self, client):
        resp = await client.post("/api/v1/plan-day", json={
            "date": "not-a-date",
        })
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_plan_day_invalid_session(self, client):
        resp = await client.post("/api/v1/plan-day", json={
            "date": "2026-04-24",
            "session_id": "fake-session-id",
        })
        assert resp.status_code == 401

    @pytest.mark.asyncio
    async def test_auth_google_no_config(self, client):
        """Should return 503 when OAuth is not configured."""
        resp = await client.get("/api/v1/auth/google")
        assert resp.status_code == 503
