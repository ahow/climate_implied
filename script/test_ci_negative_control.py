import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("ci_control", Path(__file__).with_name("verify-ci-negative-control.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class NegativeControlTests(unittest.TestCase):
    def test_exact_failure_and_skipped_promotion_required(self):
        jobs = [{"name": "validate", "conclusion": "failure"}, {"name": "promote", "conclusion": "skipped"}]
        self.assertTrue(module.assess(jobs, "same", "same"))
        self.assertFalse(module.assess(jobs, "before", "after"))
        self.assertFalse(module.assess(jobs[:1], "same", "same"))
        self.assertFalse(module.assess([{"name": "validate", "conclusion": "success"},
                                       {"name": "promote", "conclusion": "skipped"}], "same", "same"))
