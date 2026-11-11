"""Engineering-only source-free fixtures; no private archive dependency in CI."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from igcc_alpha1_timing_proof import (
    alpha1_interval_bridge, digest, emulate_gwi_first_download_patch,
    extracted_numpy_thermal_step, qualified_actual_forcing_bridge,
    verify_source_contract,
)


class Alpha1TimingProofTests(unittest.TestCase):
    def test_zero_initial_state_first_and_last_full_interval(self):
        q, d = np.array([.2, .3, .4]), np.array([.5, 5., 50.])
        forcing = np.zeros(8)
        forcing[-1] = 1
        values, states = alpha1_interval_bridge(forcing, q, d)
        np.testing.assert_array_equal(values[:-1], np.zeros(7))
        np.testing.assert_array_equal(states[:-1], np.zeros((7, 3)))
        expected_state = q*(1-np.exp(-1/d))
        np.testing.assert_array_equal(states[-1], expected_state)
        self.assertEqual(values[-1], expected_state.sum()/2)
        first, _ = alpha1_interval_bridge(np.r_[1., np.zeros(7)], q, d)
        self.assertEqual(first[0], values[-1])
        self.assertGreater(first[-1], 0)

    def test_all_three_modes_and_exact_source_endpoint_average(self):
        q, d = np.array([0., 0., .7]), np.array([.1, 2., 9.])
        values, states = alpha1_interval_bridge(np.ones(5), q, d)
        expected = q[2]*(1-np.exp(-np.arange(1, 6)/d[2]))
        np.testing.assert_allclose(states[:, 2], expected, atol=1e-15)
        expected_return = (np.r_[0, expected[:-1]]+expected)/2
        np.testing.assert_allclose(values, expected_return, atol=1e-15)

    def test_return_is_neither_exact_integral_nor_sibling_impulse_midpoint(self):
        q, d = np.array([.2, .3, .4]), np.array([.5, 5., 50.])
        values, _ = alpha1_interval_bridge([1.], q, d)
        exact = (q*(1-d*(-np.expm1(-1/d)))).sum()
        sibling = (q/d*np.exp(-.5/d)).sum()
        self.assertGreater(abs(values[0]-exact), .01)
        self.assertGreater(abs(values[0]-sibling), .01)

    def test_signed_forcing_is_linear_without_offsets(self):
        q, d = [.2, .3, .4], [.5, 5, 50]
        a, b = np.arange(8)/8, np.array([1., -1.]*4)
        result = alpha1_interval_bridge(a+b, q, d)[0]
        expected = alpha1_interval_bridge(a, q, d)[0]+alpha1_interval_bridge(b, q, d)[0]
        np.testing.assert_allclose(result, expected, atol=1e-15)
        np.testing.assert_array_equal(alpha1_interval_bridge(np.zeros(8), q, d)[0], np.zeros(8))

    def test_missing_or_invalid_inputs_fail_before_response(self):
        for forcing, q, d in (([], [.2, .3, .4], [.5, 5, 50]),
                              ([np.nan], [.2, .3, .4], [.5, 5, 50]),
                              ([1.], [.2, .3], [.5, 5, 50]),
                              ([1.], [.2, .3, .4], [.5, 0, 50]),
                              ([1.], [-.2, .3, .4], [.5, 5, 50])):
            with self.subTest(forcing=forcing), self.assertRaises(ValueError):
                alpha1_interval_bridge(forcing, q, d)

    def test_unpinned_source_code_not_executed_or_qualified(self):
        body = b"raise RuntimeError('must not execute')"
        for call in (lambda: extracted_numpy_thermal_step(body),
                     lambda: verify_source_contract(body, body),
                     lambda: emulate_gwi_first_download_patch(body, body)):
            with self.assertRaises(ValueError):
                call()

    def test_relabelling_an_arbitrary_ssp_file_cannot_qualify_actual_source(self):
        with tempfile.TemporaryDirectory() as directory:
            source, rights = Path(directory)/"source.nc", Path(directory)/"rights.txt"
            source.write_bytes(b"Not an actual historical ensemble; test-only SSP impostor")
            rights.write_bytes(b"Test-only rights declaration")
            manifest = {"source_sha256": digest(source.read_bytes()),
                        "rights_sha256": digest(rights.read_bytes()),
                        "history_basis": "actual-observed-1750-2025"}
            with patch("igcc_alpha1_timing_proof.load_proof_sources", return_value=(None, {}, {})):
                with self.assertRaisesRegex(ValueError, "Pinned actual-history"):
                    qualified_actual_forcing_bridge(source, rights, manifest, "unused")


if __name__ == "__main__":
    unittest.main()
