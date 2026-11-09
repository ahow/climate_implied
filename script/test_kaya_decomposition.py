import unittest
from kaya_decomposition import decompose, evaluate


class KayaTests(unittest.TestCase):
    def row(self, year=2010, p=10, g=100, e=50, c=20):
        return dict(year=year, population=p, gdp=g, primary_energy_consumption=e, co2=c)

    def test_single_driver_and_offsets(self):
        result = decompose(self.row(), self.row(p=20, g=200, e=100, c=40))
        self.assertAlmostEqual(result["contributionsMtCO2"]["population"], 20)
        self.assertAlmostEqual(sum(result["contributionsMtCO2"].values()), 20)
        result = decompose(self.row(), self.row(p=20))
        self.assertAlmostEqual(sum(result["contributionsMtCO2"].values()), 0)
        self.assertGreater(result["contributionsMtCO2"]["population"], 0)
        self.assertLess(result["contributionsMtCO2"]["incomePerPerson"], 0)

    def test_chain_order_missing_and_no_future_leak(self):
        rows = [self.row(y, c=20 + y - 2010) for y in range(2010, 2019)]
        report = evaluate(rows, 2010, 2018)
        self.assertEqual(report, evaluate(rows[::-1], 2010, 2018))
        self.assertEqual(report, evaluate(rows + [self.row(2030)], 2010, 2018))
        self.assertAlmostEqual(sum(report["chainContributionsMtCO2"].values()), 8)
        self.assertEqual(evaluate(rows[:-1], 2010, 2018)["status"], "unavailable")
        with self.assertRaises(ValueError):
            evaluate(rows + rows, 2010, 2018)

    def test_invalid_and_near_equal(self):
        for value in [0, -1, float("nan"), float("inf"), True]:
            with self.assertRaises(ValueError):
                decompose(self.row(), self.row(c=value))
        result = decompose(self.row(), self.row(c=20 + 1e-10))
        self.assertLess(abs(result["reconciliationResidualMt"]), 1e-12)


if __name__ == "__main__":
    unittest.main()
