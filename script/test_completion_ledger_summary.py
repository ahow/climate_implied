import importlib.util
from pathlib import Path
import unittest

class LedgerSummaryTests(unittest.TestCase):
    def test_summary_is_derived_not_a_stale_acceptance_claim(self):
        spec=importlib.util.spec_from_file_location("ledger_summary",Path(__file__).with_name("completion-ledger.py"))
        module=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        data={"stage_status_counts":{"5":{"verified":99}},
              "stages":[{"stage":5,"requirements":[{"status":"partial"},{"status":"not-yet-reconciled"}]}]}
        module.refresh_summary(data)
        self.assertEqual(data["stage_status_counts"],{"5":{"partial":1,"not-yet-reconciled":1}})

if __name__=="__main__":
    unittest.main()
