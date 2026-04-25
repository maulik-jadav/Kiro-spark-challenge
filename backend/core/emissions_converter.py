"""
Fuel-based emissions converter for departure recommendation.

Converts Google Routes API fuelConsumptionMicroliters into liters and then
into grams of CO2 using per-fuel-type emission factors.  Falls back to
distance-based estimation (using the DRIVING factor from emission_factors.py)
when fuel data is unavailable.

Sources:
  - EPA 2024: Inventory of U.S. Greenhouse Gas Emissions and Sinks
    https://www.epa.gov/ghgemissions/inventory-us-greenhouse-gas-emissions-and-sinks
  - Gasoline: 2,310 g CO2 per liter (8,887 g CO2/gal ÷ 3.785 L/gal)
  - Diesel:   2,680 g CO2 per liter (10,180 g CO2/gal ÷ 3.785 L/gal)
  - Hybrid:   1,600 g CO2 per liter (EPA 2024 adjusted for regenerative braking)
"""

from dataclasses import dataclass
from enum import Enum

from core.emission_factors import EMISSION_FACTORS, TransitMode


class VehicleEmissionType(str, Enum):
    """Fuel types with associated CO2 emission factors."""

    GASOLINE = "GASOLINE"
    DIESEL = "DIESEL"
    HYBRID = "HYBRID"


@dataclass(frozen=True)
class FuelEmissionFactor:
    """CO2 emission factor for a specific fuel type, with source attribution."""

    vehicle_type: VehicleEmissionType
    g_co2_per_liter: float
    source: str


# ---------------------------------------------------------------------------
# Canonical fuel emission factor table
# ---------------------------------------------------------------------------

FUEL_EMISSION_FACTORS: dict[VehicleEmissionType, FuelEmissionFactor] = {
    VehicleEmissionType.GASOLINE: FuelEmissionFactor(
        vehicle_type=VehicleEmissionType.GASOLINE,
        g_co2_per_liter=2310.0,
        source="EPA 2024 — average gasoline CO2 emission factor",
    ),
    VehicleEmissionType.DIESEL: FuelEmissionFactor(
        vehicle_type=VehicleEmissionType.DIESEL,
        g_co2_per_liter=2680.0,
        source="EPA 2024 — average diesel CO2 emission factor",
    ),
    VehicleEmissionType.HYBRID: FuelEmissionFactor(
        vehicle_type=VehicleEmissionType.HYBRID,
        g_co2_per_liter=1600.0,
        source="EPA 2024 — hybrid vehicle adjusted emission factor",
    ),
}

# Distance-based fallback factor: DRIVING mode from the canonical table
# 251 g CO2e/pkm (EPA 2024 — avg passenger vehicle, single occupancy)
_DISTANCE_FALLBACK_G_PER_KM: float = EMISSION_FACTORS[
    TransitMode.DRIVING
].g_co2e_per_pkm


def microliters_to_liters(microliters: float) -> float:
    """Convert microliters to liters.

    >>> microliters_to_liters(5_000_000)
    5.0
    """
    return microliters / 1_000_000.0


def compute_fuel_emissions(
    fuel_liters: float,
    vehicle_type: VehicleEmissionType = VehicleEmissionType.GASOLINE,
) -> float:
    """Compute grams CO2 from fuel consumption.

    Args:
        fuel_liters: Volume of fuel consumed in liters.
        vehicle_type: Fuel type to look up the emission factor.

    Returns:
        Grams of CO2 emitted.
    """
    factor = FUEL_EMISSION_FACTORS[vehicle_type]
    return fuel_liters * factor.g_co2_per_liter


def compute_emissions_for_candidate(
    fuel_consumption_microliters: float | None,
    distance_km: float,
    vehicle_type: VehicleEmissionType = VehicleEmissionType.GASOLINE,
) -> tuple[float, float]:
    """Compute fuel consumption and emissions for a single departure candidate.

    Uses fuel-based calculation when the Google Routes API provides
    fuelConsumptionMicroliters.  Falls back to distance-based estimation
    (251 g CO2e/pkm, EPA 2024) when fuel data is unavailable.

    Args:
        fuel_consumption_microliters: Fuel consumed as reported by the
            Google Routes API, or None if unavailable.
        distance_km: Route distance in kilometers.
        vehicle_type: Fuel type for the emission factor lookup.

    Returns:
        A tuple of (fuel_liters, emissions_grams).
        When using the distance fallback, fuel_liters is 0.0.
    """
    if fuel_consumption_microliters is not None:
        fuel_liters = microliters_to_liters(fuel_consumption_microliters)
        emissions_grams = compute_fuel_emissions(fuel_liters, vehicle_type)
        return fuel_liters, emissions_grams

    # Distance-based fallback — no fuel volume available
    emissions_grams = distance_km * _DISTANCE_FALLBACK_G_PER_KM
    return 0.0, emissions_grams
