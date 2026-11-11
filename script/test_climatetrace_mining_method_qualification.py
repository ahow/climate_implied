"""Small source-independent unit/qualification fixtures,not scientific data."""
from decimal import Decimal
import unittest

from climatetrace_mining_method_qualification import (
    decimal_native, input_pair_audit, locate, method_source_admission, native_formula,
)


class MiningMethodQualificationTests(unittest.TestCase):
    def row(self):
        return {"gas": "co2", "activity": "3.000000000000000000001",
                "activity_units": "t of fixture ore", "emissions_factor": "2",
                "emissions_factor_units": "t of CO2 per t of fixture ore",
                "emissions_quantity": "6.000000000000000000002"}

    def test_exact_native_product_no_factor_fit_or_float_rounding(self):
        result = native_formula(self.row())
        self.assertEqual(result["auditResidual"], Decimal(0))
        self.assertEqual(result["auditProduct"], Decimal("6.000000000000000000002"))
        row = self.row()
        row["emissions_quantity"] = "6.000000000000000000003"
        self.assertEqual(native_formula(row)["auditResidual"], Decimal("1e-21"))
        self.assertEqual(row["emissions_factor"], "2")

    def test_missing_input_not_zero_filled(self):
        row = self.row()
        row["activity"] = ""
        result = native_formula(row)
        self.assertIsNone(result["activity"])
        self.assertIsNone(result["auditProduct"])
        self.assertEqual(result["status"], "missing-native-input-not-filled")
        row["activity"] = "0"
        row["emissions_quantity"] = "0"
        self.assertEqual(native_formula(row)["auditProduct"], Decimal(0))

    def test_native_units_not_guessed_or_converted(self):
        for key, value in (("activity_units", "kg of fixture ore"),
                           ("emissions_factor_units", "kg CO2 per ton")):
            row = self.row()
            row[key] = value
            result = native_formula(row)
            self.assertIsNone(result["auditProduct"])
            self.assertEqual(result["status"], "incompatible-or-unverified-native-units")
        row = self.row()
        row["gas"] = "co2e_100yr"
        with self.assertRaises(ValueError):
            native_formula(row)

    def test_nonfinite_negative_and_bad_native_input_rejected(self):
        for value in ("NaN", "Infinity", "-1", "bad"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                decimal_native(value)

    def test_new_input_field_pairs_not_old_CO2_repetition(self):
        indexed = {
            ("fixture", "A", "USA", "01", "2024"): {"activity": Decimal("1.01"), "factor": Decimal("2")},
            ("fixture", "A", "USA", "01", "2025"): {"activity": Decimal("1.01"), "factor": Decimal("2")},
            ("fixture", "A", "USA", "01", "2026"): {"activity": Decimal("1.02"), "factor": None},
        }
        result = input_pair_audit(indexed)
        self.assertEqual(result[0]["newNativeInputFieldComparisons"]["activity"]["exactEqualPairs"], 1)
        self.assertEqual(result[1]["newNativeInputFieldComparisons"]["activity"]["maxAbsDifference"], "0.01")
        self.assertEqual(result[1]["newNativeInputFieldComparisons"]["factor"]["missingPairs"], 1)
        self.assertFalse(result[0]["CO2QuantityRepetitionAuditRerun"])

    def test_source_page_proof_requires_all_terms_on_same_page(self):
        text = "Annual\u200b method\fMining annual disaggregation EDGAR\fsame month forward rule"
        proof = locate(text, {"assignment": ["Mining", "annual", "EDGAR"]})
        self.assertEqual(proof["assignment"]["pages"], [2])
        with self.assertRaises(ValueError):
            locate(text, {"not_same_page": ["Annual method", "same month"]})

    def test_annual_disaggregation_never_admitted_as_fresh_monthly_outcomes(self):
        mining = {k: {} for k in ("annual_estimate_horizon", "noncurrent_2024_production", "retrospective_factors")}
        temporal = {k: {} for k in ("mining_annual_disaggregation", "same_month_forward_extrapolation")}
        admission = method_source_admission(mining, temporal, "2024-12-31")
        self.assertTrue(admission["publisherMethodDependencyQualified"])
        self.assertFalse(admission["independentRealizedMonthly2025Or2026OutcomeAdmitted"])
        self.assertFalse(admission["fitEligible"])
        self.assertFalse(admission["historicalOriginVintageAdmitted"])
        with self.assertRaises(ValueError):
            method_source_admission({}, temporal, "2024-12-31")


if __name__ == "__main__":
    unittest.main()
