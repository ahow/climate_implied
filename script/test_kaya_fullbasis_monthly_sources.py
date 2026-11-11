"""Source-independent contract fixtures; not scientific observations."""
import copy
import unittest

from kaya_fullbasis_monthly_sources import (
    GDP, aggregate_complete, admit_contract, admit_monthly_rows, frozen_identity_map, parse_wdi,
)


class FullBasisSourceTests(unittest.TestCase):
    def payload(self):
        rows = [
            {"countryiso3code": c, "country": {"value": c}, "date": str(y),
             "indicator": {"id": GDP}, "value": 100.0}
            for c in ("AUT", "BEL") for y in (2010, 2011)
        ]
        return [{"pages": 1, "total": 4, "sourceid": "2", "lastupdated": "2026-10-08"}, rows]

    def parse(self, payload):
        return parse_wdi(payload, GDP, countries=("AUT", "BEL"), years=(2010, 2011))

    def test_full_window_and_native_null_preserved(self):
        parsed = self.parse(self.payload())
        self.assertEqual(len(parsed["cells"]), 4)
        self.assertEqual(parsed["missingCells"], [])
        payload = self.payload()
        payload[1][2]["value"] = None
        parsed = self.parse(payload)
        self.assertEqual(parsed["missingCells"], [{"country": "BEL", "year": 2010}])
        self.assertIsNone(aggregate_complete(parsed["cells"], ("AUT", "BEL"))[0]["value"])
        self.assertEqual(aggregate_complete(parsed["cells"], ("AUT", "BEL"))[1]["value"], 200.0)

    def test_duplicate_wrong_indicator_source_pagination_and_nonfinite_rejected(self):
        for mutation in ("duplicate", "indicator", "source", "pagination", "nonfinite", "zero"):
            with self.subTest(mutation=mutation):
                payload = self.payload()
                if mutation == "duplicate":
                    payload[1][1] = copy.deepcopy(payload[1][0])
                elif mutation == "indicator":
                    payload[1][0]["indicator"]["id"] = "wrong"
                elif mutation == "source":
                    payload[0]["sourceid"] = "different"
                elif mutation == "pagination":
                    payload[0]["pages"] = 2
                elif mutation == "nonfinite":
                    payload[1][0]["value"] = float("nan")
                else:
                    payload[1][0]["value"] = 0
                with self.assertRaises(ValueError):
                    self.parse(payload)

    def test_missing_source_row_not_interpolated(self):
        payload = self.payload()
        payload[1].pop()
        payload[0]["total"] = 3
        parsed = self.parse(payload)
        self.assertEqual(parsed["missingCells"], [{"country": "BEL", "year": 2011}])

    def test_complete_GDP_does_not_authorize_full_original_contract(self):
        parsed = self.parse(self.payload())
        decision = admit_contract(parsed, parsed, basis="WDI-source2-2021-international-PPP",
                                  energy="unattempted", carbon="unattempted", boundaries="unattempted",
                                  vintage="revised-history-explicit",
                                  missing_regional_cells=[{"entity": "International transport", "year": 2024}])
        self.assertFalse(decision["originalFrozenContractAdmitted"])
        self.assertFalse(decision["forecastExecuted"])
        self.assertIn("GDP-basis-not-original-MPD2023-2011-international-PPP", decision["failedGates"])
        self.assertIn("original-seven-regional-accounts-incomplete", decision["failedGates"])

    def test_world_blank_ISO_is_not_other_blank_ISO_aggregate(self):
        world = {"country": "World", "iso_code": "", "year": "2024", "gdp": "100"}
        other = {"country": "Unrelated aggregate", "iso_code": "", "year": "2024", "gdp": "999"}
        matched = frozen_identity_map([world, other])
        self.assertEqual(matched[("WLD", 2024)]["gdp"], "100")
        self.assertEqual(len(matched), 1)
        with self.assertRaises(ValueError):
            frozen_identity_map([world, world])

    def release(self):
        return {"identityVerified": True, "rightsVerified": True, "originalVersionVerified": True,
                "publisherReleaseDate": "2025-02-01", "version": "test-fixture-only",
                "gas": "CO2", "units": "tonnes CO2 per period", "frequency": "monthly",
                "scope": "fixture fossil and industrial", "regionBoundary": "fixture fixed region",
                "historyBasis": "dated-original-release", "sourceSHA256": "a" * 64,
                "methodsSHA256": "b" * 64, "publisherURL": "https://example.invalid/test-fixture",
                "observationCutoff": "2024-12-31"}

    def row(self):
        return {"region": "fixture", "sector": "fixture", "start": "2024-02-01",
                "end": "2024-02-29", "CO2": 1.0, "periodStatus": "provisional-estimate"}

    def test_exact_leap_month_and_no_origin_claim(self):
        result = admit_monthly_rows([self.row()], self.release())
        self.assertEqual(len(result["rows"]), 1)
        self.assertFalse(result["originalHistoricalOriginAvailabilityCertified"])
        self.assertFalse(result["forecastExecuted"])
        release = self.release()
        release["frequency"] = "daily"
        row = self.row()
        row["start"] = row["end"]
        self.assertEqual(len(admit_monthly_rows([row], release)["rows"]), 1)

    def test_CO2e_quarterly_and_annual_daily_rate_not_substituted(self):
        for field, value in (("gas", "CO2e"), ("frequency", "quarterly"),
                             ("units", "Mt CO2 per day annual average"),
                             ("originalVersionVerified", False), ("methodsSHA256", "unknown"),
                             ("historyBasis", "latest-history-as-origin")):
            with self.subTest(field=field):
                release = self.release()
                release[field] = value
                with self.assertRaises(ValueError):
                    admit_monthly_rows([self.row()], release)

    def test_partial_month_duplicate_nonfinite_and_projection_rejected(self):
        for mutation in ("partial-month", "duplicate", "nonfinite", "projection", "after-cutoff"):
            with self.subTest(mutation=mutation):
                row = self.row()
                rows = [row]
                if mutation == "partial-month":
                    row["end"] = "2024-02-28"
                elif mutation == "duplicate":
                    rows.append(copy.deepcopy(row))
                elif mutation == "nonfinite":
                    row["CO2"] = float("nan")
                elif mutation == "projection":
                    row["periodStatus"] = "forecast"
                else:
                    row.update(start="2025-01-01", end="2025-01-31")
                with self.assertRaises(ValueError):
                    admit_monthly_rows(rows, self.release())

    def test_no_empty_report_rows_admission(self):
        with self.assertRaises(ValueError):
            admit_monthly_rows([], self.release())


if __name__ == "__main__":
    unittest.main()
