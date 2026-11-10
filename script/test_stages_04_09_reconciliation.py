import json
import unittest
from pathlib import Path

from reconcile_stages_04_09 import CLAUSES, GROUPS, FORMULAS, CHECK_TYPES, DELIVERED


class ReconciliationTests(unittest.TestCase):
    def test_every_original_clause_and_concrete_gap_present(self):
        ledger = json.loads(Path("docs/workplan_completion_ledger.json").read_text())
        records = json.loads(Path("docs/reconciliation-stages-04-09.json").read_text())["records"]
        original = [r for s in ledger["stages"] if 4 <= s["stage"] <= 9 for r in s["requirements"]]
        self.assertEqual(len(records), 81)
        self.assertEqual({r["id"] for r in records}, {r["id"] for r in original})
        for before, after in zip(original, records):
            self.assertEqual(before["requirement"], after["requirement"])
            self.assertEqual(before["source_section"], after["source_section"])
            self.assertEqual(before["origin"], after["origin"])
            self.assertTrue(after["originalSourceVerified"])
            self.assertTrue(after["remaining_gaps"])
            self.assertTrue(after["next_action"])
            self.assertTrue(after["check_type"])

    def test_direct_sources_and_formula_coverage(self):
        for clauses in CLAUSES.values():
            for group, gap in clauses:
                self.assertIn(group, FORMULAS)
                self.assertGreater(len(gap), 30)
                for file in GROUPS[group]:
                    self.assertTrue(Path(file).is_file(), file)

    def test_no_new_scientific_promotion_or_frozen_gate_alias(self):
        report = json.loads(Path("docs/reconciliation-stages-04-09.json").read_text())
        self.assertEqual(report["frozenPreservation"]["historyProtocolSha256"],
                         "1fa60cb7c948c915dffaf4fb967578aa8c6aadd689845577d63ad201c879f20d")
        self.assertFalse(report["frozenPreservation"]["endpointOrInfillAcceptanceRerun"])
        for record in report["records"]:
            self.assertEqual(record["scientific_acceptance"], "not-promoted")
        self.assertEqual(report["directResults"]["history"]["humanWarming"]["status"], "unavailable")
        self.assertEqual(report["directResults"]["reference"]["actualRuns"], 12)

    def test_original_check_classifications_and_current_canonical_evidence(self):
        report = json.loads(Path("docs/reconciliation-stages-04-09.json").read_text())
        records = {r["id"]: r for r in report["records"]}
        for stage, types in CHECK_TYPES.items():
            self.assertEqual(len(types), len(CLAUSES[stage]))
            for index, expected in enumerate(types):
                record = records[f"S{stage:02d}-{index+1:03d}"]
                self.assertIn(expected, {"exact", "numerical", "operational", "judgement"})
                self.assertEqual(record["check_type"], expected)
                self.assertEqual(record["checkType"], expected)
                self.assertIn("clause-reconciliation-proposal", record["check_scope"])
                self.assertEqual(record["behaviour_delivered_this_run"], DELIVERED[stage][index])
                self.assertIn(record["exactRemainingGaps"][0], record["evidence_caveat"])
                self.assertNotIn("Stage-level report pointer", record["evidence_caveat"])
                self.assertTrue(record["files_functions_changed"])
                self.assertTrue(record["inputs_versions_assumptions"])
                self.assertTrue(record["numerical_results"])
        history = records["S07-008"]
        result = history["numerical_results"][0]
        self.assertTrue(result["retainedNativePhysics"]["unitsAndBaselinesRetained"])
        self.assertEqual(result["nativeEmissionsComparison"].split(":")[0], "Unavailable")
        self.assertIn("actual FaIR native emissions are retained", result["nativeEmissionsComparison"])
        self.assertTrue(any("forcing-comparison.log" in e["log"] for e in history["executions"]))
        self.assertTrue(any("regeneration-with-units.log" in e["log"] for e in history["executions"]))
        self.assertEqual(result["humanWarming"]["status"], "unavailable")


if __name__ == "__main__":
    unittest.main()
