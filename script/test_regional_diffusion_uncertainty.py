"""Synthetic engineering fixtures only. No regional efficacy or source claim."""
import hashlib
import json
import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from driver_uncertainty import logistic
from regional_diffusion_uncertainty import (
    EVIDENCE, FAMILY, HOLDOUT, TRAIN, cell_id, evaluate_joint,
    fingerprint, fixed_family, full_window, input_binding, joint_source_gate,
    qualified_record, readiness, residual_fit,
)


class RegionalJointUncertaintyTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        path = Path(self.directory.name) / "engineering-fixture"
        path.write_text("Synthetic engineering evidence, never scientific source data.")
        self.record = {
            "url": "https://example.invalid/engineering-only",
            "sourceVersion": "synthetic-engineering-fixture-1",
            "publicationDate": "2020-01-01", "locator": "fixture",
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "rights": "Synthetic fixture", "empiricalIdentification": "NOT empirical: fixture",
            "independenceFromHoldout": "Synthetic engineering test only",
            "artifactPath": str(path), "reviewer": "engineering-fixture",
            "reviewReceipt": "fixture-not-scientific-review",
            "qualification": "independently-reviewed-qualified",
            "engineeringFixture": True,
        }
        self.keys = [cell_id(*pair) for pair in FAMILY[:2]]
        self.data, self.priors, self.retained = {}, {}, {}
        for i, key in enumerate(self.keys):
            entity, technology = FAMILY[i]
            self.priors[key] = {
                **self.record, "entity": entity, "technology": technology,
                "unit": "fraction-of-total-electricity-generation",
                "kind": "independently-identified-long-run-saturation", "saturation": .7,
            }
            self.data[key] = [(year, .7 * logistic(-4 + .18 * (year - 2010)
                                                 + .02 * math.sin(year - 2010)))
                              for year in range(2010, 2025)]
            self.retained[key] = {"beatsBothBaselines": i == 1}
        self.bundle = {
            **self.record, "jointDependenceIdentification": "synthetic shared path only",
            "sourceRevisionIdentification": "synthetic paired source revisions",
            "structuralIdentification": "synthetic authored joint offsets",
            "samplingLawIdentification": "synthetic engineering empirical atoms",
            "samplingLaw": "uniform-authored-empirical-joint-draws",
            "trainingYears": list(TRAIN), "predictionYears": list(HOLDOUT), "draws": [],
        }
        for j in range(3):
            self.bundle["draws"].append({"drawId": str(j), "cells": {
                key: {"saturation": .65 + j * .02,
                      "trainingShares": [value * (1 + .01 * j)
                                         for year, value in self.data[key] if year in TRAIN],
                      "structuralLogitOffsets": [.01 * (j - 1) * (i + 1) for i in range(6)],
                      "priorSha256": self.priors[key]["sha256"]}
                for key in self.keys}})
        self.sync_bundle()

    def sync_bundle(self):
        path = Path(self.directory.name) / "joint-engineering-fixture.json"
        payload = {key: self.bundle[key] for key in
                   ("trainingYears", "predictionYears", "samplingLaw", "draws")}
        path.write_text(json.dumps(payload))
        self.bundle.update(artifactPath=str(path), sha256=hashlib.sha256(path.read_bytes()).hexdigest())

    def specification(self):
        return {"frozenBeforeFitting": True, "freezeReceipt": "engineering-only",
                "operationalFreezeSha256": fingerprint(
                    json.loads(EVIDENCE.read_text())["operationalFreeze"]),
                "inputsSha256": input_binding(self.data, self.priors, self.bundle, self.retained),
                "training": [2010, 2018], "evaluation": [2019, 2024]}

    def run_fixture(self):
        return evaluate_joint(self.data, self.priors, self.bundle, self.specification(),
                              self.retained, engineering=True)

    def test_default_unexecuted_fixed_family(self):
        report = readiness()
        self.assertEqual(report["status"], "UNEXECUTED")
        self.assertEqual(report["fitCount"], 0)
        self.assertEqual(len(report["family"]), 10)
        self.assertTrue(all(not cell["supplementalReject"] for cell in report["family"]))

    def test_production_rejects_synthetic_sources(self):
        report = evaluate_joint(self.data, self.priors, self.bundle, self.specification(), self.retained)
        self.assertEqual(report["fitCount"], 0)
        self.assertTrue(all("engineering-source-forbidden" in report["gates"][key]["reasons"]
                            for key in self.keys))

    def test_source_gate_precedes_any_regression(self):
        self.priors = {}
        with patch("regional_diffusion_uncertainty.fit", side_effect=AssertionError("fit called")), \
                patch("regional_diffusion_uncertainty.evaluate_qualified",
                      side_effect=AssertionError("point fit called")):
            self.assertEqual(self.run_fixture()["fitCount"], 0)

    def test_unfrozen_inputs_block(self):
        specification = self.specification()
        self.data[self.keys[0]][0] = (2010, .01)
        report = evaluate_joint(self.data, self.priors, self.bundle, specification,
                                self.retained, engineering=True)
        self.assertEqual(report["block"], "missing-or-mismatched-prefit-input-freeze")

    def test_failure_history_is_frozen(self):
        specification = self.specification()
        self.retained[self.keys[0]]["beatsBothBaselines"] = True
        report = evaluate_joint(self.data, self.priors, self.bundle, specification,
                                self.retained, engineering=True)
        self.assertEqual(report["fitCount"], 0)

    def test_full_nine_training_not_original_six_minimum(self):
        rows = self.data[self.keys[0]]
        self.assertTrue(full_window(rows))
        self.assertFalse(full_window(rows[1:]))
        self.assertFalse(full_window(rows[:-1]))

    def test_duplicate_and_nonfinite_reject(self):
        rows = self.data[self.keys[0]]
        for invalid in (rows + [rows[0]], [(2010, float("nan"))], [(2010, True)]):
            with self.assertRaises(ValueError):
                full_window(invalid)

    def test_hash_mismatch_rejects(self):
        record = {**self.record, "sha256": "0" * 64}
        self.assertIn("source-hash-mismatch", qualified_record(record, engineering=True))

    def test_missing_review_and_date_reject(self):
        record = {**self.record, "qualification": "", "publicationDate": "yesterday"}
        reasons = qualified_record(record, engineering=True)
        self.assertIn("independent-review-not-qualified", reasons)
        self.assertIn("invalid-publication-date", reasons)

    def test_no_default_structural_zero_or_marginal_draws(self):
        del self.bundle["draws"][0]["cells"][self.keys[0]]["structuralLogitOffsets"]
        reasons = joint_source_gate(self.bundle, self.priors, self.keys, engineering=True)
        self.assertIn("missing-or-invalid-structural-path:" + self.keys[0], reasons)
        with patch("regional_diffusion_uncertainty.evaluate_qualified",
                   side_effect=AssertionError("point fit called")):
            self.assertEqual(self.run_fixture()["fitCount"], 0)

    def test_no_missing_joint_cell(self):
        del self.bundle["draws"][0]["cells"][self.keys[0]]
        self.assertIn("joint-draw-family-mismatch",
                      joint_source_gate(self.bundle, self.priors, self.keys, engineering=True))

    def test_joint_draw_prior_binding(self):
        self.bundle["draws"][0]["cells"][self.keys[0]]["priorSha256"] = "0" * 64
        self.assertEqual(self.run_fixture()["fitCount"], 0)

    def test_unrelated_paper_hash_cannot_authenticate_draw_arrays(self):
        self.bundle["draws"][0]["cells"][self.keys[0]]["saturation"] = .9
        self.assertIn("joint-draws-not-in-authenticated-source",
                      joint_source_gate(self.bundle, self.priors, self.keys, engineering=True))

    def test_training_above_k_blocks_before_regression(self):
        for prior in self.priors.values():
            prior["saturation"] = .001
        with patch("regional_diffusion_uncertainty.fit", side_effect=AssertionError("fit called")):
            self.assertEqual(self.run_fixture()["fitCount"], 0)

    def test_fixed_family_holm_and_missing_nonrejection(self):
        report = fixed_family({self.keys[0]: {"baselinePValues": {
            "persistence": .001, "linearTrend": .004}}})
        self.assertEqual(len(report), 10)
        cell = next(c for c in report if c["id"] == self.keys[0])
        self.assertAlmostEqual(cell["holmAdjustedP"], .04)
        self.assertTrue(cell["supplementalReject"])
        self.assertTrue(all(c["p"] == 1 and not c["supplementalReject"]
                            for c in report if c["id"] != self.keys[0]))

    def test_both_baselines_required_for_inference(self):
        report = fixed_family({self.keys[0]: {"baselinePValues": {
            "persistence": .001, "linearTrend": .4}}})
        self.assertFalse(any(c["supplementalReject"] for c in report))
        missing = fixed_family({self.keys[0]: {"baselinePValues": {"persistence": .001}}})
        self.assertTrue(all(c["p"] == 1 and not c["supplementalReject"] for c in missing))
        with self.assertRaises(ValueError):
            fixed_family({self.keys[0]: {"baselinePValues": {"persistence": float("nan")}}})

    def test_complete_bootstrap_replay_and_joint_dependence(self):
        first = self.run_fixture()
        self.assertEqual(first, self.run_fixture())
        self.assertEqual(first["status"], "engineering-fixtures-only")
        self.assertEqual(first["bootstrapReplications"], 1000)
        left, right = [first["results"][key] for key in self.keys]
        self.assertEqual(len(left["pairedBootstrapParameters"]), 1000)
        self.assertEqual(left["pairedBootstrapParameters"], right["pairedBootstrapParameters"])
        self.assertEqual(left["jointParameterDraws"], right["jointParameterDraws"])
        self.assertEqual(len(left["jointSourceStructuralIntervals"]), 6)
        self.assertTrue(left["originalFailureRetained"])
        self.assertFalse(right["originalFailureRetained"])
        self.assertFalse(first["centralEligible"])
        self.assertFalse(first["scientificAccepted"])
        self.assertFalse(first["ownerApproved"])
        self.assertFalse(left["originalVintageEligible"])

    def test_original_six_year_mae_and_both_baselines_unchanged(self):
        report = self.run_fixture()["results"][self.keys[0]]["point"]
        values = dict(self.data[self.keys[0]])
        a, b, k = [report["parameters"][field] for field in ("intercept", "slope", "saturation")]
        mae = sum(100 * abs(k * logistic(a + b * (year - 2010)) - values[year])
                  for year in HOLDOUT) / 6
        persistence = sum(100 * abs(values[2018] - values[year]) for year in HOLDOUT) / 6
        self.assertAlmostEqual(report["maePercentagePoints"]["logistic"], mae)
        self.assertAlmostEqual(report["maePercentagePoints"]["persistence"], persistence)
        self.assertEqual(report["beatsBothBaselines"], mae < min(
            report["maePercentagePoints"]["persistence"], report["maePercentagePoints"]["linearTrend"]))

    def test_holdout_cannot_change_parameter_draws(self):
        before = self.run_fixture()
        for key in self.keys:
            self.data[key] = [(year, value if year in TRAIN else .8)
                              for year, value in self.data[key]]
        after = self.run_fixture()
        for key in self.keys:
            for field in ("pairedBootstrapParameters", "jointParameterDraws", "trainingSlopeStability"):
                self.assertEqual(before["results"][key][field], after["results"][key][field])

    def test_missing_cell_stays_in_family(self):
        del self.priors[self.keys[1]]
        for draw in self.bundle["draws"]:
            del draw["cells"][self.keys[1]]
        self.sync_bundle()
        report = self.run_fixture()
        self.assertEqual(report["fitCount"], 1)
        self.assertEqual(len(report["family"]), 10)
        missing = next(c for c in report["family"] if c["id"] == self.keys[1])
        self.assertEqual(missing["p"], 1)
        self.assertFalse(missing["supplementalReject"])

    def test_original_model_transform_and_early_late_slopes(self):
        shares = [.6 * logistic(-3 + .2 * i) for i in range(9)]
        a, b, residuals, _ = residual_fit(shares, .6)
        self.assertAlmostEqual(a, -3)
        self.assertAlmostEqual(b, .2)
        self.assertTrue(all(abs(value) < 1e-12 for value in residuals))

    def test_unknown_family_cell_rejects(self):
        self.data["invented|solar"] = []
        with self.assertRaises(ValueError):
            self.run_fixture()


if __name__ == "__main__":
    unittest.main()
