"""Engineering-only gate fixtures; no fabricated scientific efficacy."""
import unittest
from regional_diffusion_next import assemble, evaluate_qualified, qualify_prior


class RegionalDiffusionGateTests(unittest.TestCase):
    def test_missing_prior_never_defaults_to_one(self):
        result = qualify_prior({}, "India", "solar_share_elec")
        self.assertFalse(result["eligible"])
        self.assertIn("invalid-or-unavailable-K", result["reasons"])

    def test_scenario_and_capacity_cannot_be_ceiling(self):
        for kind, unit in (("policy-target", "fraction-of-total-electricity-generation"),
                           ("technical-potential", "MW"), ("scenario", "shipments")):
            result = qualify_prior({"kind": kind, "unit": unit, "saturation": 0.8}, "China", "wind_share_elec")
            self.assertFalse(result["eligible"])
            self.assertIn("not-identified-saturation", result["reasons"])

    def test_post_cutoff_is_not_backdated(self):
        prior = dict(url="https://example.invalid", sourceVersion="fixture", publicationDate="2020-01-01",
                     locator="fixture", sha256="fixture", rights="fixture", empiricalIdentification="fixture",
                     independenceFromHoldout="fixture", entity="India", technology="solar_share_elec",
                     unit="fraction-of-total-electricity-generation",
                     kind="independently-identified-long-run-saturation", saturation=0.5)
        result = qualify_prior(prior, "India", "solar_share_elec")
        self.assertTrue(result["eligible"])
        self.assertFalse(result["originalVintageEligible"])

    def test_missing_evaluation_year_rejects_full_window(self):
        rows = [dict(country="India", year=str(y), solar_share_elec="1") for y in range(2010, 2024)]
        self.assertFalse(assemble(rows, "India", "solar_share_elec")["fullWindowRowsQualified"])

    def test_duplicate_rejects(self):
        row = dict(country="India", year="2010", solar_share_elec="1")
        with self.assertRaises(ValueError):
            assemble([row, row], "India", "solar_share_elec")

    def test_nonfinite_share_not_admitted(self):
        row = dict(country="India", year="2010", solar_share_elec="nan")
        self.assertEqual(assemble([row], "India", "solar_share_elec")["invalidYears"], [2010])

    def test_missing_prior_blocks_before_fitting(self):
        result = evaluate_qualified([], {}, "India", "solar_share_elec", {})
        self.assertEqual(result["status"], "blocked-source")
        self.assertFalse(result["fitExecuted"])

    def test_no_prefit_receipt_blocks_before_fitting(self):
        prior = dict(url="https://example.invalid", sourceVersion="fixture", publicationDate="2020-01-01",
                     locator="fixture", sha256="fixture", rights="fixture", empiricalIdentification="fixture",
                     independenceFromHoldout="fixture", entity="India", technology="solar_share_elec",
                     unit="fraction-of-total-electricity-generation",
                     kind="independently-identified-long-run-saturation", saturation=0.5)
        result = evaluate_qualified([], prior, "India", "solar_share_elec", {})
        self.assertEqual(result["status"], "blocked-prefit-specification")
        self.assertFalse(result["fitExecuted"])


if __name__ == "__main__":
    unittest.main()
