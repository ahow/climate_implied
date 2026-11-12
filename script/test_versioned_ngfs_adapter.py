import copy
import csv
from dataclasses import replace
import hashlib
import io
from pathlib import Path
import unittest

from versioned_ngfs_adapter import (
    adapt_versioned_csv, parse_versioned_csv, manifest_for_profile,
    phase_v_fixture_profile,
)

FIXTURE = Path(__file__).parent / "fixtures/ngfs-phase-v-5.1-ch4.csv"


class VersionedAdapterTests(unittest.TestCase):
    def setUp(self):
        self.payload = FIXTURE.read_bytes()
        self.profile = phase_v_fixture_profile()
        self.manifest = manifest_for_profile(self.profile)

    def adapt(self, payload=None, profile=None, **kwargs):
        profile = profile or self.profile
        return adapt_versioned_csv(
            self.payload if payload is None else payload, manifest_for_profile(profile), profile,
            model=profile.models[0], scenario=profile.scenarios[0], region=profile.regions[0],
            requested_stage=kwargs.pop("requested_stage", "raw"),
            required_species=kwargs.pop("required_species", ["CH4"]), **kwargs)

    def altered(self, transform):
        """Re-pin mutated bytes ONLY under an explicitly synthetic test profile.

        This bypasses the hash gate to exercise deeper malformed-input checks;
        it never blesses mutated bytes as an actual NGFS release.
        """
        text = transform(self.payload.decode())
        payload = text.encode()
        profile = replace(self.profile, source_version="SYNTHETIC-malformed-test",
                          artifact_sha256=hashlib.sha256(payload).hexdigest(), synthetic=True)
        return payload, profile

    def test_actual_phase_v_fixture_and_all_stages_are_preserved(self):
        result = self.adapt()
        self.assertEqual(result["status"], "validated-source-structure-only")
        self.assertEqual(result["scientificAcceptance"], "not-promoted")
        self.assertFalse(result["productionPairAccepted"])
        self.assertEqual(set(result["stages"]), {"raw", "harmonized", "infilled"})
        raw = result["stages"]["raw"]["CH4"]
        self.assertEqual(raw["published"][2020], 358.9918938)
        self.assertIsNone(raw["published"][2065])
        self.assertAlmostEqual(raw["annualNativeMt"][2024], 358.40746732)
        self.assertAlmostEqual(raw["annualNativeMt"][2065], (379.2329388999999 + 371.2561298999999) / 2)
        self.assertEqual(raw["annualNativeMt"][2100], 331.8175874)
        harmonized = result["stages"]["harmonized"]["CH4"]
        self.assertNotEqual(raw["annualNativeMt"][2024], harmonized["annualNativeMt"][2024])
        self.assertEqual(harmonized["published"][2020], 367.8601401512597)
        self.assertEqual(self.adapt(requested_stage="infilled")["requestedStage"], "infilled")

    def test_explicitly_synthetic_future_profile_swaps_without_parser_changes(self):
        # Generated wholly artificial observations; NOT an actual Phase VI dataset.
        writer_buffer = io.StringIO(newline="")
        writer = csv.writer(writer_buffer, lineterminator="\n")
        writer.writerow(["Model", "Scenario", "Region", "Variable", "Unit", "2020", "2030", "2100"])
        for prefix, values in [
            ("", [10, 20, 30]),
            ("AR6 climate diagnostics|Harmonized|", [20, 30, 40]),
            ("AR6 climate diagnostics|Infilled|", [30, 40, 50]),
        ]:
            writer.writerow(["SYNTHETIC-FUTURE-MODEL", "SYNTHETIC-FUTURE-SCENARIO", "World",
                             prefix + "Emissions|N2O", "kt N2O/yr", *values])
        payload = writer_buffer.getvalue().encode()
        profile = replace(self.profile, source_version="SYNTHETIC-future-Phase-VI-shape-NOT-RELEASED",
                          source_url="https://example.invalid/synthetic-future",
                          release_sha256=hashlib.sha256(b"synthetic-not-a-release").hexdigest(),
                          artifact_sha256=hashlib.sha256(payload).hexdigest(),
                          licence_id="synthetic-test-data-only",
                          licence_url="https://example.invalid/synthetic-licence",
                          attribution="Wholly generated structural compatibility test",
                          models=("SYNTHETIC-FUTURE-MODEL",),
                          scenarios=("SYNTHETIC-FUTURE-SCENARIO",),
                          years=(2020, 2030, 2100), synthetic=True)
        result = self.adapt(payload, profile, required_species=["N2O"])
        self.assertEqual(result["status"], "synthetic-structural-test-only")
        self.assertAlmostEqual(result["stages"]["raw"]["N2O"]["annualNativeMt"][2024], .014)
        self.assertAlmostEqual(result["stages"]["infilled"]["N2O"]["annualNativeMt"][2024], .034)
        self.assertFalse(result["productionPairAccepted"])
        with self.assertRaisesRegex(ValueError, "manifest"):
            parse_versioned_csv(payload, self.manifest, profile)

    def test_provenance_version_schema_hash_licence_refusals(self):
        mutations = [
            ("sourceVersion", "NGFS Phase VI"),
            ("schemaVersion", "unreviewed-schema"),
            ("sourceUrl", "https://example.invalid/unreviewed"),
            ("releaseSha256", "0" * 64),
            ("contentSha256", "0" * 64),
            ("synthetic", True),
            ("synthetic", 0),
            ("unexpected", "extra"),
        ]
        for field, value in mutations:
            with self.subTest(field=field, value=value):
                manifest = {**self.manifest, field: value}
                with self.assertRaisesRegex(ValueError, "manifest"):
                    parse_versioned_csv(self.payload, manifest, self.profile)
        for field in ("id", "url", "attribution", "redistribution"):
            manifest = copy.deepcopy(self.manifest)
            manifest["licence"][field] = ""
            with self.assertRaisesRegex(ValueError, "manifest"):
                parse_versioned_csv(self.payload, manifest, self.profile)
        with self.assertRaisesRegex(ValueError, "SHA256 mismatch"):
            parse_versioned_csv(self.payload + b"\n", self.manifest, self.profile)
        with self.assertRaisesRegex(ValueError, "manifest"):
            manifest = dict(self.manifest)
            del manifest["licence"]
            parse_versioned_csv(self.payload, manifest, self.profile)
        with self.assertRaisesRegex(ValueError, "profile"):
            parse_versioned_csv(self.payload, self.manifest, None)

    def test_malformed_rows_species_units_years_regions_scenarios_refused(self):
        transformations = [
            lambda s: s.replace(",2020,2025,", ",2020,2020,", 1),
            lambda s: s.replace(",2020,2025,", ",2020,year2025,", 1),
            lambda s: s.replace(",2020,2025,", ",2020,2026,", 1),
            lambda s: s.replace(",Unit,", ",Unexpected,", 1),
            lambda s: s.replace("World", "EU27", 1),
            lambda s: s.replace("Current Policies", "All announced commitments", 1),
            lambda s: s.replace("REMIND-MAgPIE 3.3-4.8", "Unreviewed model", 1),
            lambda s: s.replace("Emissions|CH4", "Emissions|F-Gases", 1),
            lambda s: s.replace("Emissions|CH4", "Emissions|HFC|HFC245ca", 1),
            lambda s: s.replace("Harmonized|", "UnreviewedProcessing|", 1),
            lambda s: s.replace("Mt CH4/yr", "Mt CO2-equiv/yr", 1),
            lambda s: s.replace("367.8601401512597", "nan", 1),
            lambda s: s.replace("367.8601401512597", "inf", 1),
            lambda s: s.replace("367.8601401512597", "not-a-number", 1),
            lambda s: s.replace("367.8601401512597", "-1", 1),
            lambda s: s + s.splitlines()[1] + "\n",
            lambda s: s + "too,few,columns\n",
            lambda s: s.splitlines()[0] + "\n",
            lambda s: s.replace("358.9918938", ""),  # no start-horizon coverage
            lambda s: s.replace("331.8175874", ""),  # no end-horizon coverage
        ]
        for index, transform in enumerate(transformations):
            with self.subTest(case=index):
                payload, profile = self.altered(transform)
                with self.assertRaises(ValueError):
                    self.adapt(payload, profile)

    def test_no_missing_gases_or_cross_stage_fallback(self):
        with self.assertRaisesRegex(ValueError, "Missing native species"):
            self.adapt(required_species=["CH4", "NF3"])
        with self.assertRaisesRegex(ValueError, "known native species"):
            self.adapt(required_species=["HFC-245ca"])
        with self.assertRaisesRegex(ValueError, "known native species"):
            self.adapt(required_species=[])
        with self.assertRaisesRegex(ValueError, "processing stage"):
            self.adapt(requested_stage="adjusted")
        payload, profile = self.altered(
            lambda s: "\n".join(line for line in s.splitlines() if "|Infilled|" not in line) + "\n")
        raw = self.adapt(payload, profile)
        self.assertEqual(raw["missingSpeciesByStage"]["infilled"], ["CH4"])
        self.assertEqual(raw["stages"]["infilled"], {})
        with self.assertRaisesRegex(ValueError, "no stage borrowing"):
            self.adapt(payload, profile, requested_stage="infilled")
        with self.assertRaisesRegex(ValueError, "no fallback"):
            adapt_versioned_csv(self.payload, self.manifest, self.profile,
                                model=self.profile.models[0], scenario="All announced commitments",
                                region="World", requested_stage="raw", required_species=["CH4"])

    def test_invalid_encoding_csv_and_profile_refused(self):
        for payload in (b"\xff", b'"unterminated\n', b""):
            profile = replace(self.profile, synthetic=True,
                              artifact_sha256=hashlib.sha256(payload).hexdigest())
            with self.assertRaises(ValueError):
                self.adapt(payload, profile)
        for profile in (
            replace(self.profile, release_sha256="not-a-digest"),
            replace(self.profile, source_url="http://example.invalid"),
            replace(self.profile, licence_url=""),
            replace(self.profile, attribution=""),
            replace(self.profile, years=(2020, 2020, 2100)),
        ):
            with self.assertRaises(ValueError):
                self.adapt(profile=profile)


if __name__ == "__main__":
    unittest.main()
