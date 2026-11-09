import math
from pathlib import Path
import tempfile
import unittest
import pandas as pd
from fair import FAIR
from fair.io import read_properties
from fair_additional_species import PARAMETERS, extend_species_configs, add_historical_species


class AdditionalSpeciesTests(unittest.TestCase):
    def test_parameters_load_in_fair_without_isomer_substitution(self):
        import fair
        source = Path(fair.__file__).parent / "defaults/data/ar6/species_configs_properties.csv"
        original = pd.read_csv(source, index_col=0)
        extended = extend_species_configs(original)
        pd.testing.assert_series_equal(original.loc["HFC-134a"], extended.loc["HFC-134a"])
        pd.testing.assert_series_equal(original.loc["HFC-143a"], extended.loc["HFC-143a"])
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "species.csv"
            extended.to_csv(path)
            species, properties = read_properties(filename=path)
            model = FAIR()
            model.define_time(1750, 2101, 1)
            model.define_scenarios(["control"])
            model.define_configs(["control"])
            model.define_species(species, properties)
            model.allocate()
            model.fill_species_configs(path)
            for gas, p in PARAMETERS.items():
                self.assertAlmostEqual(float(model.species_configs["unperturbed_lifetime"].sel(specie=gas).values.flat[0]), p["lifetime"])
                # FaIR's constant-lifetime alpha = g0 * exp(iirf0/g1) must be 1.
                row = extended.loc[gas]
                self.assertAlmostEqual(row.g0 * math.exp(row.iirf_0 / row.g1), 1)
                self.assertEqual(row.greenhouse_gas_radiative_efficiency, p["radiativeEfficiency"])

    def test_history_is_explicit_and_future_is_not_zero_filled(self):
        columns = ["scenario", "region", "variable", "unit"] + [str(y + .5) for y in range(1750, 2101)]
        template = pd.DataFrame(columns=columns)
        history = {"unit": "Mt gas/year", "years": list(range(1750, 2024)),
                   "gases": {gas: [.001] * 274 for gas in PARAMETERS},
                   "source": {"url": "https://example.org/fixture", "basis": "synthetic fixture only"}}
        output = add_historical_species(template, history)
        self.assertEqual(output["2023.5"].tolist(), [1, 1, 1])
        self.assertTrue(output["2024.5"].isna().all())
        from fair_native_bridge import apply_native_pathway
        complete = apply_native_pathway(output, {"unit": "Mt gas/year",
            "years": list(range(2024, 2101)), "gases": {gas: [.001] * 77 for gas in PARAMETERS}},
            {gas: .001 for gas in PARAMETERS})
        self.assertEqual(complete["2024.5"].tolist(), [1, 1, 1])
        self.assertFalse(complete.isna().any().any())
        history["gases"]["HFC-41"].pop()
        with self.assertRaises(ValueError):
            add_historical_species(template, history)

    def test_real_fair_isolated_pulse_controls(self):
        from fair_minor_gas_controls import run_controls
        report = run_controls()
        self.assertEqual(len(report["controls"]), 3)
        self.assertFalse(report["productionEligible"])
        self.assertTrue(all(r["absoluteError"] < 1e-10 for r in report["controls"]))
