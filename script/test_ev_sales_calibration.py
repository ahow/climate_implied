import unittest
from ev_sales_calibration import evaluate, logistic


class EVCalibrationTests(unittest.TestCase):
    def fixture(self):
        return [(y, logistic(-5 + .4 * (y - 2010))) for y in range(2010, 2026)]

    def test_known_logistic_and_future_exclusion(self):
        rows = self.fixture()
        result = evaluate(rows)
        self.assertLess(result["maePercentagePoints"]["logistic"], 1e-10)
        self.assertTrue(result["diagnosticGatePassed"])
        self.assertFalse(result["centralModelEligible"])
        self.assertEqual(len(result["parameterDraws"]), 1000)
        changed = rows[:-1] + [(2025, 0)]
        self.assertEqual(evaluate(changed), result)

    def test_missing_endpoints_duplicates_and_invalid_shares(self):
        rows = self.fixture()
        self.assertEqual(evaluate(rows[1:])["status"], "unavailable")
        self.assertEqual(evaluate([(2010, 0)] + rows[1:])["status"], "unavailable")
        with self.assertRaises(ValueError):
            evaluate(rows + [rows[0]])
        with self.assertRaises(ValueError):
            evaluate([(2010, float("nan"))] + rows[1:])
        with self.assertRaises(ValueError):
            evaluate([(2010, 1.1)] + rows[1:])
