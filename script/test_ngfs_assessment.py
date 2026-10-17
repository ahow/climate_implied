"""Synthetic audit-helper tests; never redistribute NGFS records as fixtures."""
import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location("ngfs", Path(__file__).with_name("assess-ngfs.py"))
ngfs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ngfs)


class InterpolationTests(unittest.TestCase):
    def test_uneven_spacing(self):
        self.assertEqual(ngfs.interpolate({"2020": "10", "2025": "", "2030": "20"}, 2024), 14)

    def test_signed_land_path(self):
        self.assertEqual(ngfs.interpolate({"2020": "2", "2030": "-2"}, 2025), 0)

    def test_exact_endpoints(self):
        self.assertEqual(ngfs.interpolate({"2020": "3", "2030": "7"}, 2030), 7)

    def test_no_extrapolation(self):
        with self.assertRaises(ValueError):
            ngfs.interpolate({"2020": "3", "2030": "7"}, 2100)

    def test_nonfinite_is_not_a_gap(self):
        with self.assertRaisesRegex(ValueError, "Nonfinite"):
            ngfs.interpolate({"2020": "3", "2025": "NaN", "2030": "7"}, 2025)

    def test_checksum_rejects_other_file(self):
        with self.assertRaisesRegex(ValueError, "checksum mismatch"):
            ngfs.audit(__file__)


if __name__ == "__main__":
    unittest.main()
