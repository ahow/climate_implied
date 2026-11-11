"""Required private paired-source assertions; missing bytes FAIL,never skip.

No acquisition,assembly,forecast or scientific study is rerun by this validator.
Public unittest discovery intentionally runs only synthetic-fixture test_ files.
"""
from collections import Counter
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import unittest


def validate():
    a = unittest.TestCase()
    root = Path("generated-artifacts/kaya-joint-territorial")
    evidence = json.loads(Path("docs/kaya-joint-territorial-source-evidence.json").read_text())
    pins = evidence["artifactPins"] + evidence["preservedSourcePins"]
    for item in pins:
        a.assertEqual(hashlib.sha256(Path(item["path"]).read_bytes()).hexdigest(),
                      item["sha256"], item["path"])
    manifest = json.loads((root / "requests.json").read_text())
    initial = json.loads((root / "requests-initial3.json").read_text())
    a.assertEqual(manifest["requests"][:3], initial["requests"])
    a.assertEqual(len(manifest["requests"]), 5)
    a.assertEqual([r["status"] for r in manifest["requests"]], ["200", "200", "200", "000", "200"])
    a.assertEqual([r["curlExit"] for r in manifest["requests"]], [0, 0, 0, 28, 0])
    a.assertEqual(sum(r["bytes"] for r in manifest["requests"]), 1293753)
    request_hashes = 0
    for receipt in manifest["requests"]:
        for key in ("body", "headers"):
            path = Path(receipt[key])
            if receipt[key + "SHA256"] is None:
                a.assertFalse(path.exists(), str(path))
            else:
                a.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), receipt[key + "SHA256"])
                request_hashes += 1
    a.assertEqual(request_hashes, 9)
    a.assertEqual(len(manifest["requestedNewCountries"]), 177)
    a.assertFalse(set(manifest["requestedNewCountries"]) & set(manifest["retainedCountriesNotRefetched"]))
    for filename, total, date in (("remaining-gdp.body", 2655, "2026-10-08"),
                                  ("remaining-population.body", 2655, "2026-10-08"),
                                  ("world-census-population.body", 150, "2026-11-11")):
        meta, rows = json.loads((root / filename).read_text())
        a.assertEqual(meta["total"], total)
        a.assertEqual(len(rows), total)
        a.assertEqual(meta["lastupdated"], date)
    original = json.loads(Path("generated-artifacts/kaya-highfrequency-source/source-assembly-result.json").read_text())
    a.assertEqual(len(original["EU27"]["missingMemberYears"]), 54)
    result = json.loads((root / "joint-territorial-source-result.json").read_text())
    paired = json.loads((root / "paired-native-source-cells.json").read_text())
    a.assertEqual(result["nationalCandidateRows"], 3285)
    a.assertEqual(result["nationalCompleteNumericFourCellRows"], 2844)
    a.assertEqual(result["originalRegionalRows"], 105)
    a.assertEqual(result["completeNumericRegionalRows"], 75)
    a.assertEqual(result["completeWDICountryRegisterRows"], 3255)
    a.assertEqual(result["coreNationalRegionalWDILastupdatedValues"], ["2026-10-08"])
    a.assertEqual(result["WDILastupdatedValues"], ["2026-10-08", "2026-11-11"])
    a.assertTrue(result["coreNationalRegionalWDISourceRevisionMatched"])
    a.assertFalse(result["jointWDISourceRevisionMatched"])
    a.assertTrue(result["laterRevisionPopulationSidecarNotSplicedIntoWorldClosure"])
    missing = Counter((c["field"], c["status"]) for c in result["missingNationalSourceCells"])
    a.assertEqual(missing, {
        ("primaryEnergyTWh", "native-empty-energy-or-CO2-cell"): 197,
        ("CO2Mt", "native-empty-energy-or-CO2-cell"): 45,
        ("GDP2021PPP", "publisher-returned-null"): 172,
        ("GDP2021PPP", "numeric-query-unattempted-no-publisher-WDI-country-identity"): 180,
        ("population", "numeric-query-unattempted-no-publisher-WDI-country-identity"): 180})
    expected_energy = ["-2.246", "-1.691", "-1.572", "-1.456", "-1.436", "-2.505", "-4.027",
                       "-1.609", "-1.783", "-1.818", "-1.228", "-2.036", "-0.647", "-0.327", "2.233"]
    eu_energy = [r for r in result["EU27Residuals"] if r["field"] == "primaryEnergyTWh"]
    a.assertEqual([r["residual"] for r in eu_energy], expected_energy)
    a.assertTrue(all(not r["insideDisplayRoundingEnvelope"] for r in eu_energy))
    a.assertTrue(all(r["displayRoundingEnvelope"] == "0.0140" for r in eu_energy))
    eu_co2 = [r for r in result["EU27Residuals"] if r["field"] == "CO2Mt"]
    a.assertEqual(len(eu_co2), 15)
    a.assertTrue(all(r["insideDisplayRoundingEnvelope"] for r in eu_co2))
    numerical_evidence = evidence["numericalSourceReconciliation"]
    a.assertEqual([r["residual"] for r in eu_co2],
                  numerical_evidence["EU27NativeMinusComplete27NativeMembers"]["CO2MtVector"])
    a.assertEqual([r["residual"] for r in eu_energy],
                  numerical_evidence["EU27NativeMinusComplete27NativeMembers"]["primaryEnergyTWhVector"])
    native_carbon = [r for r in result["worldCountryBunkerResiduals"] if r["field"] == "CO2Mt"]
    a.assertEqual(len(native_carbon), 15)
    a.assertEqual(max(Decimal(r["worldMinusObservedCountriesAndBunkers"]).copy_abs()
                      for r in native_carbon), Decimal("0.011"))
    a.assertEqual([r["worldMinusObservedCountriesAndBunkers"] for r in native_carbon],
                  numerical_evidence["WorldNativeCO2MinusAvailableCountryCensusMinusNativeBunkersMt"]["vector"])
    a.assertEqual([r["worldMinusObservedCountries"] for r in result["worldCountryBunkerResiduals"]
                   if r["field"] == "primaryEnergyTWh"],
                  numerical_evidence["WorldNativeEnergyMinusAvailableCountryCensusTWh"]["vector"])
    for row in native_carbon:
        a.assertEqual({c["countryIdentifier"] for c in row["missingCountryCells"]}, {"MCO", "SMR", "VAT"})
        a.assertFalse(row["territorialPartitionQualified"])
    for row in result["worldCountryBunkerResiduals"]:
        if row["field"] == "primaryEnergyTWh":
            a.assertIsNone(row["nativeBunkerTotal"])
            a.assertIsNone(row["worldMinusObservedCountriesAndBunkers"])
    for row in result["WDIWorldCountryRegisterReconciliation"]:
        a.assertIsNone(row["sameRevisionCompleteCountrySum"])
        if row["field"] == "population":
            a.assertEqual(row["matchingRevisionPresentMembers"], 207)
            a.assertEqual(len(row["revisionMismatchedMembers"]), 10)
            a.assertEqual(row["numericPresentMembersAcrossSourceRevisions"], 217)
            a.assertTrue(row["laterRevisionSidecarExcludedFromClosure"])
    for row in paired["regional"]:
        if row["entity"] == "Rest of World":
            a.assertTrue(all(c["value"] is None for c in row["cells"].values()))
        elif row["entity"] == "International transport":
            a.assertIsNotNone(row["cells"]["CO2Mt"]["value"])
            for field in ("population", "GDP2021PPP", "primaryEnergyTWh"):
                a.assertIsNone(row["cells"][field]["value"])
    gate = result["contractAdmission"]
    a.assertFalse(gate["originalFrozenContractQualified"])
    a.assertEqual(len(gate["missingCells"]), 105)
    a.assertEqual(result["fits"], 0)
    a.assertEqual(result["holdoutScores"], 0)
    a.assertFalse(result["centralEligible"])
    print(json.dumps({"artifactAndPreservedSourceHashesVerified": len(pins),
                      "requestBodyHeaderHashesVerified": request_hashes,
                      "nationalCandidateRows": 3285, "completeNumericRegionalRows": 75,
                      "originalFrozenContractQualified": False, "missingFilesSkipped": 0,
                      "sourceOrForecastReruns": 0, "fits": 0}))


if __name__ == "__main__":
    validate()
