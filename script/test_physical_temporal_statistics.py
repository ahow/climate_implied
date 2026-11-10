"""Temporal-operator engineering fixtures, never observed GMST certification."""
import unittest

import numpy as np
import xarray as xr

from physical_temporal_statistics import temporal_member_statistics


class TemporalOperatorTests(unittest.TestCase):
    def fixture(self):
        x = np.arange(15, dtype=float)
        values = np.stack([x*.1, (x-7)**2*.01, x*.03+.4], axis=-1)[:, None, :]
        return xr.DataArray(values, dims=("year", "scenario", "config"),
                            coords={"year": np.arange(2011, 2026), "scenario": ["fixture"],
                                    "config": ["a", "b", "c"]})

    def test_source_exact_fixed_window_endpoint_per_member_not_annual_or_median_fit(self):
        series = self.fixture()
        before = series.copy(deep=True)
        result = temporal_member_statistics(series)
        xr.testing.assert_identical(series, before)
        expected = [np.poly1d(np.polyfit(np.arange(15), series[:, 0, i].values, 1))(14)
                    for i in range(3)]
        np.testing.assert_allclose(result.sr15_trend_endpoint[0], expected, atol=1e-14)
        self.assertNotAlmostEqual(float(result.sr15_trend_endpoint[0, 1]), float(result.annual_mean[0, 1]))
        median_fit = np.poly1d(np.polyfit(np.arange(15), series.median("config")[:, 0], 1))(14)
        self.assertNotAlmostEqual(float(result.sr15_trend_endpoint.median("config")[0]), median_fit)
        self.assertEqual(result.attrs["trendWindowStart"], 2011)
        self.assertEqual(result.attrs["trendWindowEnd"], 2025)
        np.testing.assert_allclose(result.lagged_decade_mean, series.sel(year=slice(2016, 2025)).mean("year"))

    def test_no_shortened_window_nonfinite_duplicate_or_future_substitution(self):
        series = self.fixture()
        with self.assertRaisesRegex(ValueError, "fixed 15-year"):
            temporal_member_statistics(series.isel(year=slice(1, None)))
        bad = series.copy(deep=True)
        bad.values[0] = np.nan
        with self.assertRaisesRegex(ValueError, "Finite"):
            temporal_member_statistics(bad)
        with self.assertRaisesRegex(ValueError, "Unique year"):
            temporal_member_statistics(xr.concat([series, series[:1]], dim="year"))
        future = series[-1:].assign_coords(year=[2026])*1e6
        extended = xr.concat([series, future], dim="year")
        xr.testing.assert_identical(temporal_member_statistics(series), temporal_member_statistics(extended))

    def test_all_coordinates_shift_consistently_without_spatial_or_target_conversion(self):
        series = self.fixture()
        shifted = series.assign_coords(year=series.year+1)
        expected = temporal_member_statistics(series)
        actual = temporal_member_statistics(shifted, end_year=2026)
        np.testing.assert_array_equal(expected.sr15_trend_endpoint, actual.sr15_trend_endpoint)
        self.assertIn("not verified", actual.attrs["scope"])


if __name__ == "__main__":
    unittest.main()
