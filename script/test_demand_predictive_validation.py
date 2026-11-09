import unittest
from demand_predictive_validation import evaluate, holm


class DemandPredictiveTests(unittest.TestCase):
    def setUp(self):
        self.rows = [(y, 100 + 3 * (y - 2010) + (y % 3)) for y in range(2010, 2025)]

    def test_replay_and_no_holdout_leakage(self):
        original = evaluate(self.rows)
        self.assertEqual(original, evaluate(list(reversed(self.rows))))
        changed = evaluate([(y, v * 4 if y >= 2019 else v) for y, v in self.rows])
        self.assertEqual(original["breakPValue"], changed["breakPValue"])
        self.assertEqual([h["predictiveInterval95TWh"] for h in original["holdout"]],
                         [h["predictiveInterval95TWh"] for h in changed["holdout"]])
        self.assertFalse(original["centralModelEligible"])
        self.assertEqual(changed["coveredYears"], 0)
        self.assertGreater(changed["meanIntervalScoreTWh"], original["meanIntervalScoreTWh"])

    def test_invalid_and_missing(self):
        self.assertEqual(evaluate(self.rows[1:])["status"], "unavailable")
        for value in (0, -1, float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                evaluate([(2010, value)] + self.rows[1:])
        with self.assertRaises(ValueError):
            evaluate(self.rows + self.rows[:1])

    def test_holm(self):
        self.assertEqual(holm([.01, .04, .03]), [.03, .06, .06])
        self.assertEqual(holm([1, 1, 1]), [1, 1, 1])
        with self.assertRaises(ValueError):
            holm([float("nan")])
