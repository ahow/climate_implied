import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("merge",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class ReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.ledger={"source_hash":"untouched","stages":[{"requirements":[
            {"id":"S00-001","requirement":"Original criterion","origin":"original",
             "source_section":"acceptance","status":"not-yet-reconciled"}]}]}
        self.record={"id":"S00-001","status":"partial","check_type":"exact",
                     "executions":[],
                     "next_action":"Execute the missing integration check"}
    def test_merge_preserves_contract(self):
        result=m.merge(self.ledger,[[self.record]])
        self.assertEqual(m.contract_digest(result),m.contract_digest(self.ledger))
        self.assertEqual(result["source_hash"],"untouched")
        self.assertEqual(self.ledger["stages"][0]["requirements"][0]["status"],"not-yet-reconciled")
    def test_duplicates_missing_and_rewording_reject(self):
        for rows in ([[self.record,self.record]], [], [[dict(self.record,requirement="Changed")]]):
            with self.assertRaises(ValueError):m.merge(self.ledger,rows)
    def test_unsupported_verification_rejects(self):
        with self.assertRaises(ValueError):
            m.merge(self.ledger,[[dict(self.record,status="verified")]])
    def test_partition_and_classification(self):
        self.assertEqual(m.partition("reconciliation-stages-00-03.json",[self.record]),[self.record])
        with self.assertRaises(ValueError):
            m.partition("reconciliation-stages-04-09.json",[self.record])
        with self.assertRaises(ValueError):
            m.merge(self.ledger,[[dict(self.record,check_type="generic audit")]])
    def test_full_actual_matrix_has_all_original_criteria(self):
        import json
        ledger=json.loads(Path("docs/workplan_completion_ledger.json").read_text())
        requirements=[r for s in ledger["stages"] for r in s["requirements"]]
        self.assertEqual(len(requirements),300)
        self.assertEqual(len({r["id"] for r in requirements}),300)
        self.assertEqual(m.contract_digest(ledger),"5e1a09aa71c87286779eb444db2e0b0361015b3d1bfb058e320f836ca46b4de5")
        rendered=m.matrix(ledger)
        for r in requirements:
            self.assertIn(r["check_type"],m.CHECK_TYPES)
            self.assertIn("| "+r["id"]+" | ",rendered)
            self.assertIn(r["requirement"].replace("|","\\|").replace("\n"," "),rendered)
        self.assertEqual(rendered.count('"recordSha256"'),300)

if __name__=="__main__":
    unittest.main()
