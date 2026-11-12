import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("workplan-evidence-run.py")
spec = importlib.util.spec_from_file_location("workplan_evidence_run_receipt", SCRIPT)
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class WorkplanEvidenceReceiptTests(unittest.TestCase):
    def test_full_checks_keeps_original_document_validator_mandatory(self):
        command = runner.FULL_CHECK_COMMAND
        self.assertEqual(command[:2], ["bash", "-c"])
        pipeline = command[2]
        self.assertTrue(pipeline.startswith("set -e;"))
        for required in (
            "npm run check", "script/*.test.ts", "unittest discover",
            "uv run python script/validate_status_choice_width_private.py",
            "npx tsx --test script/validate-valuation-rule-chronology-private.ts",
            "validate-workbook-money-integration-private.ts --private-primary",
            "validate-issuer-cashflow-private.ts",
            "validate-issuer-cashflow-reconciliation-private.ts", "npm run build",
        ):
            self.assertIn(required, pipeline)
        self.assertNotIn("if ", pipeline)
        self.assertNotIn("||", pipeline)
        self.assertIn("npx tsx --test --test-concurrency=2 --test-reporter=tap script/*.test.ts", pipeline)
        self.assertNotIn("--test-name-pattern", pipeline)
        self.assertNotIn("--test-skip-pattern", pipeline)

    def test_receipt_only_without_history_or_canonical_ledgers(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "script").mkdir()
            shutil.copy2(SCRIPT, root / "script/workplan-evidence-run.py")
            log = root / "execution.log"
            receipt = root / "receipt.json"
            result = subprocess.run(
                [sys.executable, str(root / "script/workplan-evidence-run.py"),
                 "--receipt-only", "--log", str(log), "--receipt", str(receipt),
                 "--", sys.executable, "-c",
                 "print('# tests 2\\n# pass 2\\n# fail 0\\n# skipped 0\\nRan 3 tests in 0.001s\\nOK')"],
                cwd=root, capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            data = json.loads(receipt.read_text())
            self.assertFalse((root / "docs").exists())
            self.assertFalse((root / ".git").exists())
            self.assertFalse(data["canonical_ledgers_modified"])
            self.assertIsNone(data["workspace_revision"])
            self.assertEqual(data["log_sha256"], hashlib.sha256(log.read_bytes()).hexdigest())
            self.assertEqual(data["suite_counts"]["typescript"],
                             {"tests": 2, "pass": 2, "fail": 0, "skipped": 0})
            self.assertEqual(data["suite_counts"]["python"],
                             {"tests": 3, "pass": 3, "fail": 0, "skipped": 0})

    def test_failed_execution_remains_failed_and_logs_exact_output(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "failed.log"
            receipt = Path(directory) / "failed.json"
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--receipt-only", "--log", str(log),
                 "--receipt", str(receipt), "--", sys.executable, "-c",
                 "print('explicit isolated engineering failure'); raise SystemExit(7)"],
                capture_output=True, text=True, timeout=30)
            self.assertEqual(result.returncode, 7)
            data = json.loads(receipt.read_text())
            self.assertEqual(data["exit_code"], 7)
            self.assertEqual(log.read_text(), "explicit isolated engineering failure\n")
            self.assertIsNone(data["counts"])


if __name__ == "__main__":
    unittest.main()
