"""Independent source-admission engineering tests, not calibration fixtures."""
import unittest

from kaya_highfrequency_source_bridge import EU27, assemble_eu27, extract_issue_cells


def primary_fixture():
    return [{"countrycode": c, "year": y, "gdppc": 20000., "pop": 1000., "sourceRow": i+1}
            for i, (c, y) in enumerate((c, y) for c in EU27 for y in range(2010, 2025))]


class KayaHighFrequencySourceTests(unittest.TestCase):
    def test_native_thousands_and_fixed_membership(self):
        result = assemble_eu27(primary_fixture())
        self.assertTrue(result["completeFrozenWindow"])
        self.assertEqual(result["annual"][0]["GDP2011InternationalDollars"], 27*20000*1000*1000)
        self.assertEqual(len(result["nativeMemberYearCells"]), 405)
        self.assertFalse(result["fitExecuted"])
        self.assertFalse(result["centralEligible"])

    def test_missing_member_is_not_partial_region_or_interpolation(self):
        rows = [r for r in primary_fixture() if not (r["countrycode"] == "MLT" and r["year"] == 2024)]
        result = assemble_eu27(rows)
        self.assertFalse(result["completeFrozenWindow"])
        self.assertIsNone(result["annual"][-1]["GDP2011InternationalDollars"])
        self.assertEqual(result["missingMemberYears"], [{"member": "MLT", "year": 2024, "missingInputs": ["gdppc", "pop"]}])
        self.assertEqual(result["annual"][-1]["membersObserved"], 26)

    def test_duplicate_nonfinite_and_nonpositive_cells_rejected(self):
        rows = primary_fixture()
        with self.assertRaises(ValueError):
            assemble_eu27(rows+[rows[0]])
        for value in (float("nan"), float("inf"), 0., -1.):
            bad = primary_fixture()
            bad[0]["gdppc"] = value
            with self.subTest(value=value), self.assertRaises(ValueError):
                assemble_eu27(bad)

    def test_no_percentage_backsolve_or_graph_only_cell(self):
        text = "Section 5: Electricity\nGeneration rose by 1.3 per cent.\nSection 6: Renewables"
        with self.assertRaisesRegex(ValueError, "Unique exact published"):
            extract_issue_cells(text, 2026)

    def test_quarterly_original_numbers_do_not_become_monthly_or_co2(self):
        text = """Section 5: Electricity
        generation rise by 1.3 per cent to 80.0 TWh
        Total renewable generation increased by 18 per cent to 40.0 TWh
        fall in nuclear generation to 8.0 TWh
        Fossil fuel generation fell 16 per cent to 30.0 TWh
        comes from gas, which fell by 16 per cent to 29.0 TWh
        wind generation up 30 per cent to a quarterly record of 27.0 TWh
        Section 6: Renewables"""
        cells = extract_issue_cells(text, 2026)
        self.assertEqual(len(cells), 6)
        self.assertEqual(cells["total_generation"]["value"], 80.)
        self.assertTrue(all(c["period"] == "2026-Q1" and c["unit"] == "TWh" for c in cells.values()))
        self.assertTrue(all("rounded" in c["sourcePrecision"] for c in cells.values()))
        with self.assertRaises(ValueError):
            extract_issue_cells(text.replace("40.0 TWh", "forty"), 2026)


if __name__ == "__main__":
    unittest.main()
