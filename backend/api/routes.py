"""
API routes — powered by the multi-agent orchestrator.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse

from agents.orchestrator import plan_route as orchestrate, plan_day as orchestrate_day
from core.config import Settings, get_settings
from models.schemas import (
    RouteRequest,
    RouteComparison,
    DayPlanRequest,
    DayPlanResponse,
    AuthUrlResponse,
    AuthCallbackResponse,
    HealthResponse,
)
from services.calendar_client import (
    generate_auth_url,
    exchange_code_for_tokens,
    get_session,
)


router = APIRouter()


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

@router.get("/health", response_model=HealthResponse)
async def health(settings: Settings = Depends(get_settings)):
    return HealthResponse()


# ---------------------------------------------------------------------------
# Phase 1.1 + 1.2: Single route comparison with agentic reasoning
# ---------------------------------------------------------------------------

@router.post("/plan-route", response_model=RouteComparison)
async def plan_route(
    req: RouteRequest,
    settings: Settings = Depends(get_settings),
):
    """
    Core endpoint — runs the full agent pipeline:
      1. Routing Agent fetches all route options
      2. Emissions Agent computes carbon + cost per option
      3. Decision Agent reasons about trade-offs and recommends
    """
    return await orchestrate(
        origin=req.origin,
        destination=req.destination,
        modes=req.modes,
        constraint=req.constraint,
        google_maps_api_key=settings.google_maps_api_key,
        groq_api_key=settings.groq_api_key,
    )


# ---------------------------------------------------------------------------
# Phase 1.3: Google Calendar OAuth
# ---------------------------------------------------------------------------

@router.get("/auth/google", response_model=AuthUrlResponse)
async def auth_google(settings: Settings = Depends(get_settings)):
    """
    Get the Google OAuth authorization URL.
    Redirect the user to this URL to grant calendar access.
    """
    if not settings.google_client_id:
        raise HTTPException(
            status_code=503,
            detail="Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
        )

    auth_url, state = generate_auth_url(
        client_id=settings.google_client_id,
        redirect_uri=settings.google_redirect_uri,
    )
    return AuthUrlResponse(auth_url=auth_url, state=state)


@router.get("/auth/callback")
async def auth_callback(
    code: str,
    state: str = "",
    settings: Settings = Depends(get_settings),
):
    """
    OAuth callback — exchanges the authorization code for tokens.
    Returns a session_id to use with /plan-day.
    """
    try:
        result = await exchange_code_for_tokens(
            code=code,
            client_id=settings.google_client_id,
            client_secret=settings.google_client_secret,
            redirect_uri=settings.google_redirect_uri,
        )
        return AuthCallbackResponse(session_id=result["session_id"])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth exchange failed: {e}")


# ---------------------------------------------------------------------------
# Phase 1.3: Day itinerary planning
# ---------------------------------------------------------------------------

@router.post("/plan-day", response_model=DayPlanResponse)
async def plan_day(
    req: DayPlanRequest,
    settings: Settings = Depends(get_settings),
):
    """
    Plan a full day's transit between calendar events.

    Fetches events from Google Calendar (requires prior OAuth via /auth/google),
    identifies transit windows between events, and runs the route pipeline
    for each gap.

    If no session_id is provided, uses mock calendar data for testing.
    """
    # Validate session if provided
    if req.session_id and not get_session(req.session_id):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired session. Please re-authenticate via /auth/google",
        )

    try:
        target_date = date.fromisoformat(req.date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD.")

    return await orchestrate_day(
        target_date=target_date,
        session_id=req.session_id,
        home_address=req.home_address,
        google_maps_api_key=settings.google_maps_api_key,
        google_client_id=settings.google_client_id,
        google_client_secret=settings.google_client_secret,
        groq_api_key=settings.groq_api_key,
    )
