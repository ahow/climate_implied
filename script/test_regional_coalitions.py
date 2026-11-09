import copy
import unittest
from regional_coalition_controls import coalition_pathway


class RegionalCoalitionTests(unittest.TestCase):
    def test_structurally_absent_gas_is_distinct_from_missing_expected_gas(self):
        from test_regional_fair_pathway import RegionalBridgeTest
        member, inventory = RegionalBridgeTest().fixture()
        zero = [{"year": y, "nativeMt": {"CO2": 0}, "co2FossilMt": 0, "co2LandUseMt": 0}
                for y in range(2024, 2101)]
        member["regions"] = [
            {"region": "one", "cells": inventory["cells"], "trajectory": copy.deepcopy(member["global"])},
            {"region": "two", "cells": [{"gas": "CO2"}], "trajectory": zero}]
        result = coalition_pathway(member, inventory, ["two"])
        self.assertEqual(result["gases"]["CH4"][1:], [0] * 76)
        bad = copy.deepcopy(member)
        bad["regions"][1]["cells"].append({"gas": "unknown-gas"})
        bad["regions"][1]["trajectory"][1]["nativeMt"]["unknown-gas"] = 1
        with self.assertRaisesRegex(ValueError, "Unknown regional inventory"):
            coalition_pathway(bad, inventory, [])
        del member["regions"][0]["trajectory"][1]["nativeMt"]["CH4"]
        with self.assertRaisesRegex(ValueError, "Missing or extra"):
            coalition_pathway(member, inventory, [])

    def test_anchor_reconciliation_and_explicit_sink_removal(self):
        from test_regional_fair_pathway import RegionalBridgeTest
        member, inventory = RegionalBridgeTest().fixture()
        member["regions"] = [{"region": "one", "cells": inventory["cells"], "trajectory": copy.deepcopy(member["global"])}]
        empty = coalition_pathway(member, inventory, [])
        full = coalition_pathway(member, inventory, ["one"])
        self.assertEqual(empty["gases"]["CO2-LULUCF"][0], -2)
        self.assertEqual(empty["gases"]["CO2-LULUCF"][1:], [0] * 76)
        self.assertEqual(full["gases"]["CO2-LULUCF"], [-2] * 77)
        self.assertEqual(empty["gases"]["CH4"][0], 1)
        self.assertEqual(empty["gases"]["CH4"][1:], [0] * 76)
        with self.assertRaises(ValueError):
            coalition_pathway(member, inventory, ["unknown"])
        member["regions"][0]["trajectory"][4]["nativeMt"]["CH4"] = 2
        with self.assertRaisesRegex(ValueError, "accounting mismatch"):
            coalition_pathway(member, inventory, [])
