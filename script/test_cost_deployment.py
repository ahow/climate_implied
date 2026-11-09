import unittest
from cost_deployment_calibration import evaluate


class CostDeploymentTests(unittest.TestCase):
    def fixture(self):
        return [(y, 10 * (2 ** ((y - 2010) / 3)) ** -.5, 2 ** ((y - 2010) / 3)) for y in range(2010, 2026)]

    def test_known_exponent_and_no_automatic_promotion(self):
        rows = self.fixture()
        result = evaluate(rows)
        self.assertAlmostEqual(result["parameters"]["slope"], -.5)
        self.assertAlmostEqual(result["apparentCostDeclinePerDoubling"], 1 - 2 ** -.5)
        self.assertFalse(result["centralModelEligible"])
        self.assertEqual(evaluate(rows[:-1]), result)

    def test_missing_holdout_is_not_shortened_and_invalid_values_fail(self):
        rows = self.fixture()
        missing = evaluate([(y, c, None if y == 2024 else d) for y, c, d in rows])
        self.assertEqual(missing["status"], "training-fit-holdout-unavailable")
        self.assertEqual(missing["missingHoldoutYears"], [2024])
        with self.assertRaises(ValueError):
            evaluate(rows + [rows[0]])
        with self.assertRaises(ValueError):
            evaluate([(2010, 0, 1)] + rows[1:])
