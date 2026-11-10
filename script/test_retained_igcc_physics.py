import unittest

import numpy as np
import xarray as xr
from compare_retained_igcc_physics import (
    compare_forcing, human_warming_check, human_warming_reference_contract,
    _conditional_human_warming_math,
)


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
        self.assertEqual(result["status"], "unavailable")
        self.assertIsNone(result["shareMeanMembersInRange"])
        self.assertFalse(result["actualMemberComparisonPerformed"])
        self.assertFalse(result["centralEligible"])

    def test_gsat_pretending_matching_reference_is_rejected(self):
        annual = {y: [1, 1.25, 2] for y in range(2016, 2026)}
        result = human_warming_check(annual, "human-induced GSAT", "1850-1900 inclusive",
                                     "human-induced GSAT")
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["references"]["referenceObservable"], "human-induced GMST")
        self.assertFalse(result["callerObservableClaimsAreIndependentVerification"])
        self.assertIsNone(result["shareMeanMembersInRange"])
        self.assertIn("cannot override", result["reason"])

    def test_actual_reference_version_definition_and_frozen_targets(self):
        reference = human_warming_reference_contract()
        self.assertEqual(reference["annualHumanWarmingC"], 1.37)
        self.assertEqual(reference["meanHumanWarmingC"], 1.24)
        self.assertEqual(reference["meanRangeC"], [1.0, 1.5])
        self.assertEqual(reference["annualDefinition"], "SR1.5")
        self.assertEqual(reference["distinctAnnualDefinitionHumanWarmingC"], 1.38)
        self.assertEqual(reference["source"]["version"], "IGCC-2025a")
        self.assertEqual(reference["source"]["revision"], "d9726573dccd9381652432b58b38f670af493c1c")
        self.assertEqual(reference["source"]["annualRowNotes"], "SR15 definition")
        self.assertEqual(reference["source"]["sha256"], "d419c3f7d513b42052f5635454853610739d8b5f1749f55b5df03862dfe28879")
        # Mutating a returned contract cannot change future reference selection.
        reference["referenceObservable"] = "human-induced GSAT"
        self.assertEqual(human_warming_check()["references"]["referenceObservable"], "human-induced GMST")

    def test_conditional_fixture_math_is_not_actual_member_acceptance(self):
        annual = {y: [1, 1.25, 2] for y in range(2016, 2026)}
        result = _conditional_human_warming_math(annual)
        self.assertEqual(result["status"], "conditional-math-only")
        self.assertAlmostEqual(result["conditionalShareMeanMembersInRange"], 2/3)
        self.assertIsNone(result["shareMeanMembersInRange"])
        self.assertFalse(result["actualMemberComparisonPerformed"])
        annual[2025] = [np.nan]*3
        with self.assertRaises(ValueError):
            _conditional_human_warming_math(annual)
        del annual[2025]
        with self.assertRaisesRegex(ValueError, "every"):
            _conditional_human_warming_math(annual)

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
