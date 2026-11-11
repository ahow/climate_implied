"""Publisher-method qualification and native activity/factor dependency assembly.

Read-only existing scientific inputs; no forecasting or new emissions estimates.
"""
import argparse
from collections import Counter, defaultdict
import csv
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, localcontext
import hashlib
import io
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import quote
import zipfile

from climatetrace_monthly_archive_bridge import ArchiveBudget, csv_records


ROOT = Path("generated-artifacts/climatetrace-mining-method")
PLAN = Path("docs/climatetrace-mining-method-qualification-plan.json")
REPO = "climatetracecoalition/methodology-documents"
PREVIOUS = Path("generated-artifacts/climatetrace-monthly-100mb/monthly-source-result.json")
PREVIOUS_SHA = "bc6301c83c155dab5a477237468e10452399a8587b33c71fc91c19b8c5d5880f"
ARCHIVE = Path("generated-artifacts/climatetrace-monthly-100mb/mineral-extraction-archive.body")
ARCHIVE_SHA = "39a59227653de449180fc90c8f32a7c636117b66e54e853ec5c4c4cec11b609e"
SUBSECTORS = ("bauxite-mining", "copper-mining", "iron-mining")


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def save(path, obj):
    path.write_text(json.dumps(obj, indent=2, allow_nan=False) + "\n")


def request(manifest, name, url, cap):
    if len(manifest["requests"]) >= 8 or any(r["name"] == name for r in manifest["requests"]):
        raise ValueError("Bounded8-request/no-retry contract")
    if sum(r.get("bytes", 0) or 0 for r in manifest["requests"]) + cap > 50000000:
        raise ValueError("Total bounded acquisition cap exceeded")
    body, headers = ROOT / (name + ".body"), ROOT / (name + ".headers")
    start = datetime.now(timezone.utc).isoformat()
    result = subprocess.run([
        "curl", "--max-time", "60", "--max-filesize", str(cap), "--max-redirs", "5",
        "-L", "-sS", "-D", str(headers), "-o", str(body), "-w",
        "%{http_code}\\n%{url_effective}\\n", url
    ], capture_output=True, text=True, timeout=65)
    status = result.stdout.splitlines()
    r = {
        "name": name, "url": url, "maximumBytes": cap, "retrievalStartedUTC": start,
        "retrievalFinishedUTC": datetime.now(timezone.utc).isoformat(),
        "curlExit": result.returncode, "status": status[0] if status else None,
        "effectiveURL": status[1] if len(status) > 1 else None, "stderr": result.stderr,
        "body": str(body) if body.exists() else None, "bodySHA256": sha(body) if body.exists() else None,
        "headers": str(headers) if headers.exists() else None,
        "headersSHA256": sha(headers) if headers.exists() else None,
        "bytes": body.stat().st_size if body.exists() else None,
    }
    manifest["requests"].append(r)
    save(ROOT / "requests.json", manifest)
    print(name, status, result.returncode, r["bytes"], flush=True)
    if r["status"] != "200" or r["curlExit"] != 0:
        raise ValueError("Explicit source retrieval failure;no retry:" + name)
    return body


def discover():
    if sha(PREVIOUS) != PREVIOUS_SHA or sha(ARCHIVE) != ARCHIVE_SHA:
        raise ValueError("Retained monthly inputs changed")
    ROOT.mkdir(parents=True, exist_ok=True)
    if (ROOT / "requests.json").exists():
        raise ValueError("Existing acquisition:no retries/overwrite")
    manifest = {"plan": str(PLAN), "planSHA256": sha(PLAN), "requests": []}
    save(ROOT / "requests.json", manifest)
    commit_path = request(manifest, "publisher-commit",
                          f"https://api.github.com/repos/{REPO}/commits/main", 2000000)
    commit = json.loads(commit_path.read_text())
    revision = commit["sha"]
    if not re.fullmatch("[0-9a-f]{40}", revision):
        raise ValueError("Exact source commit required")
    tree_url = commit["commit"]["tree"]["url"]
    if not tree_url.startswith(f"https://api.github.com/repos/{REPO}/git/trees/"):
        raise ValueError("Exact publisher-returned tree URL required")
    tree_path = request(manifest, "publisher-tree", tree_url + "?recursive=1", 5000000)
    tree = json.loads(tree_path.read_text())
    if tree["truncated"]:
        raise ValueError("Truncated source tree;stop,no guessed paths")
    candidates = [r for r in tree["tree"] if r["type"] == "blob" and
                  (any(s in r["path"].lower() for s in ("mineral", "mining", "hypervine"))
                   or ("changelog" in r["path"].lower() and any(y in r["path"] for y in ("2025", "2026")))
                   or "license" in r["path"].lower())]
    save(ROOT / "publisher-source-discovery.json", {
        "commit": revision, "commitAuthor": commit["commit"]["author"],
        "commitCommitter": commit["commit"]["committer"],
        "tree": tree["sha"], "candidates": candidates,
        "dateInterpretation": "Retrieved current publisher method revision;commit timestamps are not certified historical public availability."})
    print(json.dumps({"commit": revision, "candidateFiles": len(candidates),
                      "discovery": str(ROOT / "publisher-source-discovery.json")}, indent=2))


def acquire_methods():
    manifest = json.loads((ROOT / "requests.json").read_text())
    if len(manifest["requests"]) != 2 or sha(PLAN) != manifest["planSHA256"]:
        raise ValueError("Exactly2 prior requests and unchanged frozen plan required")
    discovery = json.loads((ROOT / "publisher-source-discovery.json").read_text())
    tree = {r["path"]: r for r in discovery["candidates"]}
    choices = [
        ("publisher-mining-method", "2025/Mineral Extraction/Mining and Quarrying Emissions from Copper, Iron, Bauxite, Rock and Sand-MineralExtractionSector-11025.docx.pdf"),
        ("publisher-2025-dec-v5-1-changelog", "2025/CHANGELOG/12_Dec_V5.1.0/5.1.0_combined-changelog-climate-trace.docx.pdf"),
        ("publisher-2026-mar-v5-5-changelog", "2026/CHANGELOG/03_Mar_V5.5.0/5.5.0_combined-changelog_2026.docx.pdf"),
    ]
    if any(p not in tree or tree[p]["size"] > 20000000 for _, p in choices):
        raise ValueError("Exact discovered publisher document/size required")
    manifest["selectedPublisherFiles"] = [
        {"name": name, "path": path, "sourceGitBlobSHA1": tree[path]["sha"],
         "bytes": tree[path]["size"], "resolvedCommit": discovery["commit"]}
        for name, path in choices]
    save(ROOT / "requests.json", manifest)
    for name, path in choices:
        url = f"https://raw.githubusercontent.com/{REPO}/{discovery['commit']}/" + quote(path, safe="/")
        body_path = request(manifest, name, url, 20000000)
        body = body_path.read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(body)).encode() + b"\0" + body).hexdigest()
        if len(body) != tree[path]["size"] or blob != tree[path]["sha"]:
            raise ValueError("Publisher Git content identity mismatch")
        subprocess.run(["pdftotext", "-layout", str(body_path), str(ROOT / (name + ".txt"))],
                       capture_output=True, text=True, check=True, timeout=30)
    method_path = choices[0][1]
    url = f"https://api.github.com/repos/{REPO}/commits?path={quote(method_path, safe='')}&sha={discovery['commit']}&per_page=5"
    request(manifest, "publisher-method-history", url, 2000000)


def acquire_temporal():
    manifest = json.loads((ROOT / "requests.json").read_text())
    route_path = Path("docs/climatetrace-temporal-method-route.json")
    route = json.loads(route_path.read_text())
    if len(manifest["requests"]) != 6 or sha(PLAN) != manifest["planSHA256"]:
        raise ValueError("Exactly6 prior requests and frozen plan required")
    choice = route["selection"]
    tree = json.loads((ROOT / "publisher-tree.body").read_text())
    entry = next(r for r in tree["tree"] if r["path"] == choice["path"])
    if entry["sha"] != choice["sourceGitBlobSHA1"] or entry["size"] != choice["nativeBytes"]:
        raise ValueError("Exact publisher tree identity required")
    manifest.update(temporalRoute=str(route_path), temporalRouteSHA256=sha(route_path))
    manifest["selectedPublisherFiles"].append({
        "name": "publisher-temporal-method", "path": choice["path"],
        "sourceGitBlobSHA1": entry["sha"], "bytes": entry["size"],
        "resolvedCommit": choice["resolvedCommit"]})
    save(ROOT / "requests.json", manifest)
    url = f"https://raw.githubusercontent.com/{REPO}/{choice['resolvedCommit']}/" + quote(choice["path"], safe="/")
    body_path = request(manifest, "publisher-temporal-method", url, 20000000)
    body = body_path.read_bytes()
    blob = hashlib.sha1(b"blob " + str(len(body)).encode() + b"\0" + body).hexdigest()
    if len(body) != entry["size"] or blob != entry["sha"]:
        raise ValueError("Publisher temporal method Git blob mismatch")
    subprocess.run(["pdftotext", "-layout", str(body_path), str(ROOT / "publisher-temporal-method.txt")],
                   capture_output=True, text=True, check=True, timeout=30)


def decimal_native(raw):
    raw = raw.strip()
    if raw.lower() in ("", "null", "n/a", "na"):
        return None
    try:
        value = Decimal(raw)
    except InvalidOperation as error:
        raise ValueError("Unparseable native source input") from error
    if not value.is_finite() or value < 0:
        raise ValueError("Nonfinite or negative native source input")
    return value


def native_formula(row):
    """Audit native declared quantities only;never replace an observation or fit EF."""
    if row["gas"] != "co2":
        raise ValueError("Explicit source CO2 required")
    activity, factor, quantity = (decimal_native(row[k]) for k in
                                  ("activity", "emissions_factor", "emissions_quantity"))
    compatible = (row["activity_units"].startswith("t of ")
                  and row["emissions_factor_units"] == "t of CO2 per " + row["activity_units"])
    if not compatible:
        return {"status": "incompatible-or-unverified-native-units",
                "activity": activity, "factor": factor, "quantity": quantity,
                "auditProduct": None, "auditResidual": None}
    if any(v is None for v in (activity, factor, quantity)):
        return {"status": "missing-native-input-not-filled",
                "activity": activity, "factor": factor, "quantity": quantity,
                "auditProduct": None, "auditResidual": None}
    with localcontext() as ctx:
        ctx.prec = 100
        product = activity * factor
        residual = quantity - product
    return {"status": "native-dimensional-arithmetic-audited",
            "activity": activity, "factor": factor, "quantity": quantity,
            "auditProduct": product, "auditResidual": residual}


def input_pair_audit(indexed):
    """New native activity/factor audit;does not repeat old CO2-quantity pair audit."""
    results = []
    for later_year, january_only in (("2025", False), ("2026", True)):
        paired = 0
        fields = {f: {"presentPairs": 0, "exactEqualPairs": 0, "equalNonzeroPairs": 0,
                      "missingPairs": 0, "maxAbsDifference": Decimal(0)}
                  for f in ("activity", "factor")}
        for key, values in indexed.items():
            if key[-1] != "2024" or (january_only and key[-2] != "01"):
                continue
            later = indexed.get((*key[:-1], later_year))
            if later is None:
                continue
            paired += 1
            for field in fields:
                first, last = values[field], later[field]
                if first is None or last is None:
                    fields[field]["missingPairs"] += 1
                    continue
                out = fields[field]
                out["presentPairs"] += 1
                with localcontext() as ctx:
                    ctx.prec = 100
                    difference = abs(last - first)
                out["maxAbsDifference"] = max(out["maxAbsDifference"], difference)
                if difference == 0:
                    out["exactEqualPairs"] += 1
                    out["equalNonzeroPairs"] += first != 0
        for field in fields:
            fields[field]["maxAbsDifference"] = str(fields[field]["maxAbsDifference"])
        results.append({"baselineYear": "2024", "laterYear": later_year,
                        "januaryOnly": january_only, "sourceMonthPairs": paired,
                        "newNativeInputFieldComparisons": fields,
                        "CO2QuantityRepetitionAuditRerun": False})
    return results


def normalized(text):
    return re.sub(r"\s+", " ", text.replace("\u200b", "").replace("\ufeff", "")).strip()


def locate(text, phrases):
    """Source page pointers,not a generated method or a claim of original vintage."""
    pages = [normalized(page) for page in text.split("\f")]
    result = {}
    for name, requirements in phrases.items():
        matches = [n for n, page in enumerate(pages, 1) if all(term in page for term in requirements)]
        if not matches:
            raise ValueError("Publisher statement not found:" + name)
        result[name] = {"pages": matches, "requiredSourcePhrases": requirements}
    return result


def method_source_admission(mining_proof, temporal_proof, changelog_cutoff):
    required_mining = {"annual_estimate_horizon", "noncurrent_2024_production", "retrospective_factors"}
    required_temporal = {"mining_annual_disaggregation", "same_month_forward_extrapolation"}
    if required_mining - mining_proof.keys() or required_temporal - temporal_proof.keys():
        raise ValueError("Missing exact publisher dependency proof")
    return {
        "publisherMethodDependencyQualified": True,
        "publisherMiningReportedEstimatePeriodEnd": changelog_cutoff,
        "productionInputFreshness": "This is an estimate horizon,not last measured production. Mining method says copper/iron2024 production not updated;bauxite updated only for limited assets,largely carried from2023.",
        "nativeMonthlyLabelsProveMonthlyObservedActivity": False,
        "independentRealizedMonthly2025Or2026OutcomeAdmitted": False,
        "decision": "Reject this mining candidate as independent fresh monthly outcomes:annual inputs are disaggregated and last-full-year month values are extrapolated by publisher. Retain source-modelled/revised-history estimates only.",
        "scopeOneTwoAndPowerEnergyJointBoundaryAdmitted": False,
        "historicalOriginVintageAdmitted": False,
        "fitEligible": False, "fitExecuted": False, "centralEligible": False
    }


def assemble():
    manifest_path = ROOT / "requests.json"
    manifest = json.loads(manifest_path.read_text())
    if len(manifest["requests"]) != 7 or sha(PLAN) != manifest["planSHA256"]:
        raise ValueError("Exact7 bounded requests and unchanged source plan required")
    if sha(manifest["temporalRoute"]) != manifest["temporalRouteSHA256"]:
        raise ValueError("Temporal dependency route changed")
    if sha(PREVIOUS) != PREVIOUS_SHA or sha(ARCHIVE) != ARCHIVE_SHA:
        raise ValueError("Retained monthly sources changed")
    for r in manifest["requests"]:
        if r["status"] != "200" or r["curlExit"] != 0 or r["bytes"] > r["maximumBytes"]:
            raise ValueError("Unqualified publisher retrieval:" + r["name"])
        for field in ("body", "headers"):
            if sha(r[field]) != r[field + "SHA256"]:
                raise ValueError("Publisher source bytes changed")
    doc_records = []
    for selected in manifest["selectedPublisherFiles"]:
        body_path = ROOT / (selected["name"] + ".body")
        body = body_path.read_bytes()
        blob = hashlib.sha1(b"blob " + str(len(body)).encode() + b"\0" + body).hexdigest()
        if blob != selected["sourceGitBlobSHA1"] or len(body) != selected["bytes"]:
            raise ValueError("Immutable publisher Git source identity changed")
        text_path = ROOT / (selected["name"] + ".txt")
        subprocess.run(["pdftotext", "-layout", str(body_path), str(text_path)],
                       capture_output=True, text=True, check=True, timeout=30)
        doc_records.append({**selected, "bodySHA256": sha(body_path), "textSHA256": sha(text_path),
                            "textPath": str(text_path), "converter": "pdftotext -layout"})
    mining_text = (ROOT / "publisher-mining-method.txt").read_text()
    temporal_text = (ROOT / "publisher-temporal-method.txt").read_text()
    mining_proof = locate(mining_text, {
        "method_version": ["Version: November 2025"],
        "annual_estimate_horizon": ["emissions calculated from 2020-2024", "forward filled"],
        "noncurrent_2024_production": ["Asset level production data was not updated for 2024",
                                      "data largely carried over from 2023"],
        "retrospective_factors": ["Emission factors were updated for all years",
                                  "applied retrospectively"],
        "annual_average_production": ["annual-average production values"],
        "company_fuel_proxy": ["all diesel bought by mining companies is burned"],
        "representative_regional_factors": ["averaged at a national or regional level"],
        "method_example_inventory_size": ["total inventory of 1,941 assets"],
        "method_example_subsector_counts": ["With total assets numbering 914, 754 and 273"]
    })
    temporal_proof = locate(temporal_text, {
        "method_version": ["Version Dec 2025"],
        "EDGAR_r1_profiles": ["EDGAR Temporal Profiles (r1)", "disaggregate annual values to monthly"],
        "mining_annual_disaggregation": ["bauxite-mining", "copper-mining", "iron-mining",
                                       "annual", "Disaggregation", "EDGAR"],
        "same_month_forward_extrapolation": ["equivalent month range of the last full reported year were used"],
        "gap_fill_rule": ["forward-filled then back-filled"]
    })
    changelog_proofs = []
    for name, date_label in (("publisher-2025-dec-v5-1-changelog", "2025-12-01"),
                             ("publisher-2026-mar-v5-5-changelog", "2026-03-25")):
        text = (ROOT / (name + ".txt")).read_text()
        if date_label not in text:
            raise ValueError("Native changelog header date required")
        sections = {}
        for subsector in SUBSECTORS:
            match = re.search(r"## mineral-extraction," + re.escape(subsector) +
                              r"\s+(.*?)(?=\n## [a-z-]+,|\Z)", text, re.S)
            if not match:
                raise ValueError("Missing native subsector changelog section")
            section = normalized(match.group(1))
            if date_label == "2025-12-01" and "end_date 2024-12-31" not in section:
                raise ValueError("Native mining input cutoff proof missing")
            if date_label == "2026-03-25" and "[Added] None" not in section:
                raise ValueError("Native5.5.0 no-new-mining-period statement changed")
            sections[subsector] = {"nativeSectionText": section,
                                  "normalizedSectionSHA256": hashlib.sha256(section.encode()).hexdigest()}
        changelog_proofs.append({"document": name, "nativeHeaderDate": date_label, "sections": sections})
    admission = method_source_admission(mining_proof, temporal_proof, "2024-12-31")
    previous = json.loads(PREVIOUS.read_text())
    previous_pins = {r["member"]: r["sha256"] for r in previous["nativeAssetMonthlyInventory"]}
    budget = ArchiveBudget()
    with zipfile.ZipFile(ARCHIVE) as outer:
        budget.inspect(outer)
        nested = budget.read(outer, "co2/mineral_extraction.zip", 100000000)
    trace_path = ROOT / "native-activity-factor-audit.csv"
    summaries, indexed = [], {}
    missing_input_cells = []
    factor_panels = defaultdict(set)
    with zipfile.ZipFile(io.BytesIO(nested)) as inner, trace_path.open("w", newline="") as stream:
        budget.inspect(inner)
        writer = csv.DictWriter(stream, fieldnames=[
            "subsector", "source_id", "iso3_country", "start_time", "end_time", "gas",
            "activity_native", "activity_units_native", "factor_native", "factor_units_native",
            "CO2_quantity_native", "arithmetic_status", "audit_product_not_new_observation",
            "audit_reported_minus_product", "source_member", "source_logical_row"])
        writer.writeheader()
        for subsector in SUBSECTORS:
            member = f"DATA/{subsector}_emissions_sources_v5_5_0.csv"
            raw = budget.read(inner, member, 200000000)
            if hashlib.sha256(raw).hexdigest() != previous_pins[member]:
                raise ValueError("Retained native input member identity mismatch")
            counts, units, year_counts = Counter(), Counter(), Counter()
            max_abs, max_relative = Decimal(0), Decimal(0)
            worst = None
            exact, audited = 0, 0
            for row_n, row in csv_records(raw):
                if row["subsector"] != subsector or row["sector"] != "mineral-extraction":
                    raise ValueError("Native source sector identity mismatch")
                proof = native_formula(row)
                counts[proof["status"]] += 1
                units[(row["activity_units"], row["emissions_factor_units"])] += 1
                year_counts[row["start_time"][:4]] += 1
                if proof["auditResidual"] is not None:
                    audited += 1
                    delta = proof["auditResidual"].copy_abs()
                    exact += delta == 0
                    if worst is None or delta > max_abs:
                        max_abs = delta
                        worst = {"source_id": row["source_id"], "country": row["iso3_country"],
                                 "start": row["start_time"], "sourceLogicalRow": row_n,
                                 "reportedCO2Native": row["emissions_quantity"],
                                 "nativeActivity": row["activity"], "nativeFactor": row["emissions_factor"],
                                 "auditProduct": str(proof["auditProduct"]),
                                 "reportedMinusProduct": str(proof["auditResidual"])}
                    if proof["quantity"] != 0:
                        with localcontext() as ctx:
                            ctx.prec = 100
                            max_relative = max(max_relative, delta / abs(proof["quantity"]))
                else:
                    missing_input_cells.append({"subsector": subsector, "source_id": row["source_id"],
                                                "month": row["start_time"][:7], "sourceLogicalRow": row_n,
                                                "reason": proof["status"]})
                year, month = row["start_time"][:4], row["start_time"][5:7]
                identity = (subsector, row["source_id"], row["iso3_country"], month, year)
                if year in ("2024", "2025", "2026"):
                    if identity in indexed:
                        raise ValueError("Duplicate native source input month")
                    indexed[identity] = {k: proof[k] for k in ("activity", "factor")}
                if proof["factor"] is not None:
                    factor_panels[(subsector, row["source_id"], year)].add(proof["factor"])
                writer.writerow({
                    "subsector": subsector, "source_id": row["source_id"], "iso3_country": row["iso3_country"],
                    "start_time": row["start_time"], "end_time": row["end_time"], "gas": row["gas"],
                    "activity_native": row["activity"], "activity_units_native": row["activity_units"],
                    "factor_native": row["emissions_factor"], "factor_units_native": row["emissions_factor_units"],
                    "CO2_quantity_native": row["emissions_quantity"], "arithmetic_status": proof["status"],
                    "audit_product_not_new_observation": str(proof["auditProduct"]) if proof["auditProduct"] is not None else "",
                    "audit_reported_minus_product": str(proof["auditResidual"]) if proof["auditResidual"] is not None else "",
                    "source_member": member, "source_logical_row": row_n})
            summaries.append({
                "subsector": subsector, "nativeMember": member, "sourceMemberSHA256": previous_pins[member],
                "nativeInputRows": sum(counts.values()), "nativeRowsByYear": dict(year_counts),
                "statusCounts": dict(counts),
                "sourceUnitPairs": [{"activity": a, "factor": f, "rows": n} for (a, f), n in units.items()],
                "arithmeticRows": audited, "exactReportedEqualsNativeProductRows": exact,
                "maxAbsReportedMinusNativeProductTonnes": str(max_abs),
                "maxRelativeReportedMinusNativeProduct": str(max_relative), "maxAbsResidualCell": worst,
                "engineeringAuditOnly": True, "sourceFactorFittedOrChanged": False})
    input_pairs = input_pair_audit(indexed)
    history = json.loads((ROOT / "publisher-method-history.body").read_text())
    discovery = json.loads((ROOT / "publisher-source-discovery.json").read_text())
    result = {
        "assembledAtUTC": datetime.now(timezone.utc).isoformat(),
        "methodModule": __file__, "methodModuleSHA256": sha(__file__),
        "readOnlyZipDependencySHA256": sha("script/climatetrace_monthly_archive_bridge.py"),
        "sourcePlan": str(PLAN), "sourcePlanSHA256": sha(PLAN),
        "requestManifest": str(manifest_path), "requestManifestSHA256": sha(manifest_path),
        "previousMonthlyResultSHA256Unchanged": PREVIOUS_SHA,
        "nativeArchiveSHA256Unchanged": ARCHIVE_SHA,
        "publisherCommit": discovery["commit"], "publisherTree": discovery["tree"],
        "publisherDocuments": doc_records,
        "publisherMethodHistory": [{"commit": r["sha"], "authorDate": r["commit"]["author"]["date"],
                                   "committerDate": r["commit"]["committer"]["date"]}
                                  for r in history],
        "methodAvailabilityResidual": "Mining file history identifies one2025-11-12 commit at this path;method current immutable bytes verified. Commit/date/file-version labels do not certify original data snapshot public availability. Temporal file history not additionally requested.",
        "nativeMiningMethodPageProof": mining_proof,
        "nativeTemporalMethodPageProof": temporal_proof,
        "nativeSubsectorChangelogProof": changelog_proofs,
        "methodExampleInventoryComparedWithArchivedInventory": {
            "methodDocumentTotalAssets": 1941,
            "nativeArchiveTotalAssets": sum(r["assets"] for r in previous["nativeAssetMonthlyInventory"]),
            "nativeMinusMethodAssets": sum(r["assets"] for r in previous["nativeAssetMonthlyInventory"]) - 1941,
            "perSubsector": [
                {"subsector": subsector, "methodDocumentAssets": number,
                 "nativeArchiveAssets": next(r["assets"] for r in previous["nativeAssetMonthlyInventory"]
                                             if subsector in r["member"]),
                 "nativeMinusMethodAssets": next(r["assets"] for r in previous["nativeAssetMonthlyInventory"]
                                                 if subsector in r["member"]) - number}
                for subsector, number in (("bauxite-mining", 273), ("copper-mining", 914), ("iron-mining", 754))
            ],
            "decision": "November2025 method example and March2026 archive catalogs differ;do not force asset-count equality or treat method table as matched numerical validation."
        },
        "newNativeInputAssemblies": summaries, "newActivityFactorPeriodComparisons": input_pairs,
        "factorConstancyWithinNativeAssetYear": {
            "panels": len(factor_panels),
            "singleFactorPanels": sum(len(v) == 1 for v in factor_panels.values()),
            "multipleFactorPanels": [{"subsector": s, "source_id": i, "year": y,
                                     "distinctNativeFactors": len(v)}
                                    for (s, i, y), v in factor_panels.items() if len(v) > 1]},
        "missingOrUnqualifiedNativeInputCells": missing_input_cells,
        "nativeInputAuditTrace": {"path": str(trace_path), "sha256": sha(trace_path),
                                 "rows": sum(r["nativeInputRows"] for r in summaries)},
        "sourceAdmission": admission,
        "newQualifiedScientificConclusion": "Publisher explicitly classifies selected mining data as annual inputs disaggregated using EDGAR r1 profiles and extrapolated using same months of last full reported year. Repeated native activity/factor vectors corroborate this dependency. These monthly mining rows are not admissible independent fresh2025/2026 realized-outcome targets.",
        "boundaryConclusion": "Mining factors average company/national/regional annual fuel/emissions data,with scaling/refinement proxies. Formal Scope1/2/offsite-electricity and full joint GDP/primary-energy/bunker/territory consistency remain unqualified;no new proxy/factor implemented.",
        "originalArchiveAvailability": {"publisherClaimedRelease": "2026-03-26",
                                       "repositoryCreated": "2026-05-01T18:30:19.483485+00:00",
                                       "changelogHeader": "2026-03-25",
                                       "historyBasis": "explicit revised history;distinct dates retained,no historical-origin claim"},
        "notDone": ["No source replication of EDGAR profiles or gridded proxy",
                    "No new emissions factor,calibration,synthetic observations or ensemble",
                    "No unchanged CO2-quantity repetition,old forecast or Kaya rerun",
                    "No original2024/2025 emissions snapshot acquisition",
                    "No global/RoW GDP residual invented as qualified native account",
                    "No fit/holdout scoring/canonical or protectedFaIR bundle changes"],
        "requests": len(manifest["requests"]), "paidCalls": 0, "fitExecuted": False,
        "holdoutScores": 0, "centralEligible": False
    }
    save(ROOT / "method-qualified-native-input-result.json", result)
    print(json.dumps({
        "newNativeInputRows": result["nativeInputAuditTrace"]["rows"],
        "newActivityFactorPeriodComparisons": input_pairs,
        "sourceAdmission": admission,
        "maxNativeProductResiduals": {r["subsector"]: r["maxAbsReportedMinusNativeProductTonnes"] for r in summaries},
        "requests": len(manifest["requests"]),
        "resultSHA256": sha(ROOT / "method-qualified-native-input-result.json")
    }, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["discover", "methods", "temporal", "assemble"])
    args = parser.parse_args()
    if args.command == "discover":
        discover()
    if args.command == "methods":
        acquire_methods()
    if args.command == "temporal":
        acquire_temporal()
    if args.command == "assemble":
        assemble()
