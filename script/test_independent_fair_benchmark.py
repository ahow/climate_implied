import unittest
import numpy as np
import xarray as xr
from independent_fair_benchmark import compare


class ReferenceTests(unittest.TestCase):
    def test_threshold_and_reject(self):
        ref = xr.DataArray([1.0], dims=["config"], coords={"config": ["a"]})
        self.assertTrue(compare(ref + .009, ref, True)["passed"])
        self.assertFalse(compare(ref + .011, ref, True)["passed"])
        with self.assertRaises(ValueError):
            compare(ref * np.nan, ref)
        with self.assertRaises(ValueError):
            compare(ref.assign_coords(config=["b"]), ref)


if __name__ == "__main__":
    unittest.main()
