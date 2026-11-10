import unittest

import numpy as np
import xarray as xr
from compare_retained_igcc_physics import compare_forcing, human_warming_check


class PhysicsComparisonTests(unittest.TestCase):
    def test_no_publication_year_alias_or_total_temperature_attribution(self):
        self.assertEqual(human_warming_check()["status"], "unavailable")
        annual = {y: [1, 1.25, 2] for y in range(2016, 2025)}
        result = human_warming_check(annual, "human-induced GMST", "1850-1900 inclusive", "human-induced GMST")
        self.assertIsNone(result["shareMeanMembersInRange"])
        annual[2025] = [1, 1.25, 2]
        self.assertEqual(human_warming_check(annual, "total GSAT", "1850-1900 inclusive")["status"], "unavailable")
        self.assertEqual(human_warming_check(annual, "human-induced GSAT", "1850-1900 inclusive",
                                           "human-induced GMST")["status"], "unavailable")
        self.assertEqual(human_warming_check(annual, "human-induced GMST", "1850-1900 inclusive")["status"], "unavailable")
        result = human_warming_check(annual, "human-induced GMST", "1850-1900 inclusive", "human-induced GMST")
        self.assertAlmostEqual(result["shareMeanMembersInRange"], 2/3)
        self.assertFalse(result["centralEligible"])
        annual[2025] = [np.nan]*3
        with self.assertRaises(ValueError):
            human_warming_check(annual, "human-induced GMST", "1850-1900 inclusive", "human-induced GMST")

    def test_forcing_cutoff_raw_baselines_and_no_double_count(self):
        reference = {y: {"solar": .3, "volcanic": .1,
                         "aerosol-radiation_interactions": -.2,
                         "aerosol-cloud_interactions": -.3, "CO2": 2}
                     for y in range(1750, 2025)}
        data = xr.Dataset({f"forcing_{key}_annual": (("year", "scenario", "config"),
            np.full((265, 1, 2), value))
            for key, value in {"total": 1.9, "natural": .4, "anthropogenic": 1.5, "aerosol": -.5}.items()},
            coords={"year": np.arange(1750, 2015), "scenario": ["historical"], "config": ["a", "b"]})
        result = compare_forcing(data, reference)
        self.assertAlmostEqual(result["components"]["total"]["scenarios"][0]["rmse"], 0)
        self.assertAlmostEqual(result["components"]["natural"]["igcc1750AsDelivered"], .4)
        self.assertIsNone(result["threshold"])
        self.assertFalse(result["annualReferenceGatePassed"])
        del reference[1750]
        with self.assertRaises(ValueError):
            compare_forcing(data, reference)


if __name__ == "__main__":
    unittest.main()
