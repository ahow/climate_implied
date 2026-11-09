import math
import unittest
from electricity_demand_calibration import evaluate


class ElectricityDemandTests(unittest.TestCase):
    def rows(self):
        return [(year, 100 * math.exp(.02 * (year - 2010))) for year in range(2010, 2025)]

    def test_order_and_holdout_isolation(self):
        rows = self.rows()
        a = evaluate(rows)
        self.assertEqual(a, evaluate(list(reversed(rows))))
        b = evaluate([(year, value if year <= 2018 else value * 3) for year, value in rows])
        self.assertEqual(a["parameters"], b["parameters"])
        self.assertEqual(a["draws"], b["draws"])
        self.assertLess(a["maeTWh"]["logTrend"], 1e-9)
        self.assertTrue(a["beatsBothBaselines"])
        self.assertFalse(a["centralModelEligible"])
        self.assertEqual(len(a["draws"]), 1000)

    def test_missing_zero_and_duplicate_years(self):
        self.assertEqual(evaluate(self.rows()[1:])["status"], "unavailable")
        self.assertEqual(evaluate([(y, None if y == 2020 else v) for y, v in self.rows()])["status"], "unavailable")
        with self.assertRaises(ValueError):
            evaluate(self.rows() + [self.rows()[0]])
        with self.assertRaises(ValueError):
            evaluate([(y, 0 if y == 2015 else v) for y, v in self.rows()])


if __name__ == "__main__":
    unittest.main()
