"""Small contract/security fixtures only;not synthetic scientific source rows."""
import copy
import io
import stat
import unittest
import zipfile

from climatetrace_monthly_archive_bridge import (
    ArchiveBudget, csv_records, parse_live_monthly, qualify_asset_row,
    repeated_native_period_audit, schema_proof,
)


class ArchiveMonthlyBridgeTests(unittest.TestCase):
    def row(self):
        return {"gas": "co2", "sector": "mineral-extraction", "subsector": "bauxite-mining",
                "temporal_granularity": "month", "start_time": "2024-02-01 00:00:00",
                "end_time": "2024-02-29 00:00:00", "iso3_country": "USA",
                "source_id": "fixture", "emissions_quantity": "0"}

    def test_exact_leap_month_and_native_zero(self):
        q = qualify_asset_row(self.row(), "bauxite-mining")
        self.assertEqual(q["month"], "2024-02")
        self.assertEqual(q["CO2tonnes"], 0)

    def test_missing_quantity_stays_missing(self):
        for value in ("", "N/A", "null"):
            row = self.row()
            row["emissions_quantity"] = value
            self.assertIsNone(qualify_asset_row(row, "bauxite-mining")["CO2tonnes"])

    def test_wrong_gas_annual_partial_nonfinite_negative_rejected(self):
        for field, value in (("gas", "co2e_100yr"), ("temporal_granularity", "annual"),
                             ("end_time", "2024-02-28 00:00:00"),
                             ("start_time", "2024-02-01 01:00:00"),
                             ("emissions_quantity", "nan"), ("emissions_quantity", "-1")):
            with self.subTest(field=field, value=value):
                row = self.row()
                row[field] = value
                with self.assertRaises(ValueError):
                    qualify_asset_row(row, "bauxite-mining")

    def archive(self, name="safe.csv", *, symlink=False):
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as z:
            entry = zipfile.ZipInfo(name)
            if symlink:
                entry.create_system = 3
                entry.external_attr = (stat.S_IFLNK | 0o777) << 16
            z.writestr(entry, b"a,b\n1,2\n")
        buf.seek(0)
        return zipfile.ZipFile(buf)

    def test_zip_member_crc_budget_and_no_filesystem_extraction(self):
        with self.archive() as z:
            budget = ArchiveBudget()
            self.assertEqual(len(budget.inspect(z)), 1)
            self.assertEqual(budget.read(z, "safe.csv", 8), b"a,b\n1,2\n")
            self.assertEqual(budget.bytes_read, 8)
            with self.assertRaises(ValueError):
                budget.read(z, "safe.csv", 7)

    def test_traversal_absolute_windows_and_symlink_members_rejected(self):
        for name in ("../bad.csv", "/absolute.csv", r"C:\bad.csv", "C:/bad.csv"):
            with self.subTest(name=name), self.archive(name) as z:
                with self.assertRaises(ValueError):
                    ArchiveBudget().inspect(z)
        with self.archive(symlink=True) as z:
            with self.assertRaises(ValueError):
                ArchiveBudget().inspect(z)

    def test_duplicate_and_ragged_data_headers_rejected(self):
        for body in (b"a,a\n1,2\n", b"a,b\n1\n", b"a,b\n1,2,3\n"):
            with self.assertRaises(ValueError):
                list(csv_records(body))

    def test_selected_schema_duplicate_columns_must_agree(self):
        head = "sector,subsector,sector,subsector,gas,emissions_quantity\n"
        rows = "".join(f"mineral-extraction,{s},mineral-extraction,{s},Carbon Dioxide (CO2) metric tonnes,Quantity in metric tonnes\n"
                       for s in ("bauxite-mining", "copper-mining", "iron-mining"))
        proof = schema_proof((head + rows).encode())
        self.assertEqual(len(proof["selectedUnitProofs"]), 3)
        with self.assertRaises(ValueError):
            schema_proof((head + rows.replace("mineral-extraction,bauxite-mining,mineral-extraction,bauxite-mining",
                                              "mineral-extraction,bauxite-mining,mineral-extraction,wrong")).encode())

    def live(self):
        meta = {"dataVersion": "fixture", "releaseDate": "2026-03-01",
                "temporalCoverage": {"frequency": "monthly", "end": "2026-01"}}
        rows = [{"subsector": s, "sector": "mineral-extraction", "gas": "co2",
                 "year": 2026, "month": 1, "emissionsQuantity": float(n + 1)}
                for n, s in enumerate(("bauxite-mining", "copper-mining", "iron-mining"))]
        payload = {"location": {"gadmId": "USA", "country": "USA"},
                   "subsectors": {"timeseries": rows},
                   "totals": {"timeseries": [{"gas": "co2", "year": 2026, "month": 1,
                                               "emissionsQuantity": 6.0}]}}
        return payload, meta

    def test_publisher_total_not_relabelled_when_response_scope_is_broader(self):
        payload, meta = self.live()
        extra = dict(payload["subsectors"]["timeseries"][0], subsector="other-mining-quarrying",
                     emissionsQuantity=4.0)
        payload["subsectors"]["timeseries"].append(extra)
        payload["totals"]["timeseries"][0]["emissionsQuantity"] = 10.0
        result = parse_live_monthly(payload, meta)
        self.assertFalse(result["requestScopeCompatible"])
        self.assertFalse(result["sourceTotalAdmittedAsRequestedThreeSubsectors"])
        self.assertEqual(len(result["selectedNativeSubsectorMonthlyRows"]), 3)
        self.assertEqual(result["monthlyResponseScopeResiduals"][0]["publisherTotalMinusSelected"], 4.0)
        self.assertEqual(result["monthlyResponseScopeResiduals"][0]["publisherTotalMinusAllNativeSubsectors"], 0.0)
        self.assertFalse(result["fitEligible"])
        self.assertFalse(result["metadataBoundToResponseByDataVersionHeader"])

    def test_api_duplicate_month_wrong_gas_country_and_cutoff_rejected(self):
        for mutation in ("duplicate", "gas", "country", "cutoff"):
            with self.subTest(mutation=mutation):
                payload, meta = self.live()
                if mutation == "duplicate":
                    payload["subsectors"]["timeseries"].append(copy.deepcopy(payload["subsectors"]["timeseries"][0]))
                elif mutation == "gas":
                    payload["subsectors"]["timeseries"][0]["gas"] = "co2e_100yr"
                elif mutation == "country":
                    payload["location"]["country"] = "wrong"
                else:
                    meta["temporalCoverage"]["end"] = "2025-12"
                with self.assertRaises(ValueError):
                    parse_live_monthly(payload, meta)

    def test_no_incomplete_api_selected_month(self):
        payload, meta = self.live()
        payload["subsectors"]["timeseries"].pop()
        with self.assertRaises(ValueError):
            parse_live_monthly(payload, meta)

    def test_source_repetition_audit_exact_decimal_without_filling(self):
        rows = [
            {"subsector": "fixture", "source_id": "A", "iso3_country": "USA",
             "start_time": f"{year}-01-01 00:00:00", "emissions_quantity_native": value}
            for year, value in (("2024", "1.000000000000000000001"),
                                ("2025", "1.000000000000000000001"),
                                ("2026", "1.000000000000000000002"))
        ]
        audit = repeated_native_period_audit(rows)
        self.assertEqual(audit[0]["exactDecimalEqualCells"], 1)
        self.assertEqual(audit[0]["exactEqualNonzeroCells"], 1)
        self.assertEqual(audit[1]["exactDecimalEqualCells"], 0)
        self.assertEqual(audit[1]["maxAbsNativeCO2TonnesDifference"], "1E-21")
        with self.assertRaises(ValueError):
            repeated_native_period_audit(rows + [rows[0]])


if __name__ == "__main__":
    unittest.main()
