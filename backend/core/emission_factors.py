"""
Verifiable emission factors for transportation modes.

Sources:
  - EPA: Inventory of U.S. Greenhouse Gas Emissions and Sinks (2024)
    https://www.epa.gov/ghgemissions/inventory-us-greenhouse-gas-emissions-and-sinks
  - IPCC AR6 WG3, Chapter 10: Transport (2022)
  - FTA National Transit Database (NTD) 2023 metrics

All factors are in grams CO2-equivalent per passenger-kilometer (g CO2e/pkm).
"""

from dataclasses import dataclass
from enum import Enum


class TransitMode(str, Enum):
    DRIVING = "driving"
    CARPOOL_2 = "carpool_2"
    CARPOOL_4 = "carpool_4"
    BUS = "bus"
    LIGHT_RAIL = "light_rail"
    SUBWAY = "subway"
    COMMUTER_RAIL = "commuter_rail"
    WALKING = "walking"
    BICYCLING = "bicycling"
    E_SCOOTER = "e_scooter"
    RIDESHARE = "rideshare"


@dataclass(frozen=True)
class EmissionFactor:
    """Single emission factor with provenance."""

    mode: TransitMode
    g_co2e_per_pkm: float  # grams CO2-equivalent per passenger-km
    source: str
    notes: str = ""


@dataclass(frozen=True)
class CostFactor:
    """Cost model for a transit mode."""

    mode: TransitMode
    base_fare: float  # flat fare in USD (0 for driving/walking/cycling)
    per_km_cost: float  # USD per kilometer
    source: str
    notes: str = ""


# ---------------------------------------------------------------------------
# Canonical emission factor table
# ---------------------------------------------------------------------------
# EPA passenger vehicle average: 400 g CO2/mi ≈ 251 g CO2/km (single occupancy)
# FTA NTD bus average: 89 g CO2/passenger-mile ≈ 55 g CO2/pkm
# FTA NTD light rail: 35 g CO2/passenger-mile ≈ 22 g CO2/pkm
# ---------------------------------------------------------------------------

EMISSION_FACTORS: dict[TransitMode, EmissionFactor] = {
    TransitMode.DRIVING: EmissionFactor(
        mode=TransitMode.DRIVING,
        g_co2e_per_pkm=251.0,
        source="EPA 2024 – avg passenger vehicle, single occupancy",
    ),
    TransitMode.CARPOOL_2: EmissionFactor(
        mode=TransitMode.CARPOOL_2,
        g_co2e_per_pkm=126.0,
        source="EPA 2024 – avg passenger vehicle / 2 occupants",
    ),
    TransitMode.CARPOOL_4: EmissionFactor(
        mode=TransitMode.CARPOOL_4,
        g_co2e_per_pkm=63.0,
        source="EPA 2024 – avg passenger vehicle / 4 occupants",
    ),
    TransitMode.BUS: EmissionFactor(
        mode=TransitMode.BUS,
        g_co2e_per_pkm=55.0,
        source="FTA NTD 2023 – urban bus avg passenger-mile",
    ),
    TransitMode.LIGHT_RAIL: EmissionFactor(
        mode=TransitMode.LIGHT_RAIL,
        g_co2e_per_pkm=22.0,
        source="FTA NTD 2023 – light rail avg passenger-mile",
    ),
    TransitMode.SUBWAY: EmissionFactor(
        mode=TransitMode.SUBWAY,
        g_co2e_per_pkm=17.0,
        source="FTA NTD 2023 – heavy rail avg passenger-mile",
    ),
    TransitMode.COMMUTER_RAIL: EmissionFactor(
        mode=TransitMode.COMMUTER_RAIL,
        g_co2e_per_pkm=35.0,
        source="FTA NTD 2023 – commuter rail avg passenger-mile",
    ),
    TransitMode.WALKING: EmissionFactor(
        mode=TransitMode.WALKING,
        g_co2e_per_pkm=0.0,
        source="Zero direct emissions",
    ),
    TransitMode.BICYCLING: EmissionFactor(
        mode=TransitMode.BICYCLING,
        g_co2e_per_pkm=0.0,
        source="Zero direct emissions",
    ),
    TransitMode.E_SCOOTER: EmissionFactor(
        mode=TransitMode.E_SCOOTER,
        g_co2e_per_pkm=6.0,
        source="IPCC AR6 WG3 Ch.10 – electric micro-mobility estimate",
    ),
    TransitMode.RIDESHARE: EmissionFactor(
        mode=TransitMode.RIDESHARE,
        g_co2e_per_pkm=300.0,
        source="EPA 2024 + deadhead miles premium (~20%)",
        notes="Higher than solo driving due to empty repositioning miles",
    ),
}


# ---------------------------------------------------------------------------
# Canonical cost factor table (USD, 2024 estimates)
# ---------------------------------------------------------------------------
# AAA 2024 driving cost: $0.677/mile ≈ $0.42/km (fuel + maintenance + depreciation)
# Fuel-only: ~$0.10/km at $3.50/gal, 30 mpg avg
# BART: $0.22/km avg + $2.00 base (clipper)
# Muni bus: $2.50 flat fare
# Rideshare: base $3.00 + ~$1.20/km (Uber/Lyft avg)
# ---------------------------------------------------------------------------

COST_FACTORS: dict[TransitMode, CostFactor] = {
    TransitMode.DRIVING: CostFactor(
        mode=TransitMode.DRIVING,
        base_fare=0.0,
        per_km_cost=0.42,
        source="AAA 2024 – avg driving cost per mile (fuel + maintenance + depreciation)",
    ),
    TransitMode.CARPOOL_2: CostFactor(
        mode=TransitMode.CARPOOL_2,
        base_fare=0.0,
        per_km_cost=0.21,
        source="AAA 2024 / 2 occupants",
    ),
    TransitMode.CARPOOL_4: CostFactor(
        mode=TransitMode.CARPOOL_4,
        base_fare=0.0,
        per_km_cost=0.105,
        source="AAA 2024 / 4 occupants",
    ),
    TransitMode.BUS: CostFactor(
        mode=TransitMode.BUS,
        base_fare=2.50,
        per_km_cost=0.0,
        source="Avg US urban bus flat fare 2024",
    ),
    TransitMode.LIGHT_RAIL: CostFactor(
        mode=TransitMode.LIGHT_RAIL,
        base_fare=2.00,
        per_km_cost=0.22,
        source="BART/light rail avg distance-based fare 2024",
    ),
    TransitMode.SUBWAY: CostFactor(
        mode=TransitMode.SUBWAY,
        base_fare=2.90,
        per_km_cost=0.0,
        source="Avg US subway flat fare 2024 (e.g. NYC MTA $2.90)",
    ),
    TransitMode.COMMUTER_RAIL: CostFactor(
        mode=TransitMode.COMMUTER_RAIL,
        base_fare=3.00,
        per_km_cost=0.18,
        source="Avg US commuter rail distance-based fare 2024",
    ),
    TransitMode.WALKING: CostFactor(
        mode=TransitMode.WALKING,
        base_fare=0.0,
        per_km_cost=0.0,
        source="Free",
    ),
    TransitMode.BICYCLING: CostFactor(
        mode=TransitMode.BICYCLING,
        base_fare=0.0,
        per_km_cost=0.0,
        source="Free (personal bike)",
    ),
    TransitMode.E_SCOOTER: CostFactor(
        mode=TransitMode.E_SCOOTER,
        base_fare=1.00,
        per_km_cost=0.25,
        source="Avg e-scooter rental: $1 unlock + ~$0.25/min at 12 km/h",
    ),
    TransitMode.RIDESHARE: CostFactor(
        mode=TransitMode.RIDESHARE,
        base_fare=3.00,
        per_km_cost=1.20,
        source="Uber/Lyft avg base + per-km rate 2024",
    ),
}


def get_factor(mode: TransitMode) -> EmissionFactor:
    """Return the emission factor for a given transit mode."""
    return EMISSION_FACTORS[mode]


def get_cost_factor(mode: TransitMode) -> CostFactor:
    """Return the cost factor for a given transit mode."""
    return COST_FACTORS[mode]


def compute_emissions_g(mode: TransitMode, distance_km: float) -> float:
    """Compute total grams CO2e for a trip segment."""
    return EMISSION_FACTORS[mode].g_co2e_per_pkm * distance_km


def compute_emissions_kg(mode: TransitMode, distance_km: float) -> float:
    """Compute total kg CO2e for a trip segment."""
    return compute_emissions_g(mode, distance_km) / 1000.0


def compute_cost(mode: TransitMode, distance_km: float) -> float:
    """Compute trip cost in USD. Base fare is applied once per trip, not per segment."""
    cf = COST_FACTORS[mode]
    return cf.per_km_cost * distance_km
