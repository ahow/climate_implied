import unittest

from kaya_source_assembly import EU27, membership_audit
from kaya_decomposition import FIELDS
from kaya_primary_history_sources import annual_inventory


class SourceAssemblyTests(unittest.TestCase):
    def rows(self):
        return [{"iso_code": code, "year": year, **dict.fromkeys(FIELDS, 2.0)}
                for code in ("AAA", "BBB") for year in range(2010, 2025)]

    def test_fixed_membership_and_full_window(self):
        self.assertEqual(len(EU27), 27)
        result = membership_audit(self.rows(), ("AAA", "BBB"))
        self.assertTrue(result["complete"])
        self.assertEqual(len(result["annual"]), 15)
        self.assertEqual(result["annual"][-1]["gdp"], 4)

    def test_no_partial_sum_or_shortened_window(self):
        rows = self.rows()
        rows[-1]["gdp"] = None
        result = membership_audit(rows, ("AAA", "BBB"))
        self.assertFalse(result["complete"])
        self.assertIsNone(result["annual"][-1]["gdp"])
        self.assertEqual(result["missingCells"], [
            {"member": "BBB", "year": 2024, "field": "gdp"}])

    def test_duplicate_and_invalid(self):
        rows = self.rows()
        with self.assertRaises(ValueError):
            membership_audit(rows + [rows[0]], ("AAA", "BBB"))
        with self.assertRaises(ValueError):
            membership_audit(rows, ("AAA", "AAA"))
        rows[0]["gdp"] = float("nan")
        with self.assertRaises(ValueError):
            membership_audit(rows, ("AAA", "BBB"))

    def test_annual_independent_inventory(self):
        good = "year,forcing\n2023,-0.1\n2024,0.2\n"
        self.assertTrue(annual_inventory(good, 2023, 2024)["completeAnnual"])
        self.assertFalse(annual_inventory(good, 2023, 2024)["independentFaIRNumericalReference"])
        self.assertEqual(annual_inventory("year,t\n2023.5,1\n2024.5,2\n",
                         2023, 2024, .5)["timeCoordinateOffset"], .5)
        for bad in ("year,f\n2024,1\n", "year,f\n2023,1\n2023,2\n",
                    "year,f\n2023,nan\n2024,1\n"):
            with self.assertRaises(ValueError):
                annual_inventory(bad, 2023, 2024)


if __name__ == "__main__":
    unittest.main()
