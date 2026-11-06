import unittest
import pandas as pd
from fair_native_bridge import apply_native_pathway

class NativeBridgeTests(unittest.TestCase):
    def fixture(self):
        row = {"scenario": "medium-extension", "variable": "CO2 FFI", "unit": "Gt CO2/yr", "2023.5": 99}
        row.update({str(y + .5): 0 for y in range(2024, 2101)})
        path = {"scenario": "implemented-policies", "unit": "Mt gas/year",
                "years": list(range(2024, 2101)), "gases": {"CO2-EIP": [1000] * 77}}
        return pd.DataFrame([row]), path

    def test_units_and_history(self):
        frame, path = self.fixture()
        result = apply_native_pathway(frame, path, {"CO2-EIP": 1000})
        self.assertEqual(result.iloc[0]["2024.5"], 1)
        self.assertEqual(result.iloc[0]["2023.5"], 99)
        self.assertEqual(frame.iloc[0]["2024.5"], 0)

    def test_unsupported_and_invalid_inputs(self):
        frame, path = self.fixture()
        with self.assertRaises(ValueError):
            apply_native_pathway(frame, path, {"CO2-EIP": 1000, "HFC-134": 1})
        path["gases"]["CO2-EIP"][1] = float("nan")
        with self.assertRaises(ValueError):
            apply_native_pathway(frame, path, {"CO2-EIP": 1000})
