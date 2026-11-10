"""MANDATORY private original-source tests; explicitly invoked, never skipped."""
import unittest
from wind_cost_source_attempt import ROOT, cost_labels, capacity_table, compatibility


class OriginalWindSourceTests(unittest.TestCase):
    def test_original_cost_labels_have_complete_fixed_years_and_known_basis(self):
        rows = cost_labels((ROOT / "cost-figure-page69-raw.txt").read_text())
        self.assertEqual(sorted(rows), list(range(2010, 2025)))
        self.assertEqual((rows[2010], rows[2018], rows[2024]), (2324, 1865, 1041))
        self.assertEqual((rows[2012], rows[2013]), (2165, 2234))

    def test_original_onshore_capacity_missing_training_years_cannot_be_spliced(self):
        costs = cost_labels((ROOT / "cost-figure-page69-raw.txt").read_text())
        capacity = capacity_table((ROOT / "capacity-report.txt").read_text())
        self.assertEqual((capacity[2015], capacity[2024]), (404844, 1053403))
        gate = compatibility(costs, capacity)
        self.assertEqual(gate["missingTrainingYears"], [2010, 2011, 2012, 2013, 2014])
        self.assertEqual(gate["missingHoldoutYears"], [])
        self.assertEqual(gate["status"], "rejected-before-fitting")
        self.assertFalse(gate["fitExecuted"])
        self.assertIsNone(gate["mae"])

    def test_wrong_scope_and_graph_precision_stay_explicit_rejections(self):
        costs = cost_labels((ROOT / "cost-figure-page69-raw.txt").read_text())
        capacity = capacity_table((ROOT / "capacity-report.txt").read_text())
        gate = compatibility(costs, capacity, capacity_scope="all-wind-or-annual-additions")
        self.assertTrue(any("technology/denominator" in r for r in gate["reasons"]))
        self.assertTrue(any("rounded figure" in r for r in gate["reasons"]))
        self.assertFalse(gate["centralModelEligible"])

    def test_wrong_currency_basis_cannot_be_silently_relabelled(self):
        text = (ROOT / "cost-figure-page69-raw.txt").read_text().replace("2024 USD/kW", "2025 USD/kW")
        with self.assertRaisesRegex(ValueError, "basis absent"):
            cost_labels(text)
