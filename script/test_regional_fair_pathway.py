import copy
import unittest
from regional_fair_pathway import member_pathway


class RegionalBridgeTest(unittest.TestCase):
    def test_coverage_reports_every_missing_species_without_aliasing_isomers(self):
        import pandas as pd
        from fair_native_bridge import native_coverage
        frame = pd.DataFrame({"scenario": ["medium-extension"] * 3,
                              "variable": ["CO2 FFI", "HFC-134a", "HFC-143a"]})
        self.assertEqual(native_coverage(frame, ["CO2-EIP", "HFC-134", "HFC-143", "HFC-41"]),
                         ["HFC-134", "HFC-143", "HFC-41"])

    def fixture(self):
        inventory = {"cells": [
            {"gas": "CO2", "sector": "power", "nativeMt": 10},
            {"gas": "CO2", "sector": "LULUCF", "nativeMt": -2},
            {"gas": "CH4", "sector": "other", "nativeMt": 1}]}
        member = {"memberId": "m0", "inputHash": "hash", "inventoryId": "inventory",
                  "global": [{"year": year, "nativeMt": {"CO2": 8, "CH4": 1},
                              "co2FossilMt": 10, "co2LandUseMt": -2}
                             for year in range(2024, 2101)]}
        return member, inventory

    def test_native_split_preserves_land_sink(self):
        member, inventory = self.fixture()
        result = member_pathway(member, inventory)
        self.assertEqual(result["gases"]["CO2-LULUCF"], [-2] * 77)
        self.assertEqual(result["gases"]["CO2-EIP"], [10] * 77)
        self.assertFalse(result["productionEligible"])

    def test_missing_species_years_or_inconsistent_split_refused(self):
        member, inventory = self.fixture()
        for mutation in ["gas", "year", "split", "nonfinite", "baseline"]:
            changed = copy.deepcopy(member)
            if mutation == "gas":
                del changed["global"][3]["nativeMt"]["CH4"]
            elif mutation == "year":
                changed["global"].pop()
            elif mutation == "split":
                changed["global"][2]["co2FossilMt"] = 12
            elif mutation == "nonfinite":
                changed["global"][2]["nativeMt"]["CH4"] = float("nan")
            else:
                changed["global"][0]["nativeMt"]["CH4"] = 2
            with self.assertRaises(ValueError):
                member_pathway(changed, inventory)
