import math
import unittest

from forecast_kaya import evaluate, prepare
from kaya_decomposition import FIELDS


def rows():
    return [{"year": y, **dict(zip(FIELDS, [
        100 * math.exp(.01 * (y - 2010)),
        200 * math.exp(.03 * (y - 2010)),
        300 * math.exp(.02 * (y - 2010)),
        400 * math.exp(.015 * (y - 2010))]))} for y in range(2010, 2025)]


class ForecastKayaTests(unittest.TestCase):
    def test_holdout_cannot_change_fit_or_predictions(self):
        a = rows()
        b = rows()
        for r in b[9:]:
            for k in FIELDS:
                r[k] *= 2
        x, z = evaluate(a), evaluate(b)
        self.assertEqual(x["parameters"], z["parameters"])
        self.assertEqual(x["predictions"], z["predictions"])
        self.assertEqual(x["intervals"], z["intervals"])

    def test_order_and_identity(self):
        a = evaluate(rows())
        self.assertEqual(a, evaluate(list(reversed(rows()))))
        self.assertLess(a["identityRelativeError"], 1e-9)
        self.assertFalse(a["centralEligible"])

    def test_missing(self):
        self.assertEqual(evaluate(rows()[:-1])["status"], "unavailable")
        a = rows()
        a[2]["gdp"] = None
        self.assertEqual(evaluate(a)["status"], "unavailable")

    def test_invalid(self):
        for bad in (0, -1, float("nan"), float("inf")):
            a = rows()
            a[0]["co2"] = bad
            with self.assertRaises(ValueError):
                prepare(a)
        with self.assertRaises(ValueError):
            prepare(rows() + [rows()[0]])


if __name__ == "__main__":
    unittest.main()
