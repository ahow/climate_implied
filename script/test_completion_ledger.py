import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "script" / (name + ".py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class CompletionLedgerTests(unittest.TestCase):
    def test_all_scope_retained(self):
        ledger = json.loads((ROOT / "docs/workplan_completion_ledger.json").read_text())
        self.assertEqual(load("completion-ledger").validate(ledger), 300)
        self.assertEqual(len(ledger["amendments"]), 14)

    def test_no_verified_without_execution(self):
        ledger = json.loads((ROOT / "docs/workplan_completion_ledger.json").read_text())
        bad = copy.deepcopy(ledger)
        bad["stages"][0]["requirements"][0]["status"] = "verified"
        bad["stages"][0]["requirements"][0]["executions"] = []
        with self.assertRaises(ValueError):
            load("completion-ledger").validate(bad)

    def test_actual_counts_only(self):
        parser = load("workplan-evidence-run").counts
        self.assertIsNone(parser("Build completed"))
        self.assertIsNone(parser("Plan: run 300 tests"))
        self.assertEqual(parser("# tests 4\n# pass 2\n# fail 1\n# skipped 1\n"),
                         {"tests": 4, "pass": 2, "fail": 1, "skipped": 1})
        self.assertEqual(parser("Ran 4 tests in 1s\nFAILED (failures=1, skipped=1)\n"),
                         {"tests": 4, "pass": 2, "fail": 1, "skipped": 1})
