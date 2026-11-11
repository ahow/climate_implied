"""Bounded original Climate TRACE archive acquisition and monthly CO2 source bridge.

No forecast, synthetic observation, currency conversion or aggregate attribution.
"""
import argparse
import calendar
from collections import Counter, defaultdict
import csv
from datetime import date, datetime, timezone
from decimal import Decimal, localcontext
import hashlib
import io
import json
import math
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import zipfile


ROOT = Path("generated-artifacts/climatetrace-monthly-100mb")
PLAN = Path("docs/climatetrace-monthly-100mb-acquisition-plan.json")
PREVIOUS = Path("generated-artifacts/kaya-fullbasis-monthly/fullbasis-source-result.json")
PREVIOUS_SHA = "41aadd845ac749535e16a93bf4ccdb77ed4ab78ae544af285ce404acb2087120"
ARCHIVE_URL = "https://zenodo.org/api/records/19952746/files/mineral_extraction.zip/content"
ARCHIVE_SIZE = 30380440
ARCHIVE_MD5 = "16f2bcdacd40163db3496ce9a5c4dae9"
SUBSECTORS = ("bauxite-mining", "copper-mining", "iron-mining")
NATIVE_GUIDE_SHA = "e07dd3b20a14c7f4a6694996c1d037bf9bb11b059e40b8ecf1c80c77ba3184e7"
SCHEMA_SHA = "f88612ba3755e826d7efbbdb1bde318246489be0d691e3a4d0cce2172230cb6d"
SPEC_SHA = "46b7ec3693da769e057e6a758c9c99c0f974e3cfcf1ee56127381c13d49e1489"


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save(path, obj):
    path.write_text(json.dumps(obj, indent=2, allow_nan=False) + "\n")


def request(manifest, name, url, cap):
    if len(manifest["requests"]) >= 6 or any(r["name"] == name for r in manifest["requests"]):
        raise ValueError("Bounded6-request budget or no-retry rule")
    consumed = sum(r.get("bytes", 0) or 0 for r in manifest["requests"])
    if consumed + cap > 149000000:
        raise ValueError("Bounded total body budget would be exceeded")
    body, headers = ROOT / (name + ".body"), ROOT / (name + ".headers")
    started = datetime.now(timezone.utc).isoformat()
    result = subprocess.run([
        "curl", "--max-time", "90", "--max-filesize", str(cap), "--max-redirs", "5",
        "-L", "-sS", "-D", str(headers), "-o", str(body),
        "-w", "%{http_code}\\n%{url_effective}\\n", url
    ], capture_output=True, text=True, timeout=95)
    status = result.stdout.splitlines()
    manifest["requests"].append({
        "name": name, "url": url, "maximumBytes": cap, "retrievalStartedUTC": started,
        "retrievalFinishedUTC": datetime.now(timezone.utc).isoformat(),
        "curlExit": result.returncode, "status": status[0] if status else None,
        "effectiveURL": status[1] if len(status) > 1 else None, "stderr": result.stderr,
        "body": str(body) if body.exists() else None, "bodySHA256": sha(body) if body.exists() else None,
        "headers": str(headers) if headers.exists() else None,
        "headersSHA256": sha(headers) if headers.exists() else None,
        "bytes": body.stat().st_size if body.exists() else None,
    })
    save(ROOT / "requests.json", manifest)
    print(name, status, result.returncode, manifest["requests"][-1]["bytes"], flush=True)


def acquire():
    if sha(PREVIOUS) != PREVIOUS_SHA:
        raise ValueError("Original20MB evidence must remain unchanged")
    previous = json.loads(PREVIOUS.read_text())
    source = next(f for f in previous["originalCO2ReleaseEvidence"]["climateTraceArchive"]["files"]
                  if f["name"] == "mineral_extraction.zip")
    if (source["bytes"] != ARCHIVE_SIZE or source["publisherChecksum"] != "md5:" + ARCHIVE_MD5
            or source["explicitContentLink"] != ARCHIVE_URL):
        raise ValueError("Exact original archive identity/size/checksum mismatch")
    ROOT.mkdir(parents=True, exist_ok=True)
    if (ROOT / "requests.json").exists():
        raise ValueError("Existing acquisition:no retries/overwrite")
    manifest = {"plan": str(PLAN), "planSHA256": sha(PLAN), "previousResultSHA256": PREVIOUS_SHA,
                "requests": []}
    save(ROOT / "requests.json", manifest)
    request(manifest, "mineral-extraction-archive", ARCHIVE_URL, 100000000)
    request(manifest, "publisher-data-guide",
            "https://media.climatetrace.org/about_the_data_latest_b6e7b8d419.pdf", 20000000)
    request(manifest, "publisher-api-docs", "https://api.climatetrace.org/v7", 2000000)


def acquire_spec():
    manifest = json.loads((ROOT / "requests.json").read_text())
    if len(manifest["requests"]) != 3 or sha(PLAN) != manifest["planSHA256"]:
        raise ValueError("Exactly3 prior requests and unchanged frozen plan required")
    landing = (ROOT / "publisher-api-docs.body").read_text()
    if not re.search(r"url:\s*'/v7/docs/openapi\.json'", landing):
        raise ValueError("Specification URL must be explicitly documented")
    request(manifest, "publisher-api-spec", "https://api.climatetrace.org/v7/docs/openapi.json", 5000000)


def acquire_documented_query():
    manifest = json.loads((ROOT / "requests.json").read_text())
    plan = Path("docs/climatetrace-monthly-documented-query-freeze.json")
    query_plan = json.loads(plan.read_text())
    if len(manifest["requests"]) != 4 or sha(PLAN) != manifest["planSHA256"]:
        raise ValueError("Exactly4 prior requests and unchanged acquisition plan required")
    spec = ROOT / "publisher-api-spec.body"
    if sha(spec) != query_plan["documentedSpecification"]["SHA256"]:
        raise ValueError("Exact documented public API specification required")
    text = spec.read_text()
    for field in ("/v7/metadata:", "/v7/sources/emissions:", "name: year", "name: gas",
                  "name: sectors", "name: subsectors", "name: gadmId", "Get monthly aggregated emissions"):
        if field not in text:
            raise ValueError("Query field not in source specification: " + field)
    manifest.update(queryPlan=str(plan), queryPlanSHA256=sha(plan))
    save(ROOT / "requests.json", manifest)
    for r in query_plan["sequence"]:
        request(manifest, r["name"], r["URL"], r["maximumBytes"])


class ArchiveBudget:
    """Read named members in memory only,with bounded expansion and native CRC."""
    def __init__(self):
        self.bytes_read = 0
        self.members_checked = 0

    def inspect(self, archive):
        infos = archive.infolist()
        self.members_checked += len(infos)
        if self.members_checked > 2000:
            raise ValueError("Archive member limit exceeded")
        seen = set()
        for entry in infos:
            path = PurePosixPath(entry.filename)
            mode = entry.external_attr >> 16
            if (entry.filename in seen or path.is_absolute() or ".." in path.parts
                    or "\\" in entry.filename or re.match(r"^[A-Za-z]:", entry.filename)
                    or not path.parts or stat.S_ISLNK(mode)
                    or entry.flag_bits & 1):
                raise ValueError("Duplicate,unsafe,symlink or encrypted ZIP member")
            seen.add(entry.filename)
            if entry.file_size and entry.file_size / max(1, entry.compress_size) > 1000:
                raise ValueError("Excessive archive compression ratio")
        return [{"name": e.filename, "uncompressedBytes": e.file_size,
                 "compressedBytes": e.compress_size, "nativeCRC32": f"{e.CRC:08x}"} for e in infos]

    def read(self, archive, name, cap):
        entry = archive.getinfo(name)
        if entry.file_size > cap or self.bytes_read + entry.file_size > 400000000:
            raise ValueError("Selected member or cumulative expansion limit exceeded")
        with archive.open(entry) as stream:
            body = stream.read(cap + 1)
        if len(body) != entry.file_size or len(body) > cap:
            raise ValueError("Incomplete or oversized selected member")
        self.bytes_read += len(body)
        return body


def schema_proof(body):
    """Do not silently collapse the source's duplicated sector/subsector headers."""
    rows = list(csv.reader(io.StringIO(body.decode("utf-8-sig"))))
    header, rows = rows[0], rows[1:]
    duplicates = {h: [i for i, label in enumerate(header) if label == h]
                  for h, count in Counter(header).items() if count > 1}
    selected = []
    all_conflicts = []
    for n, row in enumerate(rows, 2):
        if len(row) != len(header):
            raise ValueError("Ragged native schema CSV")
        conflicts = [h for h, indices in duplicates.items() if len({row[i] for i in indices}) != 1]
        if conflicts:
            all_conflicts.append({"sourceLogicalRow": n, "conflictingColumns": conflicts})
        if row[1] not in SUBSECTORS:
            continue
        if conflicts or row[0] != "mineral-extraction":
            raise ValueError("Selected native subsector schema identity conflict")
        quantity = row[header.index("emissions_quantity")]
        gas = row[header.index("gas")]
        if "metric tonnes" not in quantity or "Carbon Dioxide (CO2)" not in gas:
            raise ValueError("No source-native CO2 mass-unit proof")
        selected.append({"sourceLogicalRow": n, "subsector": row[1],
                         "nativeQuantityDefinition": quantity, "nativeGasDefinition": gas})
    if sorted(r["subsector"] for r in selected) != sorted(SUBSECTORS):
        raise ValueError("Exactly one native unit-proof row per selected subsector required")
    return {"duplicatedHeaderColumnIndicesZeroBased": duplicates, "selectedUnitProofs": selected,
            "unrelatedSchemaRowsWithHeaderValueConflicts": all_conflicts,
            "decision": "Selected rows checked positionally;unrelated duplicate-column conflicts retained,not silently overwritten."}


def csv_records(body):
    text = io.StringIO(body.decode("utf-8-sig"))
    reader = csv.DictReader(text)
    if not reader.fieldnames or len(reader.fieldnames) != len(set(reader.fieldnames)):
        raise ValueError("Missing or duplicated source data CSV headers")
    for n, row in enumerate(reader, 2):
        if None in row or any(v is None for v in row.values()):
            raise ValueError("Ragged source data CSV")
        yield n, row


def qualify_asset_row(row, subsector):
    if (row["gas"] != "co2" or row["sector"] != "mineral-extraction"
            or row["subsector"] != subsector or row["temporal_granularity"] != "month"):
        raise ValueError("Wrong gas,sector,subsector or native monthly frequency")
    start = datetime.strptime(row["start_time"], "%Y-%m-%d %H:%M:%S")
    end = datetime.strptime(row["end_time"], "%Y-%m-%d %H:%M:%S")
    if not (start.time() == end.time() == datetime.min.time() and start.day == 1
            and (start.year, start.month) == (end.year, end.month)
            and end.day == calendar.monthrange(start.year, start.month)[1]):
        raise ValueError("Native dates are not one exact complete calendar month")
    if not re.fullmatch(r"[A-Z]{3}", row["iso3_country"]) or not row["source_id"]:
        raise ValueError("Source-defined country/source identity missing")
    raw = row["emissions_quantity"].strip()
    value = None if raw.lower() in ("", "null", "n/a", "na") else float(raw)
    if value is not None and (not math.isfinite(value) or value < 0):
        raise ValueError("Nonfinite or negative source CO2 mass")
    return {"start": start.date().isoformat(), "end": end.date().isoformat(),
            "month": start.strftime("%Y-%m"), "CO2tonnes": value}


def parse_live_monthly(payload, metadata):
    """Keep the source's over-broad response visible;do not admit its total as3sectors."""
    if (metadata["temporalCoverage"]["frequency"] != "monthly"
            or not metadata["dataVersion"] or not metadata["releaseDate"]):
        raise ValueError("Explicit live release version/coverage required")
    cutoff = metadata["temporalCoverage"]["end"]
    date.fromisoformat(metadata["releaseDate"])
    if payload["location"].get("gadmId") != "USA" or payload["location"].get("country") != "USA":
        raise ValueError("Wrong native country location")
    selected, unexpected, keyed = [], [], {}
    for n, row in enumerate(payload["subsectors"]["timeseries"], 1):
        if row["gas"] != "co2" or row["sector"] != "mineral-extraction" or row["year"] != 2026:
            raise ValueError("Wrong live response gas,sector or year")
        month = row["month"]
        if isinstance(month, bool) or not isinstance(month, int) or not 1 <= month <= 12:
            raise ValueError("Missing/non-calendar native monthly date")
        period = f"{row['year']:04d}-{month:02d}"
        value = row["emissionsQuantity"]
        key = (row["subsector"], period)
        if (key in keyed or period > cutoff or isinstance(value, bool)
                or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0):
            raise ValueError("Duplicate,beyond-cutoff,nonfinite or invalid native live row")
        qualified = {"sourceSubsectorTimeseriesRow": n, "country": "USA",
                     "subsector": row["subsector"], "month": period, "CO2tonnes": value}
        keyed[key] = qualified
        (selected if row["subsector"] in SUBSECTORS else unexpected).append(qualified)
    if not selected:
        raise ValueError("No selected native monthly CO2 rows")
    residuals = []
    total_keys = set()
    for row in payload["totals"]["timeseries"]:
        month, year, value = row["month"], row["year"], row["emissionsQuantity"]
        if (row["gas"] != "co2" or year != 2026 or isinstance(month, bool)
                or not isinstance(month, int) or not 1 <= month <= 12
                or isinstance(value, bool) or not isinstance(value, (float, int))
                or not math.isfinite(value) or value < 0):
            raise ValueError("Invalid source total time identity,gas or value")
        period = f"{year:04d}-{month:02d}"
        if period in total_keys or period > cutoff:
            raise ValueError("Duplicate or beyond-cutoff source total")
        total_keys.add(period)
        chosen = [r["CO2tonnes"] for r in selected if r["month"] == period]
        other = [r["CO2tonnes"] for r in unexpected if r["month"] == period]
        if len(chosen) != len(SUBSECTORS):
            raise ValueError("Incomplete selected subsector panel")
        selected_sum, other_sum = math.fsum(chosen), math.fsum(other)
        residuals.append({"month": period, "publisherResponseTotal": value,
                          "explicitSelectedThreeSubsectorSum": selected_sum,
                          "unrequestedSubsectorSum": other_sum,
                          "publisherTotalMinusSelected": value - selected_sum,
                          "publisherTotalMinusAllNativeSubsectors": value - math.fsum(chosen + other)})
    if {r["month"] for r in selected} != total_keys:
        raise ValueError("Native total/subsector period mismatch")
    return {"sourceReleaseMetadata": metadata, "location": payload["location"],
            "selectedNativeSubsectorMonthlyRows": selected,
            "unrequestedNativeSubsectorMonthlyRowsQuarantined": unexpected,
            "requestScopeCompatible": not unexpected,
            "sourceTotalAdmittedAsRequestedThreeSubsectors": not unexpected,
            "monthlyResponseScopeResiduals": residuals,
            "decision": ("Request specified3 subsectors,but source returned additional subsectors. Preserve failed exact-response contract;retain only explicitly typed3-subsector native rows as partial sectoral source evidence,no total relabeling."
                         if unexpected else "Exact3 requested subsectors returned;native row qualification does not authorize historical-origin or all-sector forecast claims."),
            "historyBasis": "current-release-explicit-revised-history,not original historical origin availability",
            "metadataBoundToResponseByDataVersionHeader": False,
            "metadataBindingResidual": "Metadata ETag identifies v5.12.0;numeric response has no version/ETag header. Requests1second apart are not an atomic publication snapshot.",
            "fitEligible": False}


def repeated_native_period_audit(rows):
    """Post-assembly source consistency audit,not a frozen predictive experiment."""
    lookup = {}
    for row in rows:
        year = row["start_time"][:4]
        if year not in ("2024", "2025", "2026"):
            continue
        key = (row["subsector"], row["source_id"], row["iso3_country"],
               row["start_time"][5:7], year)
        if key in lookup:
            raise ValueError("Duplicate trace source-month in identity audit")
        raw = row["emissions_quantity_native"].strip()
        lookup[key] = None if raw.lower() in ("", "null", "n/a", "na") else Decimal(raw)
    results = []
    for later_year, only_month in (("2025", None), ("2026", "01")):
        base = [k for k in lookup if k[-1] == "2024" and (only_month is None or k[-2] == only_month)]
        paired, equal, equal_nonzero, missing = Counter(), Counter(), Counter(), Counter()
        max_abs = defaultdict(lambda: Decimal(0))
        for key in base:
            later = (*key[:-1], later_year)
            subsector = key[0]
            if later not in lookup or lookup[key] is None or lookup[later] is None:
                missing[subsector] += 1
                continue
            paired[subsector] += 1
            with localcontext() as ctx:
                ctx.prec = 100
                delta = lookup[later] - lookup[key]
                max_abs[subsector] = max(max_abs[subsector], abs(delta))
            if delta == 0:
                equal[subsector] += 1
                equal_nonzero[subsector] += lookup[key] != 0
        results.append({
            "comparison": f"same-native-asset-month-2024-versus-{later_year}",
            "monthRestriction": only_month, "pairedCells": sum(paired.values()),
            "exactDecimalEqualCells": sum(equal.values()),
            "exactEqualNonzeroCells": sum(equal_nonzero.values()),
            "missingComparisonCells": sum(missing.values()),
            "maxAbsNativeCO2TonnesDifference": str(max(max_abs.values(), default=Decimal(0))),
            "bySubsector": {s: {"paired": paired[s], "exactEqual": equal[s],
                                "exactEqualNonzero": equal_nonzero[s], "missing": missing[s],
                                "maxAbsNativeCO2TonnesDifference": str(max_abs[s])}
                            for s in sorted({k[0] for k in base})},
            "interpretation": "Exact equality is a source identity,not proof of new independent observed outcomes. Carry-forward/projection mechanism requires publisher-method verification;no interpolation or values generated here.",
            "selectionStatus": "Post-assembly source consistency check triggered by identical native2024/2025 aggregate totals;not a preregistered skill result."
        })
    return results


def assemble():
    manifest_path = ROOT / "requests.json"
    manifest = json.loads(manifest_path.read_text())
    if len(manifest["requests"]) != 6 or sha(PLAN) != manifest["planSHA256"]:
        raise ValueError("Exact bounded6-request acquisition and frozen plan required")
    if sha(manifest["queryPlan"]) != manifest["queryPlanSHA256"] or sha(PREVIOUS) != PREVIOUS_SHA:
        raise ValueError("Query plan or old20MB evidence changed")
    for r in manifest["requests"]:
        if r["status"] != "200" or r["curlExit"] != 0 or r["bytes"] > r["maximumBytes"]:
            raise ValueError("Unqualified source retrieval:" + r["name"])
        for field in ("body", "headers"):
            if sha(r[field]) != r[field + "SHA256"]:
                raise ValueError("Source bytes changed:" + r["name"])
    if sum(r["bytes"] for r in manifest["requests"]) > 149000000:
        raise ValueError("Total acquisition byte budget exceeded")
    archive_path = ROOT / "mineral-extraction-archive.body"
    body = archive_path.read_bytes()
    if len(body) != ARCHIVE_SIZE or hashlib.md5(body).hexdigest() != ARCHIVE_MD5:
        raise ValueError("Native archive size/MD5 mismatch")
    budget = ArchiveBudget()
    with zipfile.ZipFile(io.BytesIO(body)) as outer:
        outer_inventory = budget.inspect(outer)
        nested = budget.read(outer, "co2/mineral_extraction.zip", 100000000)
    member_pins = []
    asset_summaries, country_file_inventory = [], []
    country_groups, global_groups = defaultdict(list), defaultdict(list)
    panel, missing_quantities, source_countries = {}, [], {}
    canonical_months = [f"{year:04d}-{month:02d}" for year in (2024, 2025, 2026) for month in range(1, 13)]
    trace_path = ROOT / "native-monthly-CO2-rows.csv"
    with zipfile.ZipFile(io.BytesIO(nested)) as inner, trace_path.open("w", newline="") as trace:
        inner_inventory = budget.inspect(inner)
        schema_body = budget.read(inner, "ABOUT_THE_DATA/detailed_data_schema_v5_5_0.csv", 5000000)
        guide_body = budget.read(inner, "ABOUT_THE_DATA/about_the_data_v5_5_0.pdf", 5000000)
        if (hashlib.sha256(schema_body).hexdigest() != SCHEMA_SHA
                or hashlib.sha256(guide_body).hexdigest() != NATIVE_GUIDE_SHA):
            raise ValueError("Exact same-version native schema/guide required")
        proof = schema_proof(schema_body)
        (ROOT / "detailed_data_schema_v5_5_0.csv").write_bytes(schema_body)
        (ROOT / "about_the_data_v5_5_0.pdf").write_bytes(guide_body)
        subprocess.run(["pdftotext", "-layout", str(ROOT / "about_the_data_v5_5_0.pdf"),
                        str(ROOT / "about_the_data_v5_5_0.txt")], check=True, timeout=30,
                       capture_output=True, text=True)
        native_guide_text = (ROOT / "about_the_data_v5_5_0.txt").read_text()
        if ("Inventory March 2026 (Version 5.5.0)" not in native_guide_text
                or "Creative Commons Attribution 4.0 International License" not in native_guide_text
                or "Jolleys, M., (2025)" not in native_guide_text):
            raise ValueError("Same-version native guide rights/method citation missing")
        writer = csv.DictWriter(trace, fieldnames=[
            "subsector", "source_id", "iso3_country", "start_time", "end_time", "gas",
            "emissions_quantity_native", "qualified_unit", "temporal_granularity",
            "source_member", "source_logical_row", "created_date", "modified_date"])
        writer.writeheader()
        for info in inner.infolist():
            if "_country_emissions_" not in info.filename:
                continue
            raw = budget.read(inner, info.filename, 200000000)
            records = list(csv_records(raw))
            country_file_inventory.append({
                "member": info.filename, "sha256": hashlib.sha256(raw).hexdigest(), "rows": len(records),
                "frequencyCounts": dict(Counter(r["temporal_granularity"] for _, r in records)),
                "gasCounts": dict(Counter(r["gas"] for _, r in records)),
                "nativeUnitsCounts": dict(Counter(r["emissions_quantity_units"] for _, r in records)),
                "countryCount": len({r["iso3_country"] for _, r in records}),
                "decision": "Actual native country exports are annual;not disaggregated or admitted as monthly."})
        for subsector in SUBSECTORS:
            member = f"DATA/{subsector}_emissions_sources_v5_5_0.csv"
            raw = budget.read(inner, member, 200000000)
            pin = {"member": member, "sha256": hashlib.sha256(raw).hexdigest(),
                   "uncompressedBytes": len(raw), "CRC32": f"{inner.getinfo(member).CRC:08x}"}
            member_pins.append(pin)
            keys, countries, assets, dates, created, modified = set(), set(), set(), [], [], []
            year_counts, year_sums, zero_count = Counter(), defaultdict(list), 0
            for source_row, row in csv_records(raw):
                qualified = qualify_asset_row(row, subsector)
                identity = (subsector, row["source_id"])
                key = (*identity, qualified["month"])
                if key in keys:
                    raise ValueError("Duplicate source/subsector/month native cell")
                keys.add(key)
                if identity in source_countries and source_countries[identity] != row["iso3_country"]:
                    raise ValueError("Source country boundary changes within same version")
                source_countries[identity] = row["iso3_country"]
                panel.setdefault(identity, set()).add(qualified["month"])
                countries.add(row["iso3_country"])
                assets.add(row["source_id"])
                dates.append(qualified["month"])
                created.append(row["created_date"])
                modified.append(row["modified_date"])
                value = qualified["CO2tonnes"]
                if value is None:
                    missing_quantities.append({"subsector": subsector, "source_id": row["source_id"],
                                               "month": qualified["month"], "sourceRow": source_row})
                year = qualified["start"][:4]
                year_counts[year] += 1
                year_sums[year].append(value)
                zero_count += value == 0
                country_groups[(subsector, row["iso3_country"], qualified["month"])].append(value)
                global_groups[(subsector, qualified["month"])].append(value)
                writer.writerow({
                    "subsector": subsector, "source_id": row["source_id"],
                    "iso3_country": row["iso3_country"], "start_time": row["start_time"],
                    "end_time": row["end_time"], "gas": row["gas"],
                    "emissions_quantity_native": row["emissions_quantity"],
                    "qualified_unit": "metric tonnes CO2 per native calendar month",
                    "temporal_granularity": row["temporal_granularity"],
                    "source_member": member, "source_logical_row": source_row,
                    "created_date": row["created_date"], "modified_date": row["modified_date"]})
            asset_summaries.append({
                **pin, "sourceRows": len(keys), "assets": len(assets), "nativeCountries": len(countries),
                "firstMonth": min(dates), "lastMonth": max(dates), "zeroQuantityRows": zero_count,
                "nativeRowCountsByYear": dict(year_counts),
                "listedAssetCO2TonnesByYear": {
                    y: None if any(v is None for v in values) else math.fsum(values)
                    for y, values in sorted(year_sums.items())},
                "createdDateRange": [min(created), max(created)],
                "modifiedDateRange": [min(modified), max(modified)]})
    aggregate = lambda values: None if any(v is None for v in values) else math.fsum(values)
    country_cells = [{"subsector": s, "country": c, "month": m, "listedAssetCount": len(v),
                      "listedAssetCO2Tonnes": aggregate(v), "completeCountryInventoryCertified": False}
                     for (s, c, m), v in sorted(country_groups.items())]
    global_cells = [{"subsector": s, "month": m, "listedAssetCount": len(v),
                     "listedAssetCO2Tonnes": aggregate(v), "allSectorOrAllMiningGlobalTotal": False}
                    for (s, m), v in sorted(global_groups.items())]
    missing_panel = [{"subsector": s, "source_id": source, "country": source_countries[(s, source)],
                      "missing2024To2026Months": [m for m in canonical_months if m not in months]}
                     for (s, source), months in sorted(panel.items())
                     if any(m not in months for m in canonical_months)]
    live_metadata = json.loads((ROOT / "publisher-live-metadata.body").read_text())
    live_payload = json.loads((ROOT / "publisher-USA-monthly-2026.body").read_text())
    subprocess.run(["pdftotext", "-layout", str(ROOT / "publisher-data-guide.body"),
                    str(ROOT / "publisher-data-guide.txt")], check=True, timeout=30,
                   capture_output=True, text=True)
    current_guide_text = (ROOT / "publisher-data-guide.txt").read_text()
    if ("Inventory October 2026 (Version 5.12.0)" not in current_guide_text
            or "Creative Commons Attribution 4.0 International License" not in current_guide_text):
        raise ValueError("Exact current release guide and explicit license required")
    for text in (native_guide_text, current_guide_text):
        exceptions = text.split("Detailed terms of use and licensing information", 1)[1].split(
            "Geographic boundaries", 1)[0].lower()
        if any(name in exceptions for name in ("bauxite", "copper", "iron-mining", "iron mining")):
            raise ValueError("Selected subsector appears in native license exceptions;stop for rights review")
    if sha(ROOT / "publisher-api-spec.body") != SPEC_SHA:
        raise ValueError("Exact public API unit/frequency specification required")
    live = parse_live_monthly(live_payload, live_metadata)
    with trace_path.open(newline="") as trace:
        repetition = repeated_native_period_audit(csv.DictReader(trace))
    result = {
        "assembledAtUTC": datetime.now(timezone.utc).isoformat(),
        "method": __file__, "methodSHA256": sha(__file__),
        "acquisitionManifest": str(manifest_path), "acquisitionManifestSHA256": sha(manifest_path),
        "old20MBEvidenceSHA256Unchanged": PREVIOUS_SHA, "archiveSHA256": sha(archive_path),
        "archiveBytes": len(body), "publisherMD5Verified": ARCHIVE_MD5,
        "nestedCO2ArchiveSHA256": hashlib.sha256(nested).hexdigest(),
        "outerNativeGasArchiveInventory": outer_inventory, "innerCO2NativeMemberInventory": inner_inventory,
        "archiveSafety": {"membersChecked": budget.members_checked, "expandedBytesRead": budget.bytes_read,
                          "allReadMemberCRCsVerified": True, "archivePathExtraction": False,
                          "whitelistedMetadataCopiedToFixedPrivatePaths": True,
                          "allOtherGasArchiveMembers": "unopened;no CO2e conversion",
                          "HTTPRangeRequests": 0},
        "sameVersionSchemaSHA256": SCHEMA_SHA, "sameVersionGuideSHA256": NATIVE_GUIDE_SHA,
        "metadataTextExtractions": [
            {"command": "pdftotext -layout", "source": str(ROOT / "about_the_data_v5_5_0.pdf"),
             "text": str(ROOT / "about_the_data_v5_5_0.txt"), "textSHA256": sha(ROOT / "about_the_data_v5_5_0.txt")},
            {"command": "pdftotext -layout", "source": str(ROOT / "publisher-data-guide.body"),
             "text": str(ROOT / "publisher-data-guide.txt"), "textSHA256": sha(ROOT / "publisher-data-guide.txt")}
        ],
        "unitProof": proof, "nativeCountryExportInventory": country_file_inventory,
        "nativeAssetMonthlyInventory": asset_summaries,
        "nativeMonthlyTrace": {"path": str(trace_path), "sha256": sha(trace_path),
                               "rows": sum(r["sourceRows"] for r in asset_summaries),
                               "nativeUnitsSource": "Same-version schema gas/emissions_quantity columns explicitly metric tonnes"},
        "nativeMonthlyCountryListedAssetCells": country_cells,
        "nativeMonthlyGlobalListedAssetCells": global_cells,
        "nativePeriodRepetitionAudit": repetition,
        "nativeMissingQuantityCells": missing_quantities,
        "native2024To2026MissingAssetMonthPanel": missing_panel,
        "sourceReleaseContract": {
            "record": "10.5281/zenodo.19952746", "nativeFileVersion": "v5_5_0",
            "nativeGuide": "Inventory March2026 Version5.5.0",
            "publisherClaimedReleaseDate": "2026-03-26",
            "repositoryCreated": "2026-05-01T18:30:19.483485+00:00",
            "repositoryUpdated": "2026-05-01T18:30:20.288210+00:00",
            "historyBasis": "explicit revised-history archive source,not certified historical-origin availability",
            "coverageFromActualRows": sorted({r["lastMonth"] for r in asset_summaries}),
            "archiveDescriptionVersionAmbiguityResolvedForFiles": "CO2 nested members and bundled guide explicitly5.5.0;do not use outer description5.6.0 to extend cutoff",
            "rights": "CC-BY-4.0 exact record and same-version guide;selected mining asset subsectors not listed exceptions. Current5.12 guide is separate,not silently applied to archived units/vintage.",
            "methodCitation": "Jolleys,M.(2025),Mineral Extraction sector:Mining and Quarrying Emissions from Copper,Iron,Bauxite,Rock and Sand,Hypervine,UK;Climate TRACE",
            "estimateNature": "Publisher-modelled emissions estimates,not direct independent measurements",
            "independentObservedOutcomeQualification": False,
            "repetitionResidual": "Native2024/2025 totals match for each selected subsector;exact source-cell repetition audit retained. Do not treat revised monthly estimates as independently observed new2025/2026 activity outcomes.",
            "gas": "Native co2 only,not CO2e,CH4,N2O or a GSAT conversion",
            "coverageBoundary": "Listed bauxite,copper,iron mining assets only;not all minerals,national fossil-industrial CO2 or all-sector global emissions",
            "territory": "Native source iso3_country retained,including publisher GADM conventions;not reconciled to GDP/energy/World boundaries",
            "powerAndScopeBoundary": "Scope1/2,offsite electricity/fuel allocation and cross-sector double-counting unverified;no sum with power/other sectors",
            "sourceAssemblyQualified": not missing_quantities,
            "frozenHoldoutQualified": False
        },
        "separateCurrentPublisherCountryMonthlySource": live,
        "remainingGaps": [
            "Original2024/2025 public release snapshots not acquired;archive2026 repository dates do not certify earlier origin availability",
            "Archived source files stop2026-01;February-December2026 unavailable in this exact archive,not filled from current API",
            "Only3 listed-asset subsectors,not complete national/global fossil-industrial CO2 coverage",
            "Native country CSVs annual,not monthly;no monthly disaggregation or attribution factor",
            "Current API ignored/narrowed differently requested3-subsector filter and returned6;aggregate request scope rejected,24 native selected rows retained separately",
            "Current API metadata lacks atomic version binding to numeric response;explicit revised history only",
            "Publication-vintage,uncertainty,territorial,power/fuel allocation,bunkers and all-sector compatibility still required before any fit"
        ],
        "networkRequests": len(manifest["requests"]), "paidCalls": 0,
        "fitExecuted": False, "holdoutScoring": False, "centralEligible": False
    }
    save(ROOT / "monthly-source-result.json", result)
    print(json.dumps({
        "archiveBytes": len(body), "publisherMD5Verified": True,
        "monthlySourceRows": result["nativeMonthlyTrace"]["rows"],
        "monthlySourceAssets": sum(r["assets"] for r in asset_summaries),
        "cutoffs": result["sourceReleaseContract"]["coverageFromActualRows"],
        "sourceRowsBySubsectorAndYear": {r["member"]: r["nativeRowCountsByYear"] for r in asset_summaries},
        "annualCountryFilesNotDisaggregated": len(country_file_inventory),
        "currentPublisherSelectedUSAMonthlyCells": len(live["selectedNativeSubsectorMonthlyRows"]),
        "currentPublisherUnexpectedSubsectorMonthlyCells": len(live["unrequestedNativeSubsectorMonthlyRowsQuarantined"]),
        "currentPublisherExactRequestScopeCompatible": live["requestScopeCompatible"],
        "fitExecuted": False, "resultSHA256": sha(ROOT / "monthly-source-result.json")
    }, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["acquire", "spec", "documented-query", "assemble"])
    args = parser.parse_args()
    if args.command == "acquire":
        acquire()
    if args.command == "spec":
        acquire_spec()
    if args.command == "documented-query":
        acquire_documented_query()
    if args.command == "assemble":
        assemble()
