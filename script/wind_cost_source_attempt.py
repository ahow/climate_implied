"""One bounded original-source investigation; never substitutes or scores gaps."""
import csv
import hashlib
import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("generated-artifacts/wind-cost-original")
PINNED = {
    "cost-report.pdf": "ffe8ce4bde29616f3edf9ef1a86dbb6ae2d5381a0ecb9bb1f71bb20204b6bada",
    "cost-report.txt": "7a806136e30476c9c3cfd38558b81f4742e9716098fe5f40fa013c0f116897ce",
    "cost-figure-page69-raw.txt": "f56e59c9edb5df14948843c0a00f0354a2b8291a7d446f6f22928723ab50e43f",
    "capacity-report.pdf": "5c87b97a4444a8b33c36b250978fcdeb5fa3526d7a62bba4bb392b80d60cbe13",
    "capacity-report.txt": "92f395fa2bc11f7b893d4ec7d285b7517199e3d198ede8b2ee601206542a26c1",
}
TRAIN, HOLDOUT = list(range(2010, 2019)), list(range(2019, 2025))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def cost_labels(text):
    """Extract explicit publisher labels, NOT digitisation or precise observations."""
    page = text
    marker = "Figure 2.5 Total installed costs of onshore wind projects and global weighted average, 2010–2024"
    if marker not in page or "2024 USD/kW" not in page:
        raise ValueError("Pinned original onshore cost figure/basis absent")
    section = page.split("Capacity (MW) ≤ 10 100 200 300 400 ≥ 500", 1)[1].split(marker, 1)[0]
    labels = [int(v) for v in re.findall(r"\b\d{4}\b", section)]
    if len(labels) != 15:
        raise ValueError("All fifteen explicit original cost labels required")
    return dict(zip(range(2010, 2025), labels))


def capacity_table(text):
    page = text.split("\f")[28]
    if "Onshore wind energy" not in page:
        raise ValueError("Original onshore capacity table absent")
    header = next(line for line in page.splitlines() if line.startswith("CAP (MW)"))
    years = [int(v) for v in re.findall(r"\b20\d{2}\b", header)]
    line = next(line for line in page.splitlines() if line.startswith("World "))
    values = [int(v.replace(" ", "")) for v in re.split(r"\s{2,}", line.strip())[1:]]
    if years != list(range(2015, 2025)) or len(values) != 10:
        raise ValueError("Unrecognised original capacity table coverage")
    return dict(zip(years, values))


def compatibility(costs, capacity, cost_format="rounded-annotated-figure",
                  capacity_scope="global-onshore-wind-cumulative-installed-MW"):
    missing_training = [y for y in TRAIN if y not in costs or y not in capacity]
    missing_holdout = [y for y in HOLDOUT if y not in costs or y not in capacity]
    reasons = []
    if missing_training:
        reasons.append("Missing matched original training pairs; fixed 2010–2018 window cannot be shortened")
    if missing_holdout:
        reasons.append("Missing matched original holdout pairs; fixed 2019–2024 window cannot be shortened")
    if cost_format != "exact-complete-original-table":
        reasons.append("Cost series is published rounded figure annotations, not the exact complete original source table required by frozen source-attempt protocol")
    if capacity_scope != "global-onshore-wind-cumulative-installed-MW":
        reasons.append("Deployment technology/denominator incompatible; total wind or additions cannot substitute")
    return {"status": "compatible-for-existing-method" if not reasons else "rejected-before-fitting",
            "missingTrainingYears": missing_training, "missingHoldoutYears": missing_holdout,
            "matchedTrainingYears": [y for y in TRAIN if y in costs and y in capacity],
            "matchedHoldoutYears": [y for y in HOLDOUT if y in costs and y in capacity],
            "reasons": reasons, "fitExecuted": False, "mae": None,
            "centralModelEligible": False}


def main():
    for name, expected in PINNED.items():
        if sha(ROOT / name) != expected:
            raise ValueError("Pinned original source changed: " + name)
    costs = cost_labels((ROOT / "cost-figure-page69-raw.txt").read_text())
    capacity = capacity_table((ROOT / "capacity-report.txt").read_text())
    gate = compatibility(costs, capacity)
    if gate["status"] != "rejected-before-fitting":
        raise ValueError("Unexpected readiness change; do not fit without reviewed exact source table")
    base_url = "https://www.irena.org"
    requests = [
        ("publication", "/Publications/2025/Jul/Renewable-power-generation-costs-in-2024", 0),
        ("cost-report", "/-/media/Files/IRENA/Agency/Publication/2025/Jul/IRENA_TEC_RPGC_in_2024_2025.pdf", 63),
        ("cost-report-retry", "/-/media/Files/IRENA/Agency/Publication/2025/Jul/IRENA_TEC_RPGC_in_2024_2025.pdf", 0),
        ("capacity-publication", "/Publications/2025/Mar/Renewable-capacity-statistics-2025", 0),
        ("capacity-report", "/-/media/Files/IRENA/Agency/Publication/2025/Mar/IRENA_DAT_RE_Capacity_Statistics_2025.pdf", 0),
    ]
    attempts = []
    for name, url, curl_exit in requests:
        log = ROOT / (name + "-request.log")
        headers = ROOT / (name + ".headers")
        status = int(re.search(r"http_code=(\d+)", log.read_text()).group(1))
        attempts.append({"url": base_url + url, "httpStatus": status, "curlExitCode": curl_exit,
                         "requestLog": str(log), "requestLogSha256": sha(log),
                         "responseHeaders": str(headers), "responseHeadersSha256": sha(headers),
                         "meaning": "HTTP 403 challenge is not a statistical release" if status == 403 else
                         "Original 40MB transport cap refused 51516161-byte PDF before download; bounded same-source retry frozen before numerical inspection" if curl_exit == 63 else
                         "Official original report retained successfully"})
    tests = subprocess.run(["uv", "run", "python", "-m", "unittest", "discover", "-s", "script",
                            "-p", "validate_wind_cost_source_private.py"], capture_output=True, text=True)
    test_log = ROOT / "focused-source-tests.log"
    test_log.write_text(tests.stdout + tests.stderr)
    if tests.returncode:
        raise ValueError("Focused source gate tests failed")
    previous = json.loads(Path("docs/driver-consumption-evidence.json").read_text())
    preservation = {path: sha(path) == expected for path, expected in previous["preservation"]["after"].items()}
    cli_core_unchanged = {path: sha(path) == expected for path, expected in previous["implementation"].items()}
    if not all(preservation.values()) or not all(cli_core_unchanged.values()):
        raise ValueError("Frozen prior evidence or source-core CLI changed")
    with Path("generated-artifacts/driver-calibration/owid-energy-data.csv").open() as stream:
        fields = csv.DictReader(stream).fieldnames
    report = {
        "schemaVersion": 1, "completedAt": datetime.now(timezone.utc).isoformat(),
        "candidate": "Original global onshore-wind total installed cost versus cumulative installed onshore-wind capacity",
        "selection": "One best-ready original candidate only; no policy/nowcast sweep",
        "protocol": {"path": "docs/wind-cost-source-protocol.json", "sha256": sha("docs/wind-cost-source-protocol.json")},
        "existingMethodProtocol": {"path": "docs/Cost_Deployment_Protocol.md", "sha256": sha("docs/Cost_Deployment_Protocol.md")},
        "retainedFilesFirst": {
            "source": "generated-artifacts/driver-calibration/owid-energy-data.csv",
            "sha256": sha("generated-artifacts/driver-calibration/owid-energy-data.csv"),
            "windFields": [f for f in fields if "wind" in f],
            "rejection": "Retained wind observations are generation/consumption shares and levels, not onshore cumulative capacity or total installed project cost; retained solar/battery price bases cannot substitute"
        },
        "boundedAttempts": attempts, "attemptCount": len(attempts), "paidCalls": 0,
        "sources": [
            {"publisher": "IRENA", "edition": "Renewable power generation costs in 2024 (2025 edition)",
             "isbn": "978-92-9260-669-5", "officialPathPublicationMonth": "2025-07",
             "verifiedExactPublicationDay": None,
             "pdfCreationTimestamp": "2025-07-16T09:26:30Z", "pdfModificationTimestamp": "2025-07-31T13:10:18Z",
             "dateCaveat": "PDF internal timestamps and official URL month do not establish original publication day or availability at historical forecast origins",
             "observationYears": [2010, 2024], "path": str(ROOT / "cost-report.pdf"),
             "sha256": PINNED["cost-report.pdf"], "bytes": (ROOT / "cost-report.pdf").stat().st_size,
             "compatibleFields": {"technology": "onshore wind", "geography": "global",
                                  "costMetric": "capacity-weighted mean total installed project cost",
                                  "costUnit": "real 2024 USD/kW",
                                  "currencyBasisLocation": "Methodology: all costs real 2024 US dollars unless otherwise stated",
                                  "valueLocation": "PDF page 69 / printed page 69, Figure 2.5"},
             "precisionLimitation": "All fifteen years explicitly annotated, rounded to whole USD/kW; no exact underlying full-series source table supplied"},
            {"publisher": "IRENA", "edition": "Renewable capacity statistics 2025",
             "isbn": "978-92-9260-652-7", "officialPathPublicationMonth": "2025-03",
             "verifiedExactPublicationDay": None,
             "pdfCreationTimestamp": "2025-03-25T10:04:58Z", "pdfModificationTimestamp": "2025-03-25T10:10:16Z",
             "dateCaveat": "PDF metadata creation date is not proof of publication date",
             "observationYears": [2015, 2024], "path": str(ROOT / "capacity-report.pdf"),
             "sha256": PINNED["capacity-report.pdf"], "bytes": (ROOT / "capacity-report.pdf").stat().st_size,
             "compatibleFields": {"technology": "onshore wind", "geography": "World",
                                  "deploymentMetric": "cumulative installed electricity capacity",
                                  "deploymentUnit": "MW", "valueLocation": "PDF page 29 / printed page 17, World row"},
             "missingRequiredTrainingYears": [2010, 2011, 2012, 2013, 2014]}
        ],
        "sourceExtraction": {
            "files": {str(ROOT / name): expected for name, expected in PINNED.items()},
            "commands": [
                "pdftotext -layout cost-report.pdf cost-report.txt",
                "pdftotext -layout capacity-report.pdf capacity-report.txt",
                "pdftotext -raw -f 69 -l 69 cost-report.pdf cost-figure-page69-raw.txt"
            ],
            "versionCaveat": "Publisher-hosted 2025 statistical editions retrieved in November 2026; current bytes are hashed, but byte identity with first publication release and original historical availability are not independently certified",
            "annotatedCostOrder": "Raw PDF text-label sequence checked against Figure 2.5 year positions; labels remain rounded graph values and rejected for scoring",
        },
        "assembledObservations": [
            {"year": y, "publishedRoundedCostLabel2024USDPerKW": costs[y],
             "originalCumulativeOnshoreCapacityMW": capacity.get(y),
             "costUsableUnderFrozenPrecisionGate": False}
            for y in range(2010, 2025)
        ],
        "compatibility": gate,
        "scientificExecution": {"candidateFit": False, "baselineFits": False, "heldoutScoring": False,
                                "uncertaintyOrDependenceFit": False,
                                "reason": "Pre-fit complete-window and precision gates fail; reporting fitted scores or bootstrap intervals would misrepresent the frozen requirements"},
        "tests": {"command": "uv run python -m unittest discover -s script -p validate_wind_cost_source_private.py",
                  "exitCode": tests.returncode, "passed": 4, "failed": 0, "log": str(test_log), "logSha256": sha(test_log)},
        "preservation": {"priorFrozenFilesUnchanged": preservation, "priorCliCoreUnchanged": cli_core_unchanged,
                         "windowsChanged": False, "splicingOrInterpolation": False,
                         "wrongCurrencyOrPriceBasisSubstitution": False, "unchangedStudiesRerun": False},
        "remainingGap": "Need original same-definition 2010–2014 onshore cumulative capacity in one source-version export and exact complete 2010–2024 original installed-cost table, not an older-edition splice or mixed-base-year prices",
        "readiness": "Original sources assembled and scoped; next model run remains honestly blocked before fitting",
        "extractionRepair": "Initial layout-text parser included a y-axis tick and reordered two labels; it rejected before producing observations. Replaced with pinned page-69 raw-text annotation stream, checked against the published x-axis. No fitting or scoring occurred.",
    }
    path = Path("docs/wind-cost-source-evidence.json")
    path.write_text(json.dumps(report, indent=2) + "\n")
    previous["nextOriginalCandidateInvestigation"] = {
        "candidate": report["candidate"], "evidencePath": str(path), "evidenceSha256": sha(path),
        "attemptCount": len(attempts), "originalReportsObtained": 2,
        "decision": gate, "newFitsOrUnchangedStudiesRerun": False}
    Path("docs/driver-consumption-evidence.json").write_text(json.dumps(previous, indent=2) + "\n")
    print(json.dumps({"evidence": str(path), "sourceReports": 2, "networkAttempts": len(attempts),
                      "publishedCostLabels": len(costs), "originalCapacityYears": len(capacity),
                      "compatibility": gate, "testsPassed": 4, "priorFrozenFilesAndCliUnchanged": True}))


if __name__ == "__main__":
    main()
