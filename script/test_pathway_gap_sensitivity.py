import unittest
from pathway_gap_sensitivity import gap_sensitivity


class GapSensitivityTests(unittest.TestCase):
    def test_independent_totals_and_anchor(self):
        r = gap_sensitivity({"HFC-134": 2, "CO2-EIP": 100}, ["CO2-EIP"])
        cases = r["missing"]["HFC-134"]["cases"]
        self.assertEqual(cases["constant-2024"]["sum2025Through2100Mt"], 152)
        self.assertAlmostEqual(cases["linear-zero-2050"]["sum2025Through2100Mt"], 25)
        self.assertEqual(cases["zero-after-2024"]["sum2025Through2100Mt"], 0)
        for c in cases.values():
            self.assertEqual(c["annual"][2024], 2)
            self.assertEqual(len(c["annual"]), 77)

    def test_rejects_unknown_and_invalid_gas(self):
        with self.assertRaises(ValueError):
            gap_sensitivity({"HFC-134": 1}, ["HFC-134a"])
        with self.assertRaises(ValueError):
            gap_sensitivity({"HFC-134": float("nan")}, [])
