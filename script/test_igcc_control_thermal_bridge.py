"""Independent engineering fixtures, never ancillary-data replacements."""
import copy
import csv
import io
import unittest

import numpy as np

from igcc_control_thermal_bridge import (
    digest, modal_response, read_qualified_control, source_midpoint,
    supported_modal_boundary,
)


def control_fixture(values=None):
    if values is None:
        values = 288+.08*np.sin(np.arange(400)*2*np.pi/11)
    license_text = "Fixture model is licensed under https://creativecommons.org/licenses/by/4.0/"
    source = ("synthetic test-only native metadata\n"+license_text).encode()
    terms = ("Independent test-only rights evidence: "+license_text).encode()
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["year", "tas"])
    writer.writerows((str(y), value) for y, value in zip(range(1000, 1000+len(values)), values))
    extraction = stream.getvalue().encode()
    metadata = {
        "source_path": "FixtureInstitute/FixtureModel/piControl/r1i1p1f1/gn/v1/tas/file.MAG",
        "source_sha256": digest(source), "extraction_sha256": digest(extraction),
        "terms_evidence_sha256": digest(terms), "institution_id": "FixtureInstitute",
        "source_id": "FixtureModel", "experiment_id": "piControl",
        "variant_label": "r1i1p1f1", "grid_label": "gn", "version": "v1",
        "variable_id": "tas", "region": "World", "units": "K",
        "license_id": "CC-BY-4.0", "license_text": license_text,
    }
    return source, extraction, terms, metadata, np.asarray(values)


class ControlThermalBridgeTests(unittest.TestCase):
    def test_actual_source_segment_formula_and_first50_not_first51(self):
        source, extraction, terms, meta, values = control_fixture()
        controls, offsets, slices = read_qualified_control(source, extraction, terms, meta)
        self.assertEqual(controls.shape, (176, 3))
        self.assertEqual([s["startPosition"] for s in slices], [0, 88, 176])
        self.assertEqual([s["nativeFirstYear"] for s in slices], [1000, 1088, 1176])
        self.assertTrue(all(s["filterPassed"] for s in slices))
        for i, start in enumerate([0, 88, 176]):
            expected = values[start:start+176]-values[start:start+50].mean()
            np.testing.assert_array_equal(controls[:, i], expected)
            self.assertEqual(float(offsets[i]), values[start:start+50].mean())
        self.assertNotEqual(values[:50].mean(), values[:51].mean())
        self.assertIn("FixtureInstitute/FixtureModel/piControl/r1i1p1f1/gn/v1/tas", str(controls.control_member[0].item()))

    def test_license_and_byte_pins_fail_closed(self):
        source, extraction, terms, meta, _ = control_fixture()
        for key, value in (("license_id", "CC-BY-NC-SA-4.0"),
                           ("source_sha256", "0"*64), ("units", "W m-2"),
                           ("region", "land"), ("experiment_id", "historical"),
                           ("institution_id", "OtherInstitute"), ("license_text", "generic CMIP template")):
            wrong = copy.copy(meta)
            wrong[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                read_qualified_control(source, extraction, terms, wrong)
        wrong = copy.copy(meta)
        del wrong["terms_evidence_sha256"]
        with self.assertRaises(ValueError):
            read_qualified_control(source, extraction, terms, wrong)

    def test_calendar_gap_duplicate_nonfinite_and_no_variability_rejected(self):
        source, extraction, terms, meta, _ = control_fixture()
        for old, new in ((b"1100,", b"1101,"), (b"1100,", b"1100.5,")):
            changed = extraction.replace(old, new)
            m = dict(meta, extraction_sha256=digest(changed))
            with self.assertRaises(ValueError):
                read_qualified_control(source, changed, terms, m)
        for values in (np.full(400, 288.), np.r_[np.nan, np.full(399, 288.)], np.zeros(175)):
            s, e, t, m, _ = control_fixture(values)
            with self.assertRaises(ValueError):
                read_qualified_control(s, e, t, m)

    def test_supported_modal_boundary_matches_independent_and_analytic_step(self):
        q, d = np.array([.2, .3, .4]), np.array([.3, 10., 1e9])
        forcing = np.ones(276)
        actual = modal_response(forcing, q, d)
        expected = (q[None, :]*(-np.expm1(-np.arange(1, 277)[:, None]/d))).sum(axis=1)
        np.testing.assert_allclose(actual[:, 0], expected, rtol=0, atol=3e-15)
        np.testing.assert_allclose(supported_modal_boundary(forcing, q, d), actual[:, 0], rtol=0, atol=3e-15)
        self.assertGreater(abs(actual[0, 2]-actual[0, 1]), .001)

    def test_signed_forcing_linearity_and_no_fitted_offset(self):
        q, d = [.2, .3, .4], [1., 10., 100.]
        a = np.sin(np.arange(200)/5)
        b = np.cos(np.arange(200)/9)
        np.testing.assert_allclose(modal_response(a+b, q, d),
                                   modal_response(a, q, d)+modal_response(b, q, d), atol=1e-14)
        np.testing.assert_array_equal(modal_response(np.zeros(200), q, d), np.zeros((200, 3)))
        for q_bad, d_bad in (([.2, .3], d), (q, [0, 10, 100]), ([-.2, .3, .4], d)):
            with self.assertRaises(ValueError):
                modal_response(a, q_bad, d_bad)

    def test_unpinned_source_helper_never_executed(self):
        with self.assertRaisesRegex(ValueError, "Exact inspected"):
            source_midpoint(np.ones(3), [.2, .3, .4], [1, 10, 100], b"raise RuntimeError('must not execute')")


if __name__ == "__main__":
    unittest.main()
