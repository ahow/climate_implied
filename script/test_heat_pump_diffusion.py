import unittest, math
from heat_pump_diffusion import evaluate, fit_linear

class T(unittest.TestCase):
    def test_exact_exponential_is_recovered(self):
        s = {y: 100 * 1.1 ** (y - 2000) for y in range(2000, 2015)}
        r = evaluate(s, list(range(2000, 2010)), list(range(2010, 2015)))
        self.assertEqual(r["best"], "log_linear")
        self.assertAlmostEqual(r["log_linear_growth"], 0.1, places=10)
        self.assertLess(r["mape"]["log_linear"], 1e-10)
    def test_test_years_do_not_enter_fit(self):
        s = {y: float(y) for y in range(2000, 2010)}
        s2 = dict(s); s2[2009] = 1e9
        a = evaluate(s, list(range(2000, 2008)), [2008])
        b = evaluate(s2, list(range(2000, 2008)), [2008])
        self.assertEqual(a["mape"], b["mape"])

if __name__ == "__main__":
    unittest.main()
