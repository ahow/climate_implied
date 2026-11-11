"""Synthetic public fixtures only;no retained source files read at import/run."""
from decimal import Decimal
import unittest

from kaya_joint_territorial_bridge import (
    ENTITIES, FIELDS, YEARS, GDP, complete_sum, contract_gate, displayed_closure,
    failed_numeric_cell, number, registry, select_missing, wdi_country_census, wdi_index,
)


class JointTerritorialBridgeTests(unittest.TestCase):
    def test_missing_is_not_zero_or_partial_full_sum(self):
        self.assertEqual(number("0.000"), Decimal("0.000"))
        self.assertIsNone(number(""))
        self.assertIsNone(number(None))
        self.assertIsNone(complete_sum([Decimal(3), None]))
        self.assertIsNone(complete_sum([]))
        self.assertEqual(complete_sum([Decimal("0.000"), Decimal("3.001")]), Decimal("3.001"))
        for invalid in ("NaN", "Infinity", "-1", True, "bad"):
            with self.subTest(invalid=invalid), self.assertRaises(ValueError):
                number(invalid)

    def test_display_quantum_not_posthoc_tolerance_or_scientific_pass(self):
        result = displayed_closure(Decimal("3.000"), [Decimal("1.001"), Decimal("2.000")])
        self.assertEqual(result["residual"], Decimal("-0.001"))
        self.assertEqual(result["displayRoundingEnvelope"], Decimal("0.0015"))
        self.assertTrue(result["insideDisplayRoundingEnvelope"])
        self.assertFalse(result["scientificBoundaryQualified"])
        other = displayed_closure(Decimal("3.000"), [Decimal("1.100"), Decimal("2.000")])
        self.assertFalse(other["insideDisplayRoundingEnvelope"])
        partial = displayed_closure(Decimal("3.000"), [Decimal("1.000"), None])
        self.assertIsNone(partial["completeComponentSum"])
        self.assertIsNone(partial["residual"])
        self.assertEqual(partial["missingComponentCount"], 1)

    def test_sum_keeps_native_decimal_precision(self):
        self.assertEqual(complete_sum([Decimal("1234567890123456789012345678.001"),
                                       Decimal("0.002")]),
                         Decimal("1234567890123456789012345678.003"))

    def test_only_source_country_identifiers_not_aggregate_or_old_refetch(self):
        rows = [{"id": "AAA", "region": {"value": "Fixture region"}},
                {"id": "ZZZ", "region": {"value": "Aggregates"}}]
        countries = registry([{"pages": 1, "total": 2}, rows])
        self.assertEqual(set(countries), {"AAA"})
        self.assertEqual(select_missing({"AAA": "Fixture", "CHN": "China"},
                                        {**countries, "CHN": {}, "XKX": {}}), ["AAA", "XKX"])
        with self.assertRaises(ValueError):
            registry([{"pages": 2, "total": 2}, rows])
        with self.assertRaises(ValueError):
            registry([{"pages": 1, "total": 2}, [rows[0], rows[0]]])

    def payload(self):
        return [{"pages": 1, "total": 1, "sourceid": "2", "lastupdated": "fixture-date"},
                [{"countryiso3code": "AAA", "date": "2010", "value": Decimal("3.001"),
                  "indicator": {"id": GDP}, "country": {"value": "Fixture"}}]]

    def test_wdi_null_stays_source_null_and_duplicates_reject(self):
        payload = self.payload()
        payload[1][0]["value"] = None
        cells, _ = wdi_index(payload, GDP, {"AAA"})
        self.assertIsNone(cells[("AAA", 2010)]["value"])
        self.assertEqual(cells[("AAA", 2010)]["sourceLogicalRow"], 1)
        payload[1].append(dict(payload[1][0]))
        payload[0]["total"] = 2
        with self.assertRaises(ValueError):
            wdi_index(payload, GDP, {"AAA"})

    def test_wdi_scope_revision_and_window_fail_closed(self):
        for field, value in (("date", "2009"), ("countryiso3code", "BBB"), ("value", 0)):
            payload = self.payload()
            payload[1][0][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                wdi_index(payload, GDP, {"AAA"})
        payload = self.payload()
        payload[0]["sourceid"] = "99"
        with self.assertRaises(ValueError):
            wdi_index(payload, GDP, {"AAA"})

    def test_failed_request_distinct_from_publisher_null_or_unattempted(self):
        receipt = {"name": "fixture", "status": "000", "curlExit": 28}
        cell = failed_numeric_cell(receipt, "AAA", 2010)
        self.assertIsNone(cell["value"])
        self.assertEqual(cell["missingReason"], "attempted-numeric-acquisition-failed-not-publisher-data-null")
        self.assertEqual(cell["failedCurlExit"], 28)
        with self.assertRaises(ValueError):
            failed_numeric_cell({**receipt, "status": "200", "curlExit": 0}, "AAA", 2010)

    def test_later_revision_not_spliced_into_retained_world(self):
        world = {"value": Decimal(10), "sourceMetadata": {"sourceid": "2", "lastupdated": "old"}}
        members = [{"countryIdentifier": "AAA", "cell": {"value": Decimal(6),
                    "sourceMetadata": {"sourceid": "2", "lastupdated": "old"}}},
                   {"countryIdentifier": "BBB", "cell": {"value": Decimal(4),
                    "sourceMetadata": {"sourceid": "2", "lastupdated": "new"}}}]
        result = wdi_country_census(world, members, "population")
        self.assertEqual(result["numericPresentMembersAcrossSourceRevisions"], 2)
        self.assertEqual(result["matchingRevisionPresentMembers"], 1)
        self.assertEqual(result["nativeWorldMinusMatchingRevisionCountrySubtotal"], Decimal(4))
        self.assertIsNone(result["sameRevisionCompleteCountrySum"])
        self.assertEqual(result["missingCompatibleCellCauses"][0]["status"], "later-source-revision-not-spliced")
        self.assertFalse(result["sourceTerritoryCompatibilityWithFrozenCO2Qualified"])

    def rows(self):
        return [{"entity": e, "year": y, "cells": {f: {"value": Decimal(1)} for f in FIELDS}}
                for e in ENTITIES for y in YEARS]

    def test_no_shortening_or_missing_entity_contract(self):
        rows = self.rows()
        gate = contract_gate(rows[:-1], original_basis=True, source_boundaries=True)
        self.assertFalse(gate["originalFrozenContractQualified"])
        self.assertEqual(len(gate["missingCells"]), 4)
        with self.assertRaises(ValueError):
            contract_gate(rows + [rows[0]], original_basis=True, source_boundaries=True)
        rows[0]["cells"]["CO2Mt"]["value"] = Decimal(0)
        self.assertIn("nonpositive-or-nonfinite-original-contract-input",
                      contract_gate(rows, original_basis=True, source_boundaries=True)["failedGates"])

    def test_complete_numeric_alternative_not_original_basis_or_boundary_pass(self):
        gate = contract_gate(self.rows(), original_basis=False, source_boundaries=False)
        self.assertFalse(gate["originalFrozenContractQualified"])
        self.assertIn("GDP2021PPP-is-separate-from-original-MPD2011PPP", gate["failedGates"])
        self.assertIn("territory-primary-energy-and-bunker-boundaries-unqualified", gate["failedGates"])
        self.assertFalse(gate["fitExecuted"])
        self.assertEqual(gate["holdoutScores"], 0)


if __name__ == "__main__":
    unittest.main()
