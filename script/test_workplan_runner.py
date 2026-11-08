import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys

spec = importlib.util.spec_from_file_location("workplan_runner", Path(__file__).with_name("run-workplan.py"))
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class WorkplanRunnerTests(unittest.TestCase):
    def test_python_sibling_imports(self):
        with tempfile.TemporaryDirectory() as directory:
            result = runner.execute(
                [sys.executable, "-c", "import ngfs_pathway_adapter"],
                Path(directory) / "import.log", 30)
        self.assertEqual(result["status"], "passed")

    def test_failure_continues_and_never_claims_acceptance(self):
        calls = []
        def fake(command, path, timeout):
            calls.append(command)
            return {"status": "failed" if len(calls) == 1 else "passed"}
        state = {"stages": {}}
        with tempfile.TemporaryDirectory() as directory:
            runner.run_stages(state, Path(directory), 1, False, fake)
        self.assertEqual(len(state["stages"]), 18)
        self.assertEqual(state["stages"]["0"]["status"], "failed")
        self.assertEqual(state["stages"]["17"]["status"], "passed")
        self.assertTrue(all(s["acceptance"] == "incomplete" for s in state["stages"].values()))

    def test_resume_skips_passes_and_retries_failures(self):
        state = {"stages": {str(i): {"status": "passed"} for i in range(18)}}
        state["stages"]["3"]["status"] = "failed"
        calls = []
        def fake(command, path, timeout):
            calls.append(command)
            return {"status": "passed"}
        with tempfile.TemporaryDirectory() as directory:
            runner.run_stages(state, Path(directory), 1, False, fake)
        self.assertEqual(len(calls), len(runner.STAGES[3][1]))

    def test_missing_command_continues(self):
        def fake(command, path, timeout):
            raise FileNotFoundError("unavailable")
        state = {"stages": {}}
        with tempfile.TemporaryDirectory() as directory:
            runner.run_stages(state, Path(directory), 1, False, fake)
        self.assertEqual(len(state["stages"]), 18)
        self.assertTrue(all(s["status"] == "failed" for s in state["stages"].values()))


if __name__ == "__main__":
    unittest.main()
