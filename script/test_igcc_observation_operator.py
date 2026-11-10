"""Source-only engineering fixtures; no private source or accepted odds needed."""
import unittest

import numpy as np
import xarray as xr

from igcc_observation_operator import (
    common_observation_baseline, prepare_gwi_controls, gwi_observational_constraint, YEARS,
)


class GwiKernelTests(unittest.TestCase):
    def fixture(self):
        t = np.arange(len(YEARS), dtype=float)/100
        values = np.stack([t, np.sin(t*8), t*t], axis=-1)[:, None, :]
        fingerprints = xr.DataArray(values, dims=("year", "fingerprint_member", "component"),
                                    coords={"year": YEARS, "fingerprint_member": ["source-config"],
                                            "component": ["GHG", "Nat", "OHF"]})
        x = values[:, 0, :]-values[:51, 0, :].mean(axis=0)
        observations = xr.DataArray((x@np.array([1.2, .8, -.2]))[:, None]+np.array([.02, -.02]),
                                    dims=("year", "observation_member"),
                                    coords={"year": YEARS, "observation_member": ["o1", "o2"]})
        controls = xr.DataArray((x@np.array([0, -.06, 0]))[:, None],
                                dims=("year", "control_member"),
                                coords={"year": YEARS, "control_member": ["p1"]})
        return fingerprints, observations, controls

    def test_exact_source_joint_regression_no_intercept_and_human_not_total(self):
        fingerprints, observations, controls = self.fixture()
        before = fingerprints.copy(deep=True)
        actual = gwi_observational_constraint(fingerprints, observations, controls)
        xr.testing.assert_identical(fingerprints, before)
        x = (fingerprints-fingerprints.sel(year=slice(1850, 1900)).mean("year")).values[:, 0, :]
        obs, _ = common_observation_baseline(observations, "observation_member")
        pic, _ = prepare_gwi_controls(controls)
        for i in range(2):
            expected = np.linalg.lstsq(x, obs[:, i].values, rcond=None)[0]+np.linalg.lstsq(x, pic[:, 0].values, rcond=None)[0]
            np.testing.assert_allclose(actual.regression_coefficient[0, i, 0], expected)
        self.assertLess(float(abs(actual.total_forced.sel(year=slice(1850, 1900)).mean("year")).max()), 1e-14)
        xr.testing.assert_equal(actual.human_induced+actual.natural, actual.total_forced)
        self.assertFalse(np.allclose(actual.human_induced, actual.total_forced))
        self.assertEqual(actual.attrs["centralEligible"], "false")

    def test_observations_use_one_common_baseline_not_memberwise_recentering(self):
        _, observations, _ = self.fixture()
        centered, offset = common_observation_baseline(observations, "observation_member")
        np.testing.assert_allclose(centered[:, 0]-centered[:, 1], .04)
        self.assertFalse(np.allclose(centered.sel(year=slice(1850, 1900)).mean("year"), 0))
        self.assertAlmostEqual(float(offset), 0)

    def test_source_control_first50_offset_and_variability_filter_not_observation_helper(self):
        _, _, controls = self.fixture()
        actual, offset = prepare_gwi_controls(controls)
        np.testing.assert_allclose(offset, controls.isel(year=slice(0, 50)).mean("year"))
        np.testing.assert_allclose(actual, controls-offset)
        self.assertNotAlmostEqual(float(offset[0]), float(controls.isel(year=slice(0, 51)).mean("year")[0]))
        with self.assertRaisesRegex(ValueError, "No piControl"):
            prepare_gwi_controls(controls*0)

    def test_total_proxy_rank_failure_short_history_nonfinite_and_duplicates_rejected(self):
        f, o, p = self.fixture()
        with self.assertRaisesRegex(ValueError, "GHG/Nat/OHF"):
            gwi_observational_constraint(f.assign_coords(component=["total", "Nat", "OHF"]), o, p)
        bad = f.copy(deep=True)
        bad.values[:, :, 2] = bad.values[:, :, 0]
        with self.assertRaisesRegex(ValueError, "Nonidentifiable"):
            gwi_observational_constraint(bad, o, p)
        with self.assertRaisesRegex(ValueError, "1850-2025"):
            gwi_observational_constraint(f[:-1], o[:-1], p[:-1])
        bad = o.copy(deep=True)
        bad.values[0] = np.nan
        with self.assertRaisesRegex(ValueError, "Finite"):
            gwi_observational_constraint(f, bad, p)
        with self.assertRaisesRegex(ValueError, "Unique"):
            gwi_observational_constraint(f, xr.concat([o, o], dim="observation_member"), p)


if __name__ == "__main__":
    unittest.main()
