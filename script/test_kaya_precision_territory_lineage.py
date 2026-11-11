"""Public representation-contract tests;no retained data or private files."""
import unittest
from decimal import Decimal

from kaya_precision_territory_lineage import binary32,literal_assignment,representation_proof,strict_display_gate


class PrecisionLineageTests(unittest.TestCase):
    def observed(self):
        return {stage:{"dtype":"FLOAT","value":str(value)} for stage,value in
                [("meadow",16.75),("gcb_garden",16750000.0),("co2_garden",16.75)]}

    def test_complete_source_path_closes_without_replacing_input(self):
        result=representation_proof("16.750000","16.750",self.observed(),Decimal("1e6"),Decimal("1e-6"),"%.3f")
        self.assertTrue(result["sourcePathReproduced"])
        self.assertFalse(result["referenceReplacesNative"])
        self.assertEqual(result["accountingResidualMtCO2"],0)
        self.assertEqual(result["emulatedExportMinusNativeMtCO2"],0)

    def test_original_strict_failure_not_relaxed_when_path_explained(self):
        self.assertFalse(strict_display_gate("1.000507","1.000"))
        self.assertTrue(strict_display_gate("1.000500","1.000"))

    def test_unknown_dtype_not_forced_to_float32(self):
        observed=self.observed()
        observed["meadow"]["dtype"]="DOUBLE"
        with self.assertRaises(ValueError):
            representation_proof("16.75","16.750",observed,Decimal("1e6"),Decimal("1e-6"),"%.3f")

    def test_missing_or_mismatched_stage_fails(self):
        observed=self.observed()
        del observed["meadow"]
        with self.assertRaises(ValueError):
            representation_proof("16.75","16.750",observed,Decimal("1e6"),Decimal("1e-6"),"%.3f")
        observed=self.observed()
        observed["gcb_garden"]["value"]="16750001"
        with self.assertRaises(ValueError):
            representation_proof("16.75","16.750",observed,Decimal("1e6"),Decimal("1e-6"),"%.3f")

    def test_no_fitted_unit_constant_or_changed_csv_precision(self):
        for outward,inward,fmt in [(Decimal("1e6"),Decimal(".00000101"),"%.3f"),
                                  (Decimal("1e6"),Decimal(".000001"),"%.2f")]:
            with self.assertRaises(ValueError):
                representation_proof("16.75","16.750",self.observed(),outward,inward,fmt)

    def test_source_numeric_literal_not_arbitrary_execution(self):
        self.assertEqual(literal_assignment("CONVERSION = 1e-6","CONVERSION"),Decimal("1e-6"))
        for text in ["CONVERSION = unsafe()", "CONVERSION = other", "OTHER = 1e-6"]:
            with self.assertRaises(ValueError):
                literal_assignment(text,"CONVERSION")

    def test_bad_native_export_is_not_repaired(self):
        with self.assertRaises(ValueError):
            representation_proof("16.75","16.751",self.observed(),Decimal("1e6"),Decimal("1e-6"),"%.3f")

    def test_binary32_finite_only(self):
        for x in [float("nan"),float("inf")]:
            with self.assertRaises(ValueError):
                binary32(x)
        self.assertEqual(binary32(16.75),16.75)


if __name__=="__main__":
    unittest.main()
