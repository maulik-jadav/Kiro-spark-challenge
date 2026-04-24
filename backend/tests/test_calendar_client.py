"""
Tests for services/calendar_client.py
Verifies OAuth helpers, mock events, and token store.
"""

import pytest
from datetime import date
from services.calendar_client import (
    generate_auth_url,
    mock_events,
    get_session,
    _token_store,
)


# ---------------------------------------------------------------------------
# OAuth URL generation
# ---------------------------------------------------------------------------

class TestGenerateAuthUrl:
    def test_returns_url_and_state(self):
        url, state = generate_auth_url("test-client-id", "http://localhost:8000/callback")
        assert isinstance(url, str)
        assert isinstance(state, str)
        assert len(state) > 10

    def test_url_contains_client_id(self):
        url, _ = generate_auth_url("my-client-id", "http://localhost/cb")
        assert "my-client-id" in url

    def test_url_contains_redirect_uri(self):
        url, _ = generate_auth_url("cid", "http://localhost:8000/callback")
        assert "localhost" in url

    def test_url_contains_calendar_scope(self):
        url, _ = generate_auth_url("cid", "http://localhost/cb")
        assert "calendar" in url

    def test_url_requests_offline_access(self):
        url, _ = generate_auth_url("cid", "http://localhost/cb")
        assert "offline" in url

    def test_state_is_unique_per_call(self):
        _, s1 = generate_auth_url("cid", "http://localhost/cb")
        _, s2 = generate_auth_url("cid", "http://localhost/cb")
        assert s1 != s2


# ---------------------------------------------------------------------------
# Mock events
# ---------------------------------------------------------------------------

class TestMockEvents:
    def test_returns_list(self):
        events = mock_events(date(2026, 4, 24))
        assert isinstance(events, list)
        assert len(events) > 0

    def test_events_have_required_fields(self):
        events = mock_events(date(2026, 4, 24))
        for e in events:
            assert "summary" in e
            assert "location" in e
            assert "start" in e
            assert "end" in e

    def test_events_are_on_target_date(self):
        d = date(2026, 5, 15)
        events = mock_events(d)
        for e in events:
            assert "2026-05-15" in e["start"]
            assert "2026-05-15" in e["end"]

    def test_events_are_in_chronological_order(self):
        events = mock_events(date(2026, 4, 24))
        starts = [e["start"] for e in events]
        assert starts == sorted(starts)

    def test_locations_are_latlng(self):
        """Mock events use lat,lng for accurate haversine routing."""
        events = mock_events(date(2026, 4, 24))
        for e in events:
            parts = e["location"].split(",")
            assert len(parts) == 2
            lat, lng = float(parts[0]), float(parts[1])
            # Phoenix metro area
            assert 33.0 < lat < 34.0
            assert -113.0 < lng < -111.0

    def test_includes_campus_and_downtown(self):
        """Should have both on-campus and downtown Phoenix events."""
        events = mock_events(date(2026, 4, 24))
        summaries = " ".join(e["summary"] for e in events)
        assert "Downtown" in summaries or "Phoenix" in summaries

    def test_has_at_least_4_events(self):
        events = mock_events(date(2026, 4, 24))
        assert len(events) >= 4

    def test_events_have_gaps_between_them(self):
        """Events should not overlap — there must be gaps for transit."""
        events = mock_events(date(2026, 4, 24))
        for i in range(len(events) - 1):
            assert events[i]["end"] <= events[i + 1]["start"]


# ---------------------------------------------------------------------------
# Token store
# ---------------------------------------------------------------------------

class TestTokenStore:
    def test_get_session_nonexistent(self):
        assert get_session("nonexistent-session-id") is None

    def test_get_session_existing(self):
        _token_store["test-session"] = {
            "access_token": "tok123",
            "refresh_token": "ref456",
        }
        result = get_session("test-session")
        assert result is not None
        assert result["access_token"] == "tok123"
        # Cleanup
        del _token_store["test-session"]
