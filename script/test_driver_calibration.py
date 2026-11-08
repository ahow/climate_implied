import importlib.util
import pathlib
import unittest

path = pathlib.Path(__file__).with_name("driver_calibration.py")
spec = importlib.util.spec_from_file_location("driver_calibration", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class DriverCalibrationTests(unittest.TestCase):
    def test_synthetic_logistic_recovery_and_no_holdout_leakage(self):
        import math
        rows = [(year, 1 / (1 + math.exp(-(.2 * (year - 2010) - 3)))) for year in range(2010, 2025)]
        fitted = module.evaluate(rows)
        self.assertLess(fitted["maePercentagePoints"]["logistic"], 1e-10)
        changed = module.evaluate([(year, value if year < 2019 else .9) for year, value in rows])
        self.assertEqual(fitted["parameters"], changed["parameters"])

    def test_incomplete_evaluation_is_unavailable(self):
        self.assertEqual(module.evaluate([(2010, .1)])["status"], "unavailable")
