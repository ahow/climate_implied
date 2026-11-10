import unittest

from reference_gas_infill import harmonise, summarise_stratum


class GasInfillTests(unittest.TestCase):
    def test_anchor_convergence_signed_land(self):
        source = {y: 2.0 for y in range(2024, 2101)}
        for end in (2030, 2050):
            r = harmonise(source, 4, "CH4", end)
            self.assertEqual(r[2024], 4)
            self.assertEqual(r[end], 2)
            self.assertEqual(r[2100], 2)
        signed = harmonise(source, -2, "CO2-LULUCF", 2050)
        self.assertEqual(signed[2024], -2)
        self.assertEqual(signed[2050], 2)

    def test_invalid(self):
        with self.assertRaises(ValueError):
            harmonise({2024: 0.0, 2050: 1.0}, 1, "CH4", 2050)
        with self.assertRaises(ValueError):
            harmonise({2024: 1.0, 2050: -1.0}, 1, "CH4", 2050)

    def test_spread_and_mismatched_members(self):
        def ensemble(v):
            return {"years": [2024, 2100], "memberIds": ["a", "b"],
                    "baseline": "1850-1900", "temperature": [[0, 0], [v, v]]}
        a = {str(v): ensemble(v) for v in (1, 1.001, 1.002)}
        self.assertTrue(summarise_stratum(a)["spreadGate"])
        a["1.002"] = ensemble(1.02)
        self.assertFalse(summarise_stratum(a)["spreadGate"])
        a["1.002"]["memberIds"] = ["b", "a"]
        with self.assertRaises(ValueError):
            summarise_stratum(a)


if __name__ == "__main__":
    unittest.main()
