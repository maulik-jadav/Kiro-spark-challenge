"""
Tests for core/emission_factors.py
Verifies emission factors, cost factors, and computation functions.
"""

import pytest
from core.emission_factors import (
    TransitMode,
    EMISSION_FACTORS,
    COST_FACTORS,
    EmissionFactor,
    CostFactor,
    get_factor,
    get_cost_factor,
    compute_emissions_g,
    compute_emissions_kg,
    compute_cost,
)


# ---------------------------------------------------------------------------
# Emission factor table integrity
# ---------------------------------------------------------------------------

class TestEmissionFactorTable:
    def test_all_modes_have_emission_factors(self):
        for mode in TransitMode:
            assert mode in EMISSION_FACTORS, f"Missing emission factor for {mode}"

    def test_all_modes_have_cost_factors(self):
        for mode in TransitMode:
            assert mode in COST_FACTORS, f"Missing cost factor for {mode}"

    def test_emission_factors_are_non_negative(self):
        for mode, factor in EMISSION_FACTORS.items():
            assert factor.g_co2e_per_pkm >= 0, f"{mode} has negative emissions"

    def test_cost_factors_are_non_negative(self):
        for mode, cf in COST_FACTORS.items():
            assert cf.base_fare >= 0, f"{mode} has negative base fare"
            assert cf.per_km_cost >= 0, f"{mode} has negative per-km cost"

    def test_all_emission_factors_have_sources(self):
        for mode, factor in EMISSION_FACTORS.items():
            assert factor.source, f"{mode} emission factor has no source"

    def test_all_cost_factors_have_sources(self):
        for mode, cf in COST_FACTORS.items():
            assert cf.source, f"{mode} cost factor has no source"

    def test_zero_emission_modes(self):
        assert EMISSION_FACTORS[TransitMode.WALKING].g_co2e_per_pkm == 0.0
        assert EMISSION_FACTORS[TransitMode.BICYCLING].g_co2e_per_pkm == 0.0

    def test_driving_higher_than_transit(self):
        driving = EMISSION_FACTORS[TransitMode.DRIVING].g_co2e_per_pkm
        bus = EMISSION_FACTORS[TransitMode.BUS].g_co2e_per_pkm
        rail = EMISSION_FACTORS[TransitMode.LIGHT_RAIL].g_co2e_per_pkm
        assert driving > bus > rail

    def test_rideshare_higher_than_driving(self):
        rideshare = EMISSION_FACTORS[TransitMode.RIDESHARE].g_co2e_per_pkm
        driving = EMISSION_FACTORS[TransitMode.DRIVING].g_co2e_per_pkm
        assert rideshare > driving

    def test_carpool_reduces_emissions(self):
        solo = EMISSION_FACTORS[TransitMode.DRIVING].g_co2e_per_pkm
        pool2 = EMISSION_FACTORS[TransitMode.CARPOOL_2].g_co2e_per_pkm
        pool4 = EMISSION_FACTORS[TransitMode.CARPOOL_4].g_co2e_per_pkm
        assert solo > pool2 > pool4


# ---------------------------------------------------------------------------
# Computation functions
# ---------------------------------------------------------------------------

class TestComputeFunctions:
    def test_get_factor(self):
        f = get_factor(TransitMode.DRIVING)
        assert isinstance(f, EmissionFactor)
        assert f.mode == TransitMode.DRIVING

    def test_get_cost_factor(self):
        cf = get_cost_factor(TransitMode.BUS)
        assert isinstance(cf, CostFactor)
        assert cf.mode == TransitMode.BUS

    def test_compute_emissions_g_driving(self):
        result = compute_emissions_g(TransitMode.DRIVING, 10.0)
        expected = 251.0 * 10.0  # 2510g
        assert result == expected

    def test_compute_emissions_g_walking(self):
        result = compute_emissions_g(TransitMode.WALKING, 5.0)
        assert result == 0.0

    def test_compute_emissions_kg(self):
        result = compute_emissions_kg(TransitMode.DRIVING, 10.0)
        assert result == 2.51

    def test_compute_cost_driving(self):
        result = compute_cost(TransitMode.DRIVING, 10.0)
        expected = 0.42 * 10.0  # $4.20
        assert result == expected

    def test_compute_cost_bus_per_km_is_zero(self):
        result = compute_cost(TransitMode.BUS, 15.0)
        assert result == 0.0  # bus is flat fare, per-km is 0

    def test_compute_cost_walking(self):
        result = compute_cost(TransitMode.WALKING, 5.0)
        assert result == 0.0

    def test_compute_emissions_zero_distance(self):
        result = compute_emissions_g(TransitMode.DRIVING, 0.0)
        assert result == 0.0

    def test_compute_cost_zero_distance(self):
        result = compute_cost(TransitMode.RIDESHARE, 0.0)
        assert result == 0.0
