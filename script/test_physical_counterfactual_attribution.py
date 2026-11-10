"""Engineering fixtures only; no fixture is accepted as observed attribution."""
import unittest

from fair import FAIR
from fair.interface import fill
from fair.io import read_properties
from fair.structure.units import desired_emissions_units
import numpy as np
import pandas as pd
import xarray as xr

from physical_counterfactual_attribution import (
    attributed_members, build_model, validate_inputs, compatibility_report,
)


class PairedAttributionTests(unittest.TestCase):
    def temperatures(self):
        coords = {"timebounds": np.arange(1750, 2101), "scenario": ["test"],
                  "config": ["a", "b", "c"]}
        natural = np.broadcast_to(np.arange(351)[:, None, None]*.001, (351, 1, 3)).copy()
        human = np.broadcast_to(np.arange(351)[:, None, None]*.01, (351, 1, 3)).copy()
        human += np.array([0, 10, 20])[None, None, :]
        human[100:152, 0, :] += np.array([20, -10, 0])[None, :]
        return (xr.DataArray(natural+human, dims=tuple(coords), coords=coords),
                xr.DataArray(natural, dims=tuple(coords), coords=coords))

    def test_actual_pair_subtraction_member_baseline_and_unchanged_inputs(self):
        factual, counter = self.temperatures()
        before = factual.copy(deep=True)
        result = attributed_members(factual, counter)
        xr.testing.assert_identical(factual, before)
        self.assertEqual(result.sel(year=slice(1850, 1900)).sizes["year"], 51)
        np.testing.assert_allclose(
            result.attributed_surface_annual.sel(year=slice(1850, 1900)).mean("year"), 0, atol=1e-14)
        paired = factual-counter
        expected_annual = (paired.values[:-1]+paired.values[1:])/2
        expected_baseline = expected_annual[100:151].mean(axis=0)
        np.testing.assert_allclose(result.attributed_surface_annual.values,
                                   expected_annual-expected_baseline, atol=1e-13)
        self.assertFalse(np.allclose(result.attributed_surface_annual, result.factual_surface_annual))

    def test_coordinates_nonfinite_and_window_cannot_be_relabelled(self):
        factual, counter = self.temperatures()
        with self.assertRaisesRegex(ValueError, "Exact paired"):
            attributed_members(factual, counter.sel(config=["c", "b", "a"]))
        with self.assertRaisesRegex(ValueError, "Full retained"):
            attributed_members(factual[1:], counter[1:])
        counter.values[0] = np.nan
        with self.assertRaisesRegex(ValueError, "Finite"):
            attributed_members(factual, counter)


class FreshModelTests(unittest.TestCase):
    def fixture(self):
        f = FAIR(ch4_method="thornhill2021")
        f.define_time(1750, 2100, 1)
        f.define_scenarios(["fixture"])
        f.define_configs(["model_with_underscore_run"])
        species, properties = read_properties()
        f.define_species(species, properties)
        f.allocate()
        f.fill_species_configs()
        fill(f.species_configs["baseline_emissions"], 19.01978312, specie="CH4")
        fill(f.species_configs["baseline_emissions"], 0.08602230754, specie="N2O")
        data = xr.Dataset({
            "emissions_native": f.emissions.rename(timepoints="year").assign_coords(year=np.arange(1750, 2100)),
            "forcing_species_bounds": f.forcing,
            **{key: f.species_configs[key] for key in
               ("baseline_emissions", "baseline_concentration", "forcing_reference_concentration")},
            "species_input_mode": ("specie", [properties[s]["input_mode"] for s in species]),
            "species_type": ("specie", [properties[s]["type"] for s in species]),
            "native_emissions_unit": ("specie", [desired_emissions_units.get(s, "not an emissions input") for s in species])})
        for s in species:
            if properties[s]["input_mode"] == "emissions":
                data.emissions_native.loc[dict(specie=s)] = 42
            elif properties[s]["input_mode"] == "forcing":
                data.forcing_species_bounds.loc[dict(specie=s)] = .1
        table = pd.DataFrame([{
            "model": "model_with_underscore", "run": "run",
            "C1": 8, "C2": 100, "C3": 1000, "kappa1": 1, "kappa2": 2, "kappa3": 1,
            "epsilon": 1, "gamma": 2, "sigma_eta": .1, "sigma_xi": .1}])
        return data, table

    def test_every_perturbation_fresh_state_native_baseline_and_same_natural_seed(self):
        data, table = self.fixture()
        factual = build_model(data, table)
        counter = build_model(data, table, counterfactual=True)
        self.assertIsNot(factual, counter)
        self.assertFalse(np.shares_memory(factual.temperature.values, counter.temperature.values))
        np.testing.assert_array_equal(factual.temperature[0], 0)
        np.testing.assert_array_equal(counter.temperature[0], 0)
        for s in factual.species:
            if factual.properties[s]["input_mode"] == "emissions":
                np.testing.assert_allclose(counter.emissions.sel(specie=s),
                                           counter.species_configs.baseline_emissions.sel(specie=s).item())
                np.testing.assert_allclose(factual.emissions.sel(specie=s), 42)
        xr.testing.assert_equal(factual.forcing.sel(specie=["Solar", "Volcanic"]),
                                counter.forcing.sel(specie=["Solar", "Volcanic"]))
        xr.testing.assert_equal(factual.climate_configs, counter.climate_configs)
        factual.temperature.values[0] = 99
        np.testing.assert_array_equal(counter.temperature[0], 0)

    def test_wrong_native_units_missing_source_baseline_and_duplicate_member_fail(self):
        data, table = self.fixture()
        data.native_emissions_unit.loc[dict(specie="CH4")] = "GtCO2e/yr"
        with self.assertRaisesRegex(ValueError, "Native unit"):
            build_model(data, table)
        data.baseline_emissions.loc[dict(specie="CH4")] = np.nan
        with self.assertRaisesRegex(ValueError, "baseline"):
            validate_inputs(data)
        data, _ = self.fixture()
        with self.assertRaisesRegex(ValueError, "Unique config"):
            validate_inputs(xr.concat([data, data], dim="config", data_vars="all"))

    def test_source_contract_does_not_turn_surface_experiment_into_gmst_acceptance(self):
        data, _ = self.fixture()
        report = compatibility_report(data, {"provenance": {"rcmipReceipts": []}})
        self.assertFalse(report["actualGMSTMemberComparisonPerformed"])
        self.assertIsNone(report["shareMeanMembersInRange"])
        self.assertFalse(report["centralEligible"])
        self.assertIn("three-layer", report["observable"]["whyUnavailable"])
        self.assertEqual(report["historicalExtension"]["status"], "required")
        self.assertEqual(report["nativeIGCCComparison"]["status"], "withheld")


if __name__ == "__main__":
    unittest.main()
