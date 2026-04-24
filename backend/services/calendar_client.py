"""
Google Calendar OAuth2 client.

Handles the OAuth authorization flow and calendar event fetching
using httpx directly (no Google SDK dependency).
"""

import secrets
from datetime import datetime, date
from urllib.parse import urlencode

import httpx

# Google OAuth endpoints
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3"

# Scopes needed: read-only calendar access
SCOPES = "https://www.googleapis.com/auth/calendar.readonly"

# In-memory token store keyed by session_id.
# In production, use a database or encrypted cookie.
_token_store: dict[str, dict] = {}


def generate_auth_url(client_id: str, redirect_uri: str) -> tuple[str, str]:
    """
    Build the Google OAuth2 authorization URL.

    Returns:
        (auth_url, state) — redirect the user to auth_url,
        and verify the state param on callback.
    """
    state = secrets.token_urlsafe(32)

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }

    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}", state


async def exchange_code_for_tokens(
    code: str,
    client_id: str,
    client_secret: str,
    redirect_uri: str,
) -> dict:
    """
    Exchange the authorization code for access + refresh tokens.

    Returns the token response dict and stores it internally.
    """
    payload = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data=payload)
        resp.raise_for_status()
        tokens = resp.json()

    # Store tokens under a new session id
    session_id = secrets.token_urlsafe(32)
    _token_store[session_id] = {
        "access_token": tokens["access_token"],
        "refresh_token": tokens.get("refresh_token"),
        "expires_in": tokens.get("expires_in"),
    }

    return {"session_id": session_id, **tokens}


async def refresh_access_token(
    session_id: str,
    client_id: str,
    client_secret: str,
) -> str:
    """Refresh an expired access token using the stored refresh token."""
    stored = _token_store.get(session_id)
    if not stored or not stored.get("refresh_token"):
        raise ValueError("No refresh token available for this session.")

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": stored["refresh_token"],
        "grant_type": "refresh_token",
    }

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data=payload)
        resp.raise_for_status()
        tokens = resp.json()

    stored["access_token"] = tokens["access_token"]
    return tokens["access_token"]


async def fetch_events(
    session_id: str,
    target_date: date,
    client_id: str = "",
    client_secret: str = "",
) -> list[dict]:
    """
    Fetch calendar events for a specific date.

    Returns a list of event dicts with:
      - summary, location, start, end
    """
    stored = _token_store.get(session_id)
    if not stored:
        raise ValueError("Invalid session. Please re-authenticate.")

    access_token = stored["access_token"]

    # Build time range for the target date (full day, UTC)
    time_min = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0).isoformat() + "Z"
    time_max = datetime(target_date.year, target_date.month, target_date.day, 23, 59, 59).isoformat() + "Z"

    params = {
        "timeMin": time_min,
        "timeMax": time_max,
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": 20,
    }

    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            f"{GOOGLE_CALENDAR_API}/calendars/primary/events",
            params=params,
            headers=headers,
        )

        # If token expired, try refreshing once
        if resp.status_code == 401 and client_id and client_secret:
            access_token = await refresh_access_token(session_id, client_id, client_secret)
            headers = {"Authorization": f"Bearer {access_token}"}
            resp = await client.get(
                f"{GOOGLE_CALENDAR_API}/calendars/primary/events",
                params=params,
                headers=headers,
            )

        resp.raise_for_status()
        data = resp.json()

    events = []
    for item in data.get("items", []):
        # Skip all-day events (no dateTime field)
        start = item.get("start", {})
        end = item.get("end", {})
        if "dateTime" not in start:
            continue

        events.append({
            "summary": item.get("summary", "Untitled"),
            "location": item.get("location", ""),
            "start": start["dateTime"],
            "end": end["dateTime"],
        })

    return events


def get_session(session_id: str) -> dict | None:
    """Check if a session exists."""
    return _token_store.get(session_id)


# ---------------------------------------------------------------------------
# Mock calendar (for testing without OAuth)
# ---------------------------------------------------------------------------

def mock_events(target_date: date) -> list[dict]:
    """
    Return synthetic calendar events around ASU / Phoenix metro.

    Uses real lat,lng coordinates so the mock router's haversine
    produces accurate distances:
      - On-campus hops (< 1 km) → walking/bicycling viable
      - Tempe → Downtown Phoenix (~15 km) → light rail / driving
    """
    d = target_date.isoformat()
    return [
        {
            "summary": "CSE 310 Lecture — Brickyard (BYENG)",
            "location": "33.4242,-111.9400",
            "start": f"{d}T08:30:00-07:00",
            "end": f"{d}T09:45:00-07:00",
        },
        {
            "summary": "Study group — Hayden Library",
            "location": "33.4185,-111.9348",
            "start": f"{d}T10:15:00-07:00",
            "end": f"{d}T11:30:00-07:00",
        },
        {
            "summary": "Lunch — Culinary Dropout",
            "location": "33.4265,-111.9380",
            "start": f"{d}T12:00:00-07:00",
            "end": f"{d}T13:00:00-07:00",
        },
        {
            "summary": "Internship interview — ASU Downtown Phoenix",
            "location": "33.4516,-112.0740",
            "start": f"{d}T14:30:00-07:00",
            "end": f"{d}T15:30:00-07:00",
        },
        {
            "summary": "Hackathon prep — Sun Devil Fitness Complex",
            "location": "33.4165,-111.9340",
            "start": f"{d}T17:00:00-07:00",
            "end": f"{d}T18:30:00-07:00",
        },
    ]
