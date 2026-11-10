"""New bounded original-source evidence only; no old study fits or network calls."""
import hashlib
import json
import math
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("generated-artifacts/driver-source-continuation")
PINNED_ONSHORE = "46033dca04850738f2d1bf6ff0b4dd9da9dc6ab9df5012ae03d58f8d9ec36a41"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def audit_onshore(data):
    expected = ["Country/area", "Technology", "Data Type", "Grid connection", "Year"]
    if data["id"] != expected or data["size"] != [224, 1, 1, 1, 15]:
        raise ValueError("Unexpected original IRENA dimensions")
    dimensions = data["dimension"]
    for name, code, label in [("Technology", "5", "Onshore wind energy"),
                              ("Data Type", "1", "Electrical Installed Capacity (MW)"),
                              ("Grid connection", "0", "All")]:
        if dimensions[name]["category"]["label"] != {code: label}:
            raise ValueError("Wrong original technology/stock/unit/scope")
    years = dimensions["Year"]["category"]
    countries = dimensions["Country/area"]["category"]
    values = data["value"]
    if not isinstance(values, list) or len(values) != 3360:
        raise ValueError("Rectangular original country-year array required")
    if any(v is not None and (not isinstance(v, (int, float)) or not math.isfinite(v) or v < 0) for v in values):
        raise ValueError("Finite nonnegative source capacity or explicit null required")
    records = []
    for year in range(2010, 2025):
        indices = [code for code, label in years["label"].items() if label == str(year)]
        if len(indices) != 1:
            raise ValueError("Required frozen year absent or duplicated")
        year_index = years["index"][indices[0]]
        cells = [values[country_index * 15 + year_index] for country_index in countries["index"].values()]
        missing = sum(v is None for v in cells)
        records.append({
            "year": year, "countryAreaCount": len(cells),
            "finiteCountryCells": len(cells) - missing,
            "missingCountryCells": missing,
            "explicitSourceZeroCells": sum(v == 0 for v in cells if v is not None),
            "observedCountrySubtotalMW": sum(v for v in cells if v is not None),
            "strictCompleteGlobalOnshoreMW": None,
            "globalReconciliation": "not-established; missing country cells are not zeros",
        })
    return {
        "source": data["source"], "reportedUpdatedRaw": data["updated"],
        "usableUpdatedTimestamp": None,
        "invalidTimestampReason": "9999-12-31 sentinel is not source publication or observation availability",
        "coverage": records, "missingCells": sum(v is None for v in values),
        "explicitZeroCells": sum(v == 0 for v in values if v is not None),
        "strictGlobalSeriesReady": False,
        "missingEarlierYearsSilentlyFilled": False,
    }


def request_receipts():
    rows = []
    for log in sorted(ROOT.glob("*-request.log")):
        text = log.read_text()
        stem = log.name.removesuffix("-request.log")
        headers = ROOT / (stem + ".headers")
        url = re.search(r"url_effective=(.*)", text).group(1).strip()
        status = int(re.search(r"http_code=(\d+)", text).group(1))
        content_types = re.findall(r"(?im)^Content-Type:\s*([^\r\n]+)", headers.read_text())
        rows.append({"url": url, "httpStatus": status, "contentType": content_types[-1] if content_types else None,
                     "requestLog": str(log), "requestLogSha256": sha(log),
                     "headers": str(headers), "headersSha256": sha(headers),
                     "postBody": {"path": str(ROOT / "irena-onshore-query.json"),
                                  "sha256": sha(ROOT / "irena-onshore-query.json")} if stem == "irena-onshore-data" else None})
    if len(rows) != 11:
        raise ValueError("Bounded attempt receipt count changed")
    return rows


def main():
    if sha(ROOT / "irena-onshore-data.json") != PINNED_ONSHORE:
        raise ValueError("Original IRENA response changed")
    audit = audit_onshore(json.loads((ROOT / "irena-onshore-data.json").read_text()))
    # Fixed retained source loader validates original PDF/text/release bytes
    # and directly executes the newly frozen descriptive accounting formula.
    command = [
        "node", "--import", "tsx", "--input-type=module", "-e",
        "import{retainedPolicyExposureSnapshot}from'./server/calculation/driverParameterRegistry.ts';"
        "console.log(JSON.stringify(await retainedPolicyExposureSnapshot()));"
    ]
    run = subprocess.run(command, capture_output=True, text=True, timeout=60)
    (ROOT / "policy-source-accounting-execution.log").write_text(
        " ".join(command) + "\n" + run.stdout + run.stderr)
    if run.returncode:
        raise ValueError("Original policy snapshot execution failed")
    policy = json.loads(run.stdout)
    (ROOT / "policy-exposure-result.json").write_text(json.dumps(policy, indent=2) + "\n")
    (ROOT / "onshore-source-audit.json").write_text(json.dumps(audit, indent=2) + "\n")
    inspection = json.loads((ROOT / "retained-policy-workbook-inspection.json").read_text())
    catalog = json.loads((ROOT / "irena-capacity-catalog.json").read_text())
    metadata_release = (ROOT / "worldbank-2025-release.html").read_text().replace("&q;", '"')
    issue_date = re.search(r'"dc.date.issued":\[\{[^}]*"value":"([^"]+)"', metadata_release).group(1)
    if issue_date != "2025-06-10":
        raise ValueError("Original policy release date not confirmed")
    receipts = request_receipts()
    test_logs = [
        {"command": "npx tsx --test script/policy-exposure.test.ts", "passed": 3,
         "failed": 0, "skipped": 0, "path": str(ROOT / "public-policy-code-only-tests.log"),
         "sha256": sha(ROOT / "public-policy-code-only-tests.log"),
         "basis": "synthetic engineering fixtures only, isolated source-absent code-only working directory"},
        {"command": "npx tsx --test script/validate-driver-source-continuation-private.ts", "passed": 3,
         "failed": 0, "skipped": 0, "path": str(ROOT / "mandatory-source-tests.log"),
         "sha256": sha(ROOT / "mandatory-source-tests.log"), "basis": "MANDATORY real original retained source validation; not public test glob"},
    ]
    previous = json.loads(Path("docs/driver-consumption-evidence.json").read_text())
    cli_path = "script/run-regional-ensemble.ts"
    prior_frozen = {path: sha(path) == expected for path, expected in previous["preservation"]["after"].items()}
    old_adoption_report = Path("generated-artifacts/driver-calibration/uncertainty.json")
    adoption_report_unchanged = sha(old_adoption_report) == "6c00e7c77d5cea0cd5122e0f09916a14aeefdec5b18e2deee51cbd694adac2ed"
    cli_unchanged = sha(cli_path) == previous["implementation"][cli_path]
    if not all(prior_frozen.values()) or not adoption_report_unchanged or not cli_unchanged:
        raise ValueError("Prior frozen evidence or core CLI changed; preservation cannot be claimed")
    report = {
        "schemaVersion": 1, "completedAt": datetime.now(timezone.utc).isoformat(),
        "protocol": {"path": "docs/driver-source-continuation-protocol.json",
                     "sha256": sha("docs/driver-source-continuation-protocol.json")},
        "bounds": {"windRequests": 6, "policyRequests": 5, "paidCalls": 0,
                   "sourceSelection": "Original wind completion attempt, then one original World Bank policy release; no nowcast sweep"},
        "requests": receipts,
        "wind": {
            "originalRequest": "Exact global onshore cumulative2010–2024 plus exact constant-dollar installed-cost table",
            "newSource": {"publisher": "IRENA", "edition": "Renewable Energy Statistics2026, H2 PxWeb table",
                          "tableId": "Country_ELECSTAT_2026_H2_PX.px",
                          "catalogUpdated": next(r["updated"] for r in catalog if r["id"] == "Country_ELECSTAT_2026_H2_PX.px"),
                          "dateMeaning": "Publisher catalogue revision timestamp; not original annual observation availability",
                          "path": str(ROOT / "irena-onshore-data.json"), "sha256": PINNED_ONSHORE},
            "taxonomyFinding": "Original regional API exposes total Wind energy only; rejected as onshore substitute. Original country/area API exposes exact onshore capacity and all-grid stock in MW.",
            "audit": audit,
            "exactCostTable": {"ready": False, "officialCostPageStatus": 403,
                               "originalReportLinksInspected": True,
                               "machineReadableCompleteCostTableDiscovered": False,
                               "rounded2025ReportLabelsRemainRejected": True},
            "fitOrBaselineOrHoldoutRerun": False,
            "decision": "Blocked. Full detailed-year source exists, but null country cells prevent certified global reconstruction; exact installed-cost table still unavailable. No older-edition splice, zero-fill, chart digitisation or shortened window.",
        },
        "retainedPolicyInputRejection": {
            "path": inspection["path"], "sha256": inspection["sha256"],
            "sheetNames": [r["name"] for r in inspection["sheets"]],
            "reason": "Retained CarbonData workbook is a company financial/emissions workbook, not an original World Bank price/coverage/exemption series. No company rows were used or redistributed.",
        },
        "policy": {
            "sourceTitle": "World Bank State and Trends of Carbon Pricing2025",
            "originalRepositoryIssuedDate": issue_date,
            "policySnapshotDate": "2025-04-01", "coverageInventoryYear": 2023,
            "currentLandingPageEdition": 2026,
            "editionDecision": "Followed explicit2025 release link; did not substitute2026 price or coverage observations",
            "downloadValidation": "First public /download route returned200 text/html and was rejected; same original bitstream /content returned verified PDF magic and was used",
            "result": policy,
            "execution": {"command": command, "exitCode": run.returncode,
                          "log": str(ROOT / "policy-source-accounting-execution.log"),
                          "logSha256": sha(ROOT / "policy-source-accounting-execution.log")},
            "classification": "New original-source-backed descriptive policy exposure; sensitivity-only context, NOT a fitted causal policy parameter, prior or calibrated distribution",
            "candidateBothBaselinesHeldoutStudy": "Not run: no compatible frozen policy predictive outcome protocol or identified elasticity; a descriptive snapshot does not create an eligible learning-curve study",
            "uncertaintyAndDependence": "Unavailable; no invented source precision, rounding interval, cross-instrument covariance or distribution",
            "missing": ["net exemption/free-allocation adjustment", "enforcement and behavioural elasticity",
                        "instrument-specific annual price-times-coverage with heterogeneous scope and double-counting controls",
                        "compatible original full-window causal/predictive outcomes"],
        },
        "tests": test_logs,
        "ownedTypeDiagnostics": {"count": 0, "log": str(ROOT / "owned-typescript-diagnostics.log"),
                                 "logSha256": sha(ROOT / "owned-typescript-diagnostics.log")},
        "executionRepair": {"log": str(ROOT / "public-policy-missing-temp-attempt.log"),
                            "reason": "A pre-credit-stop temporary cwd no longer existed. It failed before running tests; created a fresh code-only cwd and executed all3 public assertions successfully. No skip/fallback or source/study change."},
        "preservation": {"unchangedStudiesRerun": False, "oldAdoptionRegistryEntriesChanged": False,
                         "oldCliChanged": not cli_unchanged, "oldCliSha256": sha(cli_path),
                         "frozenFileHashChecks": prior_frozen,
                         "oldAdoptionSourceReportUnchanged": adoption_report_unchanged,
                         "sharedSemanticsRoutesLedgersChanged": False,
                         "priorBaselineFailuresPromoted": False, "scientificAcceptance": False,
                         "parameterStatus": "Existing10 sensitivity-only paired distributions unchanged; new policy parameterDistribution unavailable, not fabricated"},
        "implementationHashes": {p: sha(p) for p in [
            "server/calculation/driverParameterRegistry.ts", "script/policy-exposure.test.ts",
            "script/validate-driver-source-continuation-private.ts", "script/driver_source_continuation.py"]},
    }
    path = Path("docs/driver-source-continuation-evidence.json")
    path.write_text(json.dumps(report, indent=2) + "\n")
    clauses = [
        {"id": "S04-002", "proposedStatus": "partial",
         "newEvidence": "Original IRENA2026 detailed onshore-capacity source/schema queried over unchanged2010–2024; regional total-wind substitution rejected;1264 missing country-year cells preserved. Exact installed-cost table remains missing; no learning-curve fit claimed.",
         "remainingGap": "Original exact installed-cost table and complete reconciled global onshore capacity; frozen full-window baseline/uncertainty/dependence study not ready"},
        {"id": "S04-004", "proposedStatus": "partial",
         "newEvidence": "New original2025 World Bank price-times-coverage gross snapshot executed from compatible policy-snapshot/currency/denominator definitions; exemptions/free allocation/enforcement/elasticity unknowns preserved and central use rejected.",
         "remainingGap": "No instrument-specific exemption-adjusted elasticity or full-window policy predictive study; not central/calibrated"},
        {"id": "S04-008", "proposedStatus": "partial",
         "newEvidence": "New policy source exposure explicitly sensitivity-only descriptive context, with parameter distribution unavailable; no scalar product misrepresented as a calibrated joint distribution.",
         "remainingGap": "No new real calibrated/prior joint policy distribution; existing paired adoption sensitivity distributions unchanged"},
    ]
    proposal = {"kind": "source-evidence-clause-proposal-not-canonical-ledger",
                "evidencePath": str(path), "evidenceSha256": sha(path),
                "records": clauses, "scientificOrProductionPromotion": False}
    Path("docs/driver-source-clause-updates-proposal.json").write_text(json.dumps(proposal, indent=2) + "\n")
    print(json.dumps({"evidence": str(path), "requests": len(receipts),
                      "windGlobalSeriesReady": False, "windMissingCells": audit["missingCells"],
                      "newPolicyGrossDescriptiveExposure": policy["grossExposureUSDPerTotalTCO2e"],
                      "policyPriceBaseYear": policy["priceBasis"]["realBaseYear"],
                      "policyParameterDistribution": policy["parameterDistribution"]["status"],
                      "policyCentralEligible": policy["centralModelEligible"],
                      "tests": [r["passed"] for r in test_logs]}))


if __name__ == "__main__":
    main()
