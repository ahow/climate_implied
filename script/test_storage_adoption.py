import unittest
from storage_adoption import evaluate


class StorageAdoption(unittest.TestCase):
    def test_exponential_and_determinism(self):
        rows = [(y, 40 * 1.3 ** (y - 2010)) for y in range(2010, 2025)]
        a = evaluate(rows)
        self.assertLess(a["mae"]["exponential"], 1e-8)
        self.assertTrue(a["beatsBothBaselines"])
        self.assertFalse(a["centralModelEligible"])
        self.assertEqual(a, evaluate(list(reversed(rows))))

    def test_future_does_not_change_fit(self):
        rows = [(y, float(y - 2000)) for y in range(2010, 2025)]
        a = evaluate(rows)
        b = evaluate([(y, v * 10 if y >= 2019 else v) for y, v in rows])
        self.assertEqual(a["parameters"], b["parameters"])
        self.assertEqual(a["growthInterval95"], b["growthInterval95"])

    def test_missing_refused(self):
        self.assertEqual(evaluate([(2010, 1)])["status"], "unavailable")

    def test_invalid_refused(self):
        for rows in [[(2010, 1), (2010, 2)], [(2010, float("nan"))], [(2010, -1)]]:
            with self.assertRaises(ValueError):
                evaluate(rows)
