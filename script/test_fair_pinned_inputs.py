import importlib.util
from pathlib import Path
import tempfile
import unittest


class PinnedInputsTests(unittest.TestCase):
    def test_corrupt_cached_input_refused_before_model_execution(self):
        spec = importlib.util.spec_from_file_location("pinned_runner", Path(__file__).with_name("fair-reference.py"))
        runner = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(runner)
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            runner.ROOT = root / "reference"
            (root / runner.FILES[0]).write_bytes(b"altered data")
            with self.assertRaisesRegex(ValueError, "hash mismatch"):
                runner.main(output_directory=root / "output", inputs_directory=root)
