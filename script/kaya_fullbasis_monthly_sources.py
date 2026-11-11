"""Bounded public primary retrieval; separately versioned full-window GDP sources.

Standalone research only. Acquisition and offline assembly are separate commands.
Every attempted source is saved before proceeding. No models or scores are run.
"""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
from html import unescape
import json
from pathlib import Path
import re
import subprocess

from kaya_highfrequency_source_bridge import EU27


ROOT = Path("generated-artifacts/kaya-fullbasis-monthly")
PLAN = Path("docs/kaya-fullbasis-monthly-source-plan.json")
COUNTRIES = EU27 + ("CHN", "IND", "USA", "WLD")
YEARS = tuple(range(2010, 2025))
GDP = "NY.GDP.MKTP.PP.KD"
POP = "SP.POP.TOTL"
ENTITIES = ("World", "China", "India", "United States", "European Union (27)",
            "Rest of World", "International transport")
REGION_ISO = {"World": "WLD", "China": "CHN", "India": "IND", "United States": "USA"}
RETAINED = Path("generated-artifacts/kaya-highfrequency-source/source-assembly-result.json")
RETAINED_SHA = "e6475e2438acbc3d20a598acf1ce3380be4facd27324f5ffdff06a47710d5e59"
FROZEN = Path("generated-artifacts/driver-calibration/kaya-co2.csv")
FROZEN_SHA = "7f78e2b218ce4bb8c538bbec04fdc9a7982e8d40bff972e650df603899edd5f6"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save(path, obj):
    path.write_text(json.dumps(obj, indent=2, allow_nan=False) + "\n")


def acquire_followup():
    manifest_path = ROOT / "requests.json"
    report = json.loads(manifest_path.read_text())
    followup = Path("docs/kaya-fullbasis-monthly-followup-plan.json")
    if len(report["requests"]) != 9 or "followupPlan" in report:
        raise ValueError("Exactly the initial9 requests required; no follow-up retries")
    report.update(followupPlan=str(followup), followupPlanSHA256=sha(followup))
    save(manifest_path, report)
    sources = [
        ("wdi-pop-definitions", "https://databank.worldbank.org/metadataglossary/world-development-indicators/series/" + POP, None),
        ("cm-2026-public-supplement", "https://static-content.springer.com/esm/art%3A10.1038%2Fs43017-026-00780-4/MediaObjects/43017_2026_780_MOESM1_ESM.pdf", None),
        ("figshare-title-search", "https://api.figshare.com/v2/articles/search",
         {"search_for": "Carbon Monitor", "order": "published_date", "order_direction": "desc", "limit": 10}),
    ]
    for name, url, payload in sources:
        body, headers = ROOT / (name + ".body"), ROOT / (name + ".headers")
        command = ["curl", "--max-time", "45", "--max-filesize", "20000000",
                   "--max-redirs", "5", "-L", "-sS", "-D", str(headers),
                   "-o", str(body), "-w", "%{http_code}\\n%{url_effective}\\n"]
        if payload:
            command += ["-H", "Content-Type: application/json", "--data", json.dumps(payload)]
        start = datetime.now(timezone.utc).isoformat()
        result = subprocess.run(command + [url], capture_output=True, text=True, timeout=50)
        status = result.stdout.splitlines()
        report["requests"].append({
            "name": name, "url": url, "method": "POST" if payload else "GET", "requestBody": payload,
            "retrievalStartedUTC": start, "retrievalFinishedUTC": datetime.now(timezone.utc).isoformat(),
            "curlExit": result.returncode, "status": status[0] if status else None,
            "effectiveURL": status[1] if len(status) > 1 else None,
            "stderr": result.stderr, "body": str(body) if body.exists() else None,
            "bodySHA256": sha(body) if body.exists() else None,
            "headers": str(headers) if headers.exists() else None,
            "headersSHA256": sha(headers) if headers.exists() else None,
            "bytes": body.stat().st_size if body.exists() else None,
        })
        save(manifest_path, report)
        print(name, status, result.returncode, flush=True)


def acquire_monthly_primary(archive=False):
    manifest_path = ROOT / "requests.json"
    report = json.loads(manifest_path.read_text())
    plan = Path("docs/monthly-co2-last-source-route.json")
    expected = 13 if archive else 12
    if len(report["requests"]) != expected:
        raise ValueError(f"Expected{expected} prior requests; no retries")
    report.update(lastRoutePlan=str(plan), lastRoutePlanSHA256=sha(plan))
    name, url = ("climate-trace-archive", "https://zenodo.org/records/19952746") if archive else (
        "climate-trace-data", "https://climatetrace.org/data")
    if archive and f'href="{url}"' not in (ROOT / "climate-trace-data.body").read_text():
        raise ValueError("Archive URL must be an explicit primary-publisher public link")
    body, headers = ROOT / (name + ".body"), ROOT / (name + ".headers")
    start = datetime.now(timezone.utc).isoformat()
    result = subprocess.run([
        "curl", "--max-time", "45", "--max-filesize", "20000000", "--max-redirs", "5",
        "-L", "-sS", "-D", str(headers), "-o", str(body), "-w",
        "%{http_code}\\n%{url_effective}\\n", url
    ], capture_output=True, text=True, timeout=50)
    status = result.stdout.splitlines()
    report["requests"].append({
        "name": name, "url": url, "retrievalStartedUTC": start,
        "retrievalFinishedUTC": datetime.now(timezone.utc).isoformat(),
        "curlExit": result.returncode, "status": status[0] if status else None,
        "effectiveURL": status[1] if len(status) > 1 else None, "stderr": result.stderr,
        "body": str(body) if body.exists() else None, "bodySHA256": sha(body) if body.exists() else None,
        "headers": str(headers) if headers.exists() else None,
        "headersSHA256": sha(headers) if headers.exists() else None,
        "bytes": body.stat().st_size if body.exists() else None,
    })
    save(manifest_path, report)
    print(name, status, result.returncode)


def acquire():
    ROOT.mkdir(parents=True, exist_ok=True)
    manifest_path = ROOT / "requests.json"
    if manifest_path.exists():
        raise ValueError("Existing acquisition manifest: no retries or overwrite")
    common = f"date=2010:2024&source=2&format=json&per_page=20000"
    base = "https://api.worldbank.org/v2/country/" + ";".join(COUNTRIES) + "/indicator/"
    sources = [
        ("wdi-gdp-definitions", "https://databank.worldbank.org/metadataglossary/world-development-indicators/series/" + GDP),
        ("wdi-pop-metadata", "https://api.worldbank.org/v2/indicator/" + POP + "?source=2&format=json"),
        ("wdi-terms", "https://www.worldbank.org/en/about/legal/terms-of-use-for-datasets"),
        ("wdi-gdp", base + GDP + "?" + common),
        ("wdi-pop", base + POP + "?" + common),
        ("cm-2025-report", "https://zhudeng.top/files/COP_CM_2025_report.pdf"),
        ("cm-2024-doi", "https://doi.org/10.1038/s43017-024-00532-2"),
        ("cm-2025-doi", "https://doi.org/10.1038/s43017-025-00658-x"),
        ("cm-2026-doi", "https://doi.org/10.1038/s43017-026-00780-4"),
    ]
    report = {"plan": str(PLAN), "planSHA256": sha(PLAN), "requests": []}
    save(manifest_path, report)
    for name, url in sources:
        body, headers = ROOT / (name + ".body"), ROOT / (name + ".headers")
        start = datetime.now(timezone.utc).isoformat()
        result = subprocess.run([
            "curl", "--max-time", "45", "--max-filesize", "20000000",
            "--max-redirs", "5", "-L", "-sS", "-D", str(headers),
            "-o", str(body), "-w", "%{http_code}\\n%{url_effective}\\n", url
        ], capture_output=True, text=True, timeout=50)
        status = result.stdout.splitlines()
        report["requests"].append({
            "name": name, "url": url, "retrievalStartedUTC": start,
            "retrievalFinishedUTC": datetime.now(timezone.utc).isoformat(),
            "curlExit": result.returncode, "status": status[0] if status else None,
            "effectiveURL": status[1] if len(status) > 1 else None,
            "stderr": result.stderr,
            "body": str(body) if body.exists() else None,
            "bodySHA256": sha(body) if body.exists() else None,
            "headers": str(headers) if headers.exists() else None,
            "headersSHA256": sha(headers) if headers.exists() else None,
            "bytes": body.stat().st_size if body.exists() else None,
        })
        save(manifest_path, report)
        print(name, status, result.returncode, flush=True)


def parse_wdi(payload, indicator, countries=COUNTRIES, years=YEARS):
    """No implicit pagination, null filling, source changes or duplicate cells."""
    import math
    if not isinstance(payload, list) or len(payload) != 2:
        raise ValueError("Expected WDI metadata and observations")
    meta, rows = payload
    if int(meta["pages"]) != 1 or len(rows) != int(meta["total"]):
        raise ValueError("Incomplete source pagination")
    if str(meta.get("sourceid")) != "2" or not meta.get("lastupdated"):
        raise ValueError("Explicit WDI source2 and release lastupdated required")
    indexed = {}
    for n, row in enumerate(rows, 1):
        key = (row["countryiso3code"], int(row["date"]))
        if row["indicator"]["id"] != indicator or key[0] not in countries or key[1] not in years:
            raise ValueError("Unexpected series, region or period")
        if key in indexed:
            raise ValueError("Duplicate country-year")
        value = row["value"]
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float))
                                  or not math.isfinite(value) or value <= 0):
            raise ValueError("Nonpositive/nonfinite source cell")
        indexed[key] = {"value": value, "sourceRow": n, "sourceCountry": row["country"]["value"],
                        "decimal": row.get("decimal"), "obsStatus": row.get("obs_status")}
    cells = [{"country": c, "year": y, **indexed.get((c, y), {"value": None, "sourceRow": None})}
             for c in countries for y in years]
    return {"sourceMetadata": meta, "cells": cells,
            "missingCells": [{"country": c["country"], "year": c["year"]} for c in cells if c["value"] is None]}


def aggregate_complete(cells, members):
    if len(members) != len(set(members)):
        raise ValueError("Duplicate fixed membership")
    lookup = {(c["country"], c["year"]): c["value"] for c in cells}
    if len(lookup) != len(cells):
        raise ValueError("Duplicate aggregation cells")
    return [{"year": y, "value": None if any(lookup.get((m, y)) is None for m in members)
             else sum(lookup[(m, y)] for m in members)} for y in YEARS]


def admit_contract(gdp, pop, *, basis, energy, carbon, boundaries, vintage,
                   missing_regional_cells):
    """A complete GDP sidecar is not an authorization to run the frozen holdout."""
    failures = []
    if basis != "MPD2023-2011-international-PPP":
        failures.append("GDP-basis-not-original-MPD2023-2011-international-PPP")
    for name, data in (("GDP", gdp), ("population", pop)):
        if data["missingCells"]:
            failures.append(name + "-missing-cells")
    if missing_regional_cells:
        failures.append("original-seven-regional-accounts-incomplete")
    for name, state in (("primary-energy", energy), ("fossil-industrial-CO2", carbon),
                        ("joint-territorial-and-bunker-boundaries", boundaries)):
        if state != "qualified":
            failures.append(name + "-" + state)
    if vintage not in ("revised-history-explicit", "certified-original-release"):
        failures.append("unqualified-vintage")
    return {"originalFrozenContractAdmitted": not failures, "failedGates": failures,
            "forecastExecuted": False, "centralEligible": False}


def visible_text(source):
    source = re.sub(r"<script\b[^>]*>.*?</script>", "", source, flags=re.S | re.I)
    source = re.sub(r"<style\b[^>]*>.*?</style>", "", source, flags=re.S | re.I)
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", source))).strip()


def archive_inventory(source):
    """Publicly rendered record metadata only, no endpoints or files fetched."""
    match = re.search(r'id="recordVersions"\s+data-record=\'(.*?)\'', source, re.S)
    if not match:
        raise ValueError("Explicit Zenodo record metadata absent")
    record = json.loads(unescape(match.group(1)))
    metadata = record["metadata"]
    if (metadata["title"] != "Climate TRACE Emissions Inventory"
            or record["id"] != "19952746"
            or metadata["version"] != "V5.5.0"
            or not any(r["id"] == "cc-by-4.0" for r in metadata["rights"])):
        raise ValueError("Archive identity/version/rights mismatch")
    files = []
    for name, entry in sorted(record["files"]["entries"].items()):
        if entry["size"] > 20000000:
            decision = "unattempted-file-exceeds-frozen20MB-cap"
        elif name == "fluorinated_gases.zip":
            decision = "unattempted-inapplicable-fluorinated-gases-not-CO2"
        else:
            decision = "unattempted-gas-and-monthly-schema-not-yet-verified"
        files.append({"name": name, "bytes": entry["size"],
                      "publisherChecksum": entry["checksum"],
                      "explicitContentLink": entry["links"]["content"], "decision": decision})
    return {"DOI": record["pids"]["doi"]["identifier"], "version": metadata["version"],
            "versionIndex": record["versions"]["index"], "isLatest": record["versions"]["is_latest"],
            "publisherClaimedReleaseDate": metadata["publication_date"],
            "repositoryCreated": record["created"], "repositoryUpdated": record["updated"],
            "license": "CC-BY-4.0", "files": files,
            "dateDecision": "Claimed2026-03-26 release and2026-05-01 repository creation are distinct. Neither proves archive bytes publicly available at a March forecast origin.",
            "descriptionVersionAmbiguity": "Description mentions database5.6.0 and February2026 while record version isV5.5.0; do not infer native monthly cutoff or exact file vintage from that description.",
            "nativeMonthlyCutoff": "unverified-content-files-unattempted",
            "monthlyCO2RowsAcquired": 0,
            "scopeDecision": "GHG/air-pollutant source inventory,not automatically fossil/industrial CO2. Need gas-specific columns,source-year-sector exclusions,territory,bunkers and monthly resolution before a fossil CO2 total.",
            "older2024And2025ReleaseVersions": "unattempted-no-version-list-request-within14-request-budget"}


def regional_assembly(gdp, pop):
    g = {(c["country"], c["year"]): c["value"] for c in gdp["cells"]}
    p = {(c["country"], c["year"]): c["value"] for c in pop["cells"]}
    eu_g = {c["year"]: c["value"] for c in aggregate_complete(gdp["cells"], EU27)}
    eu_p = {c["year"]: c["value"] for c in aggregate_complete(pop["cells"], EU27)}
    result = []
    for entity in ENTITIES:
        for year in YEARS:
            if entity in REGION_ISO:
                iso = REGION_ISO[entity]
                gv, pv = g[(iso, year)], p[(iso, year)]
                status = "source-native-national-or-world-account"
            elif entity == "European Union (27)":
                gv, pv = eu_g[year], eu_p[year]
                status = "fixed27-complete-member-sum"
            else:
                gv, pv = None, None
                status = ("unattempted-source-qualified-disjoint-partition" if entity == "Rest of World"
                          else "unavailable-source-defined-population-and-GDP-account")
            result.append({"entity": entity, "year": year, "GDP2021InternationalDollars": gv,
                           "populationPeopleMidyear": pv, "accountStatus": status})
    return result


def frozen_identity_map(rows):
    """World has blank ISO in frozen CSV: match its label,not all blank-ISO aggregates."""
    indexed = {}
    for row in rows:
        iso = "WLD" if row["country"] == "World" else row["iso_code"]
        if not iso or iso not in COUNTRIES:
            continue
        key = (iso, int(row["year"]))
        if key in indexed:
            raise ValueError("Ambiguous frozen source country-year identity")
        indexed[key] = row
    return indexed


def admit_monthly_rows(rows, release):
    """Dependency-ready explicit CO2 contract; never fabricate missing observations."""
    import calendar
    import math
    from datetime import date
    needed = {"identityVerified", "rightsVerified", "originalVersionVerified",
              "publisherReleaseDate", "version", "gas", "units", "frequency",
              "scope", "regionBoundary", "historyBasis", "sourceSHA256",
              "methodsSHA256", "publisherURL", "observationCutoff"}
    if needed - release.keys():
        raise ValueError("Missing explicit release qualification fields")
    if not all(release[k] is True for k in ("identityVerified", "rightsVerified", "originalVersionVerified")):
        raise ValueError("Release identity/rights/version not verified")
    published = date.fromisoformat(release["publisherReleaseDate"])
    cutoff = date.fromisoformat(release["observationCutoff"])
    if cutoff > published or not release["publisherURL"].startswith("https://"):
        raise ValueError("Outcome cutoff and public source identity required")
    if any(not re.fullmatch(r"[0-9a-f]{64}", release[k]) for k in ("sourceSHA256", "methodsSHA256")):
        raise ValueError("Exact source and method SHA256 required")
    if release["gas"] != "CO2" or release["units"] != "tonnes CO2 per period":
        raise ValueError("Separate CO2 mass per observation period required,not CO2e or annual mean daily rate")
    if release["frequency"] not in ("monthly", "daily") or not release["scope"] or not release["regionBoundary"]:
        raise ValueError("Explicit monthly/daily frequency,scope and region boundary required")
    if release["historyBasis"] not in ("dated-original-release", "explicit-revised-history"):
        raise ValueError("No original-origin claim from a latest download")
    keys = set()
    admitted = []
    for row in rows:
        start, end = date.fromisoformat(row["start"]), date.fromisoformat(row["end"])
        value = row["CO2"]
        key = (row["region"], row["sector"], row["start"], row["end"])
        if (key in keys or not row["region"] or not row["sector"] or end < start or end > cutoff
                or row.get("periodStatus") not in ("retrospective-estimate", "provisional-estimate", "observed")
                or isinstance(value, bool) or not isinstance(value, (int, float))
                or not math.isfinite(value) or value < 0):
            raise ValueError("Duplicate,invalid or nonfinite emissions cell")
        if release["frequency"] == "daily" and start != end:
            raise ValueError("Daily row must cover exactly one day")
        if release["frequency"] == "monthly" and not (
                start.day == 1 and (start.year, start.month) == (end.year, end.month)
                and end.day == calendar.monthrange(start.year, start.month)[1]):
            raise ValueError("Monthly row must be an exact full calendar month")
        keys.add(key)
        admitted.append(dict(row))
    if not admitted:
        raise ValueError("No monthly/daily numeric source rows acquired")
    return {"release": release, "rows": admitted, "forecastExecuted": False,
            "originalHistoricalOriginAvailabilityCertified": False}


def assemble():
    manifest_path = ROOT / "requests.json"
    manifest = json.loads(manifest_path.read_text())
    for field in ("plan", "followupPlan", "lastRoutePlan"):
        if sha(manifest[field]) != manifest[field + "SHA256"]:
            raise ValueError("Frozen acquisition plan changed")
    if len(manifest["requests"]) > 14:
        raise ValueError("Bounded request budget exceeded")
    for request in manifest["requests"]:
        for field in ("body", "headers"):
            if request[field] and sha(request[field]) != request[field + "SHA256"]:
                raise ValueError("Retained source changed")
    if sha(RETAINED) != RETAINED_SHA or sha(FROZEN) != FROZEN_SHA:
        raise ValueError("Retained original source assembly changed")
    original = json.loads(RETAINED.read_text())
    if len(original["EU27"]["missingMemberYears"]) != 54:
        raise ValueError("Original54 missing member-years must be preserved")
    acquired = {r["name"]: r for r in manifest["requests"]}
    def source(name):
        r = acquired[name]
        if r["status"] != "200" or r["curlExit"] != 0:
            raise ValueError("Explicit source retrieval failure: " + name)
        return Path(r["body"]).read_text()
    gd = visible_text(source("wdi-gdp-definitions"))
    pd = visible_text(source("wdi-pop-definitions"))
    if ("GDP, PPP (constant 2021 international $)" not in gd or "CC BY-4.0" not in gd
            or "midyear" not in pd or "CC BY-4.0" not in pd):
        raise ValueError("Source-specific units or rights not proven")
    gdp = parse_wdi(json.loads(source("wdi-gdp")), GDP)
    pop = parse_wdi(json.loads(source("wdi-pop")), POP)
    if gdp["sourceMetadata"]["lastupdated"] != pop["sourceMetadata"]["lastupdated"]:
        raise ValueError("Different WDI source revision dates; no joint vintage assertion")
    regions = regional_assembly(gdp, pop)
    missing_regions = [{"entity": r["entity"], "year": r["year"], "fields": ["GDP", "population"],
                        "status": r["accountStatus"]}
                       for r in regions if r["GDP2021InternationalDollars"] is None]
    eu = {r["year"]: r for r in regions if r["entity"] == "European Union (27)"}
    unlike_gdp = []
    for r in original["EU27"]["annual"]:
        if r["GDP2011InternationalDollars"] is not None:
            new = eu[r["year"]]["GDP2021InternationalDollars"]
            old = r["GDP2011InternationalDollars"]
            unlike_gdp.append({"year": r["year"], "WDI2021PPP": new, "MPD2011PPP": old,
                               "unlikeUnitNumericDifference": new - old,
                               "unlikeUnitNumericRatio": new / old,
                               "conversionOrSubstitutionAuthorized": False})
    with FROZEN.open(newline="") as f:
        frozen = frozen_identity_map(csv.DictReader(f))
    frozen_pairs = []
    for r in gdp["cells"]:
        old = frozen.get((r["country"], r["year"]), {}).get("gdp")
        if old:
            frozen_pairs.append({"country": r["country"], "year": r["year"],
                                 "WDI2021PPP": r["value"], "frozenGDP2011PPP": float(old),
                                 "unlikeUnitNumericRatio": r["value"] / float(old),
                                 "comparisonMeaning": "Unlike PPP benchmarks and sources,not a deflator or validation residual"})
    population_pairs = []
    for r in pop["cells"]:
        old = frozen.get((r["country"], r["year"]), {}).get("population")
        if old:
            old = float(old)
            population_pairs.append({"country": r["country"], "year": r["year"],
                                     "WDIpopulation": r["value"], "frozenPopulation": old,
                                     "differencePeople": r["value"] - old,
                                     "relativeDifference": (r["value"] - old) / old})
    admission = admit_contract(gdp, pop, basis="WDI-source2-2021-international-PPP",
                               energy="unattempted-joint-version-qualification",
                               carbon="unattempted-joint-version-qualification",
                               boundaries="unattempted-source-specific-reconciliation",
                               vintage="revised-history-explicit", missing_regional_cells=missing_regions)
    archive = archive_inventory(source("climate-trace-archive"))
    search = json.loads(source("figshare-title-search"))
    if any("carbon monitor" in a["title"].lower() for a in search):
        raise ValueError("New exact dataset title requires identity review before classification")
    report_text = ROOT / "cm-2025-report.txt"
    supplement_text = ROOT / "cm-2026-public-supplement.txt"
    report = report_text.read_text()
    supplement = supplement_text.read_text()
    for quote in ("Published on November 18th, 2025. (Version 1.5)",
                  "released by Carbon Monitor on November 1, 2025.",
                  "175,015 daily CO2 emission records"):
        if quote not in report:
            raise ValueError("Original report version/scope wording changed")
    if "Comparison of annual emission changes in 2025" not in supplement:
        raise ValueError("Supplement table frequency identity changed")
    result = {
        "assembledAtUTC": datetime.now(timezone.utc).isoformat(),
        "methodModule": __file__, "methodSHA256": sha(__file__),
        "dependencySHA256": sha("script/kaya_highfrequency_source_bridge.py"),
        "requestManifest": str(manifest_path), "requestManifestSHA256": sha(manifest_path),
        "originalSourceAssemblySHA256": RETAINED_SHA, "originalFrozenGDPBasisChanged": False,
        "preservedOriginalMPDEU27Missing54": original["EU27"]["missingMemberYears"],
        "alternativeBasis": "WDI source2 constant2021 international PPP dollars,complete2010-2024 revised history; NOT original2011PPP",
        "sourceIdentityReconciliation": {
            "World": "WDI native WLD maps only to frozen country label World with blank ISO; no generic blank-ISO aggregation",
            "EU27": "Exact fixed27 ISO3 complete member sum,not a time-varying WDI regional aggregate",
            "otherCountries": "Exact ISO3 membership,not name-fuzzy matching",
            "population": "WDI midyear de-facto resident population,new source-native values; frozen population differences retained,not substituted"
        },
        "GDP": gdp, "population": pop, "regionalAnnualCells": regions,
        "missingOriginalRegionalAccountYears": missing_regions,
        "EU27GDPUnlikeBasisComparisons": unlike_gdp,
        "countryGDPUnlikeBasisComparisons": frozen_pairs,
        "populationRevisionComparisons": population_pairs,
        "originalContractAdmission": admission,
        "alternativeContractAdmission": {
            "admitted": False, "completeGDPAndPopulationAccounts": list(ENTITIES[:5]),
            "missingAccountYears": missing_regions,
            "primaryEnergyNativeDefinition": "unattempted-independent-joint-revision-qualification; existing frozen energy not automatically ported",
            "fossilIndustrialCO2NativeDefinition": "unattempted-independent-joint-revision-qualification; not totalGHG,CO2e or LULUCF",
            "PPPReconciliation": "unavailable-identity-conversion; different2021/2011PPP not interchangeable",
            "temporalAvailability": "revised-history2026-10-08 only,not origin-vintage",
            "territoryAndBunkers": "unattempted-independent-cross-series-reconciliation",
            "forecastExecuted": False
        },
        "originalCO2ReleaseEvidence": {
            "CM2025": {"reportVersion": "1.5", "reportPublished": "2025-11-18",
                       "authorLandingNewsDate": "2025-11-10", "reportedDatasetRelease": "2025-11-01",
                       "reportedDailyRecords": 175015, "reportedDailyCoverage": ["2019-01-01", "2025-09-30"],
                       "reportedSectors": 7, "reportedRegionalBreakdowns": 9,
                       "scope": "fossil combustion and industrial processes,IPCC2006 categories1 and2",
                       "bunkers": "Report page7 includes international bunkers in global total and ROW",
                       "actualDailyOrMonthlyNumericRowsAcquired": 0,
                       "why": "Daily curves/monthly averages displayed as figures; numerical summary tables are annual averages or annual projections,not dated daily/monthly rows. No graph digitization.",
                       "dateDecision": "Report own publication,website news and stated dataset dates differ. No claim that retained report bytes were available on earlier news or dataset dates.",
                       "dailyFileDownload": "unattempted-no-original-version-specific-file-link; latest endpoint intentionally not fetched"},
            "CM2026Supplement": {"DOI": "10.1038/s43017-026-00780-4",
                                  "table": "Supplementary Table1", "frequency": "annual2025 growth",
                                  "dailyDataUnderlyingPeriod": ["2019-01-01", "2025-12-31"],
                                  "climateTraceMention": "monthly estimates2-3months lag,data accessed2026-03-03",
                                  "actualDailyOrMonthlyNumericRowsAcquired": 0,
                                  "mainPaywalledPDFs": "unattempted-no-subscription-purchase-or-bypass"},
            "figshareSearch": {"returnedTitles": [a["title"] for a in search],
                               "matchingCarbonMonitorIdentity": False,
                               "decision": "Broad carbon-related search results are not evidence dataset unavailable; no candidate identity qualified,no file requested"},
            "climateTraceArchive": archive,
            "original2024MonthlyDailyCO2Rows": "not-acquired; earlier-source-version-list-and-files-unattempted",
            "original2025MonthlyDailyCO2Rows": "not-acquired; report-date-metadata-retained,but-original-daily-file-link-unavailable-on-inspected-report",
            "original2026MonthlyDailyCO2Rows": "not-acquired; source-qualified-release-archive-found,but-CO2-relevant-files-over-cap-and-unattempted",
            "monthlyDailyAdmission": "blocked-no-original-numerical-rows; dated report metadata is not a substitute",
            "DESNZQuarterlyPowerUsed": False,
            "textExtractions": [{"path": str(p), "sha256": sha(p), "command": "pdftotext -layout"}
                                for p in (report_text, supplement_text)]
        },
        "networkRequests": len(manifest["requests"]), "maximumRequests": 14, "paidCalls": 0,
        "fits": 0, "holdoutScores": 0, "centralEligible": False
    }
    save(ROOT / "fullbasis-source-result.json", result)
    print(json.dumps({
        "GDPcells": len(gdp["cells"]), "GDPmissing": len(gdp["missingCells"]),
        "populationCells": len(pop["cells"]), "populationMissing": len(pop["missingCells"]),
        "completeRegionalGDPAndPopulationYearPairs": len(regions) - len(missing_regions),
        "missingRegionalAccountYears": len(missing_regions),
        "unlikeBasisEUGDPComparisons": len(unlike_gdp), "unlikeBasisCountryGDPComparisons": len(frozen_pairs),
        "populationRevisionComparisons": len(population_pairs), "originalContractAdmission": admission,
        "originalDailyMonthlyCO2Rows": 0, "resultSHA256": sha(ROOT / "fullbasis-source-result.json")
    }, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["acquire", "followup", "monthly-primary", "monthly-archive", "assemble"])
    args = parser.parse_args()
    if args.command == "acquire":
        acquire()
    if args.command == "followup":
        acquire_followup()
    if args.command == "monthly-primary":
        acquire_monthly_primary()
    if args.command == "monthly-archive":
        acquire_monthly_primary(archive=True)
    if args.command == "assemble":
        assemble()
