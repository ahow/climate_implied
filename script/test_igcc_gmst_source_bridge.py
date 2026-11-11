"""Source-independent engineering fixtures; never require private archives."""
import csv
import io
import unittest

import numpy as np

from igcc_gmst_source_bridge import HEADER, YEARS, parse_native_annual


def fixture():
    # Deliberately unequal member PI offsets; individual rebasing must fail test.
    return [HEADER.copy()] + [[str(y), ".8", ".02"] +
                      [str((y-1850)*.004 + i*.0001) for i in range(200)]
                      for y in range(1850, 2027)]


def encode(rows):
    stream = io.StringIO()
    csv.writer(stream).writerows(rows)
    return stream.getvalue().encode()


class GMSTSourceBridgeTests(unittest.TestCase):
    def test_full_window_identity_and_exact_common_baseline(self):
        dataset, excluded = parse_native_annual(encode(fixture()))
        self.assertEqual(excluded, [2026])
        self.assertEqual(dict(dataset.sizes), {"year": 176, "observation_member": 200})
        self.assertEqual(dataset.observation_member.values.tolist(), [str(i) for i in range(1, 201)])
        np.testing.assert_array_equal(dataset.year, YEARS)
        self.assertAlmostEqual(float(dataset.common_baseline_offset), .10995, places=14)
        values = dataset.gmst_anomaly.values
        np.testing.assert_allclose(values[:, -1]-values[:, 0], .0199, atol=1e-15)
        # 51-year member baselines remain different instead of all becoming zero.
        self.assertAlmostEqual(float(dataset.gmst_anomaly[:51, 0].mean()), -.00995)
        self.assertAlmostEqual(float(dataset.gmst_anomaly[:51, -1].mean()), .00995)
        self.assertEqual(dataset.coverage_uncertainty_1sigma.dims, ("year",))
        self.assertAlmostEqual(float(dataset.coverage_uncertainty_1sigma[0]), .02)

    def test_no_incomplete_future_year_is_required(self):
        dataset, excluded = parse_native_annual(encode(fixture()[:-1]))
        self.assertEqual(excluded, [])
        self.assertEqual(dataset.year.values[-1], 2025)

    def test_rejects_missing_duplicate_or_extra_years(self):
        rows = fixture()
        bad = [rows[:100]+rows[101:], rows+[rows[-1]], rows+[[*rows[-1]]]]
        bad[-1][-1][0] = "2027"
        for values in bad:
            with self.subTest(years=len(values)), self.assertRaises(ValueError):
                parse_native_annual(encode(values))

    def test_rejects_summary_missing_renamed_or_duplicate_members(self):
        for mode in ("summary", "renamed", "duplicate", "missing"):
            rows = fixture()
            if mode == "summary":
                rows[0] = ["Time", "Anomaly (deg C)", "Lower", "Upper"]
            elif mode == "renamed":
                rows[0][-1] = "Realization 201"
            elif mode == "duplicate":
                rows[0][-1] = rows[0][-2]
            else:
                rows[100] = rows[100][:-1]
            with self.subTest(mode=mode), self.assertRaises(ValueError):
                parse_native_annual(encode(rows))

    def test_rejects_nonfinite_and_invalid_coverage_even_in_excluded_row(self):
        for column, value in ((3, "nan"), (4, "inf"), (1, "1.01"), (2, "-.1")):
            rows = fixture()
            rows[-1][column] = value
            with self.subTest(column=column), self.assertRaises(ValueError):
                parse_native_annual(encode(rows))

    def test_rejects_fractional_year_without_coercion(self):
        rows = fixture()
        rows[1][0] = "1850.5"
        with self.assertRaisesRegex(ValueError, "integer"):
            parse_native_annual(encode(rows))


if __name__ == "__main__":
    unittest.main()
