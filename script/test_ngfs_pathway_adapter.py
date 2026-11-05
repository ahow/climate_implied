import unittest
from ngfs_pathway_adapter import annualize, reconcile, build_audit, SERIES


class AdapterTests(unittest.TestCase):
    def test_interpolation_and_horizon_invariance(self):
        points = [(2020, 20), (2025, 30), (2100, 45)]
        full = annualize(points)
        short = annualize(points, end=2030)
        self.assertEqual(full[2024], 28)
        self.assertEqual(short, {y: full[y] for y in short})

    def test_no_extrapolation_duplicates_or_nan(self):
        for points in [[(2025, 1), (2100, 2)], [(2020, 1), (2030, 2)],
                       [(2020, 1), (2020, 2), (2100, 3)],
                       [(2020, float("nan")), (2100, 3)]]:
            with self.assertRaises(ValueError):
                annualize(points)

    def test_native_mass_ratio(self):
        self.assertEqual(reconcile({2024: 10, 2025: 9}, 20, "CH4"),
                         {2024: 20, 2025: 18})

    def test_signed_land_convergence(self):
        result = reconcile({2024: 2, 2037: 0, 2050: -2, 2100: -3}, 4, "CO2-LULUCF")
        self.assertEqual(result, {2024: 4, 2037: 1, 2050: -2, 2100: -3})

    def test_no_silent_zero_or_negative_nonco2(self):
        for raw in [{2024: 0, 2025: 1}, {2024: 1, 2025: -1}]:
            with self.assertRaises(ValueError):
                reconcile(raw, 2, "CH4")

    def test_source_units_coverage_and_baseline(self):
        inventory = {"year": 2024, "version": "fixture", "cells": [
            {"gas": "N2O", "sector": "3", "nativeMt": 12},
            {"gas": "NF3", "sector": "2", "nativeMt": .001},
        ]}
        row = {"Model": "REMIND-MAgPIE 3.3-4.8", "Scenario": "Current Policies",
               "Region": "World", "Variable": "Emissions|N2O", "Unit": "kt N2O/yr",
               "2020": "10000", "2025": "10000", "2100": "10000"}
        report = build_audit([row], inventory)
        self.assertEqual(report["series"]["N2O"]["raw"][2024], 10)
        self.assertEqual(report["series"]["N2O"]["adjustedDiagnostic"][2024], 12)
        self.assertEqual(report["unrepresentedInventoryGases"], ["NF3"])
        self.assertNotIn("Emissions|F-Gases", SERIES)
        self.assertNotIn("Emissions|PFC", SERIES)
        with self.assertRaises(ValueError):
            build_audit([{**row, "Unit": "Mt CO2-equiv/yr"}], inventory)
        with self.assertRaises(ValueError):
            build_audit([row, row], inventory)
        with self.assertRaises(ValueError):
            build_audit([row], inventory, scenario="All announced commitments")
        harmonized = {**row, "Variable": "AR6 climate diagnostics|Harmonized|Emissions|N2O",
                      "2020": "11000", "2025": "11000", "2100": "11000"}
        processed = build_audit([row, harmonized], inventory, stage="harmonized")
        self.assertEqual(processed["series"]["N2O"]["raw"][2024], 11)
        self.assertEqual(processed["processingStage"], "harmonized")
        # Raw data cannot silently fill holes in the requested processing stage.
        missing = build_audit([row], inventory, stage="infilled")
        self.assertEqual(missing["series"], {})
        self.assertIn("N2O", missing["unrepresentedInventoryGases"])
        self.assertNotIn("Emissions|HFC|HFC245ca", SERIES)


if __name__ == "__main__":
    unittest.main()
