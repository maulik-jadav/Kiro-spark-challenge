"""
Candidate departure time generator for the Best Departure Window feature.

Produces a list of evenly-spaced departure times between now and the desired
arrival time, respecting step size, maximum lookback, and candidate cap
constraints.

Pure function — no I/O, no side effects.
"""

from datetime import datetime, timedelta
import math


def generate_candidates(
    now: datetime,
    desired_arrival: datetime,
    step_minutes: int = 10,
    max_lookback_minutes: int = 180,
    max_candidates: int = 36,
) -> list[datetime]:
    """
    Generate candidate departure times.

    - Starts at max(now, desired_arrival - max_lookback_minutes)
    - Ends at desired_arrival
    - Spaced at step_minutes intervals
    - If count exceeds max_candidates, increases step to fit
    - Returns empty list if now >= desired_arrival
    - Always returns at least one candidate when now < desired_arrival
    - Excludes any departure time already in the past at moment of generation

    Parameters
    ----------
    now : datetime
        The current time (injected for testability).
    desired_arrival : datetime
        The time the user wants to arrive by.
    step_minutes : int
        Interval between candidate departure times (default 10).
    max_lookback_minutes : int
        Maximum minutes before desired_arrival to start generating (default 180).
    max_candidates : int
        Hard cap on the number of candidates returned (default 36).

    Returns
    -------
    list[datetime]
        Candidate departure times sorted chronologically.
    """
    # Requirement 2.6: empty list when now >= desired_arrival
    if now >= desired_arrival:
        return []

    # Compute range start: max(now, desired_arrival - max_lookback_minutes)
    # Requirement 2.4: don't go earlier than desired_arrival - max_lookback_minutes
    lookback_start = desired_arrival - timedelta(minutes=max_lookback_minutes)
    range_start = max(now, lookback_start)

    # Total window in minutes
    total_minutes = (desired_arrival - range_start).total_seconds() / 60.0

    # Requirement 2.5: if natural count exceeds cap, increase step to fit
    natural_count = math.floor(total_minutes / step_minutes) + 1
    if natural_count > max_candidates:
        # Increase step so we cover the full range within the cap.
        # We need max_candidates evenly-spaced points from range_start to
        # desired_arrival, so the step is total_minutes / (max_candidates - 1)
        # when max_candidates > 1.
        if max_candidates > 1:
            effective_step_minutes = total_minutes / (max_candidates - 1)
        else:
            effective_step_minutes = total_minutes
    else:
        effective_step_minutes = float(step_minutes)

    # Generate candidates
    candidates: list[datetime] = []
    i = 0
    while True:
        candidate = range_start + timedelta(minutes=i * effective_step_minutes)
        # Don't go past desired_arrival
        if candidate > desired_arrival:
            break
        # Requirement 2.2: exclude departure times in the past
        if candidate >= now:
            candidates.append(candidate)
        i += 1
        # Safety: don't exceed max_candidates
        if len(candidates) >= max_candidates:
            break

    # Requirement 2.7: guarantee at least one candidate when now < desired_arrival
    if len(candidates) == 0 and now < desired_arrival:
        # The only valid candidate is now itself (or desired_arrival if now is
        # very close). Use now since it's the earliest valid departure.
        candidates.append(now)

    return candidates
