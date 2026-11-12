#!/usr/bin/env python3
"""Record four original partial clauses, not release or scientific acceptance.

Run without receipts while the parent completes UI/full checks. Later supply
--focused-receipt/--private-receipt/--full-receipt (repeat --adverse-receipt for
failed attempts). Only hash-verified terminal receipts confer execution claims.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KEY = "economic_bridge_original_partial"
IDS = ("S13-001", "S13-002", "S13-005", "S12-005")
MARKER = "## Producer reserve and location electricity — original partial clauses"
SOURCE_FILES = [
    "server/calculation/producerReserveDomain.ts",
    "server/calculation/producerReserveEvidence.ts",
    "server/calculation/producerReserveFreeze.ts",
    "server/calculation/producerReserveModel.ts",
    "server/calculation/producerPrimaryAuthentication.ts",
    "shared/producerReserveSchema.ts",
    "server/calculation/locationElectricityCashBridge.ts",
    "server/calculation/locationElectricityPublicReport.ts",
    "server/calculation/companyProjection.ts",
    "shared/locationElectricityPublicTypes.ts",
    "server/producerReserveApi.ts", "server/economicBridgeIdentity.ts",
    "shared/economicBridgeSchema.ts", "shared/serverDownloadRegistry.ts",
    "server/downloadManifestMiddleware.ts", "server/companyConditionalApi.ts",
    "client/src/components/producer-reserve-panel.tsx",
    "client/src/components/location-electricity-panel.tsx",
    "client/src/lib/producer-reserve-reader.ts",
    "client/src/lib/location-electricity-reader.ts",
    "client/src/lib/economic-export-readback.ts",
    "client/src/hooks/use-producer-reserve.ts",
    "client/src/hooks/use-location-electricity.ts",
    "client/src/pages/climate-valuation.tsx",
    "script/producerReserve.test.ts", "script/producerReserve-private.ts",
    "script/producerReserve-validate-private.ts", "script/producerReserve-run.ts",
    "script/locationElectricity.test.ts",
    "script/locationElectricity-company-projection.test.ts",
    "script/locationElectricity-validate-private.ts",
    "script/locationElectricity-source-evidence.ts",
    "script/economic-bridge-api.test.ts", "script/economic-bridge-ui.test.ts",
    "script/economic-bridge-census.ts", "script/workplan-evidence-run.py",
    "script/validate-producer-primary-authentication-private.ts",
    "client/src/components/producer-reserve-panel.test.ts",
    "client/src/components/location-electricity-panel.test.ts",
    "script/economic-download-contract-audit.ts",
    "shared/locationElectricitySemantics.ts", "shared/outputFieldSemantics.ts",
    "script/field-semantics-census.ts", "script/output-register.ts",
]
ARTIFACTS = [
    "generated-artifacts/producer-reserve/domain-freeze.json",
    "generated-artifacts/producer-reserve/calculation.json",
    "generated-artifacts/producer-reserve/private-source-validation.json",
    "generated-artifacts/locationElectricity/private-source-validation.json",
    "generated-artifacts/locationElectricity/primary-price-receipt.json",
    "docs/locationElectricity-domain-freeze.json",
    "docs/locationElectricity-source-evidence.json",
    "docs/producer-primary-authentication-evidence.json",
    "docs/field_semantics_census.json", "docs/System_Output_Register.md",
]
NEXT = {
    "S13-001": "Primary-table authentication and SEC acceptance timestamp resolved; obtain owner review and successor legal/security continuity, then qualify reserve-interest versus whole-equity allocation including non-producing businesses, NCI, debt and cash; never treat reserve PV10 as market equity.",
    "S13-002": "With primary-table authentication resolved, obtain a genuinely compatible market reserve-interest target and independently review timing/fiscal/uniqueness assumptions before any market-implied decline claim; replacement inversion remains refused until separately certified.",
    "S13-005": "Independently review and approve complete defensible commodity, margin, discount, capital/replacement and cash-timing assumptions for an identified valuation-to-physical map; do not widen the frozen domain after solving.",
    "S12-005": "Source same-period site purchased MWh, supplier/tariff eligibility, currency, customer recovery and payment/collection timing; then execute an admissible issuer companyProjection bridge, not a regional-average substitute.",
}
DELIVERED = {
    "S13-001": "Explicit XOM consolidated proved-producing reserve-interest sector map, including NCI and excluding equity affiliates. Official SEC200 authenticates39facts/38rows/261numeric cells and retained2025-02-19T21:39:37Z acceptance; selected primary-table gap resolved, not owner/successor-security/whole-equity qualification.",
    "S13-002": "Finite reserve stock, production and unlevered conditional cash model yields 2.9773550346% diagnostic depletion against disclosed USD151494m PV10; seven sensitivities (3 roots/4 no-root), six zero accounting residuals; market-equity and uncertified replacement inversions refused.",
    "S13-005": "Prior-frozen [0,8%] decline domain, fixed price/cost basket, margin, discount, capital, WC and 100-year zero-terminal assumptions published separately from source facts; explicit replacement forward code is not a certified inverse.",
    "S12-005": "Location electricity cash bridge integrated in real companyProjection, seven synthetic integration controls; source investigation establishes five operating/one construction property and five EIA contextual prices, zero applicable issuer tariffs or actual issuer executions.",
}


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "script" / f"{name}.py")
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def load(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def receipt(path):
    value = load(path)
    if not isinstance(value.get("exit_code"), int):
        raise ValueError(f"No terminal exit code: {path}")
    if sha(value["log"]) != value["log_sha256"]:
        raise ValueError(f"Receipt/log mismatch: {path}")
    return {"receipt": path, "sha256": sha(path), "execution": value}


def reconcile_runner_hash():
    """Executable provenance only; never repin protocols or original DOCX."""
    path = ROOT / "docs/status-choice-width-increment-evidence.json"
    text = path.read_text()
    evidence = json.loads(text)
    entry = next(s for s in evidence["sources"] if s["path"] == "script/workplan-evidence-run.py")
    current = sha(entry["path"])
    if entry["sha256"] != current:
        old = entry["sha256"]
        entry.setdefault("economicBridgePriorSha256", []).append(old)
        entry["economicBridgeChange"] = (
            "Inspected additive mandatory private producer source validation, calculation/freeze "
            "and two historical assertions outside public wildcard, plus private location electricity "
            "source validation and validate-producer-primary-authentication-private.ts --private-primary. "
            "This verifies actual retained SEC/primary table bytes and acceptance timestamp separately "
            "from the unchanged original frozen-source validator. All earlier full wildcard, Python, original DOCX, chronology, monetary, "
            "issuer and build gates retained. Executable provenance refreshed, not numerical rules, "
            "frozen original bytes, source approval or historical test outcomes."
        )
        entry["sha256"] = current
        # Preserve original compact formatting and every old historical hash.
        start = text.index('    {"path": "script/workplan-evidence-run.py"')
        end = text.index("\n", start)
        text = text[:start] + "    " + json.dumps(entry, ensure_ascii=False) + "," + text[end:]
        path.write_text(text)
    return {"path": str(path.relative_to(ROOT)), "sha256": sha(path.relative_to(ROOT)),
            "runner_sha256": current, "reason": entry.get("economicBridgeChange")}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for kind in ("focused", "private", "full"):
        parser.add_argument(f"--{kind}-receipt")
    parser.add_argument("--supporting-receipt", action="append", default=[])
    parser.add_argument("--adverse-receipt", action="append", default=[])
    args = parser.parse_args()
    ledger = load("docs/workplan_completion_ledger.json")
    rows = {r["id"]: r for s in ledger["stages"] for r in s["requirements"]}
    counts = dict(Counter(r["status"] for r in rows.values()))
    if len(rows) != 300 or counts != {"verified": 63, "partial": 235, "blocked-production-provisioning": 2}:
        raise ValueError(f"Original300/status contract changed: {counts}")
    if any(rows[key]["status"] != "partial" for key in IDS):
        raise ValueError("This recorder cannot promote or reopen any criterion")
    contract = module("merge-clause-reconciliation").contract_digest(ledger)
    preserved_release = json.dumps(ledger["current_release"], sort_keys=True)
    preservation = load("generated-artifacts/mechanism-matrix/preservation.json")
    for group in ("fair14Pins", "frozenNegativeFiles"):
        if len(preservation[group]) != 14:
            raise ValueError(f"Protected census changed: {group}")
        for item in preservation[group]:
            if sha(item["path"]) != item["expected"]:
                raise ValueError(f"Protected bytes changed; never repin: {item['path']}")
    original = load("docs/field_semantics_census.json")["originalGapReconciliation"]
    if (original["originalPublicSlots"], original["originalFullyBoundFields"],
            original["remainingOriginalUnboundSlots"]) != (1001, 1000, 1):
        raise ValueError("Original semantic cohort changed")
    calculation = load(ARTIFACTS[1])
    report = calculation["report"]
    if report["target"]["valueUsdMillion"] != 151494 or abs(report["baseResult"]["decline"] * 100 - 2.9773550346) > 1e-10:
        raise ValueError("Unexpected retained diagnostic result")
    sensitivities = Counter(row["result"]["status"] for row in report["sensitivityRows"])
    if sensitivities != {"unique-conditional-root": 3, "no-root": 4}:
        raise ValueError("Sensitivity outcomes changed")
    residuals = {k: v for k, v in report["reconciliation"].items()
                 if "Residual" in k and k != "pvResidualUsdMillion"}
    if len(residuals) != 6 or any(v != 0 for v in residuals.values()):
        raise ValueError("Accounting residuals changed")
    source_validation = load(ARTIFACTS[2])
    if (source_validation["checks"], source_validation["passed"], source_validation["failed"]) != (85, 85, 0):
        raise ValueError("Private85 assertion result changed")
    previous = ledger["latest_increment"].get(KEY, {})
    executions = dict(previous.get("receipts", {}))
    for item in executions.values():
        if receipt(item["receipt"]) != item:
            raise ValueError(f"Previously recorded receipt changed: {item['receipt']}")
    for kind in ("focused", "private", "full"):
        path = getattr(args, f"{kind}_receipt")
        if path:
            executions[kind] = receipt(path)
    for path in args.supporting_receipt:
        executions[f"supporting:{path}"] = receipt(path)
    full = executions.get("full", {}).get("execution")
    if full and full["command"] != module("workplan-evidence-run").FULL_CHECK_COMMAND:
        raise ValueError("Full receipt must use exact current unconditional --full-checks")
    failure_history = list(previous.get("failure_history", []))
    for path in args.adverse_receipt:
        item = receipt(path)
        if item["execution"]["exit_code"] == 0:
            raise ValueError("Adverse receipt must not claim success")
        if item not in failure_history:
            failure_history.append(item)
    for item in executions.values():
        if item["execution"]["exit_code"] and item not in failure_history:
            failure_history.append(item)
    provenance = reconcile_runner_hash()
    now = datetime.now(timezone.utc).isoformat()
    summary = {
        "recorded_at": now, "criteria": list(IDS), "status_counts": counts,
        "scope": "All four original clauses remain partial; zero promotions, no release/callback.",
        "source_sha256": {p: sha(p) for p in SOURCE_FILES},
        "functions": {
            "producer": ["calculateProducerReservePath", "solveProducerReserveDecline",
                         "calculateProducerReplacementPath", "solveProducerReplacementDecline",
                         "qualifyProducerReserveCandidates", "buildPublicProducerReserveReport"],
            "electricity": "locationElectricityCashBridge.ts explicit expense/recovery/AP/AR/WC bridge, companyProjection.ts actual consumer; public source report deliberately refuses actualIssuerResult",
            "publication": "producerReserveApi.ts createEconomicBridgeService per-worker adapters; economicBridgeIdentity.ts executed code archive/hash verification; strict client readers and economic-export-readback",
        },
        "artifact_sha256": {p: sha(p) for p in ARTIFACTS},
        "runner_provenance": provenance,
        "receipts": executions, "failure_history": failure_history,
        "full_gate_passed": bool(full and full["exit_code"] == 0),
        "full_gate_counts": full.get("suite_counts") if full else None,
        "gate_next": "Parent must execute the complete current gate after UI integration and attach its real receipt; focused/source-only results cannot substitute." if not full or full["exit_code"] else "Full local receipt attached; no automatic runtime, issuer, scientific or owner approval.",
        "reserve": {
            "target_usd_million": 151494, "diagnostic_depletion_percent": report["baseResult"]["decline"] * 100,
            "basis": report["target"]["basis"], "market_implied_decline": None,
            "sensitivity_outcomes": dict(sensitivities), "six_accounting_residuals": residuals,
            "pv_solver_residual_usd_million": report["baseResult"]["residualUsdMillion"],
            "freeze_compatibility": calculation["mechanicalCompatibilityAddendum"],
            "source_publication": "Already-retained official SEC acceptance2025-02-19T21:39:37Z verified. Official SEC200 direct-primary review matches39facts/38rows/261numeric cells. Selected primary-table authentication RESOLVED; not complete mirrored PDF authentication, mirror publication time, owner authorization, successor legal/security continuity or actual market/equity allocation.",
            "current_primary_assessment": {
                "evidence": "docs/producer-primary-authentication-evidence.json",
                "public_constant": "server/calculation/producerPrimaryAuthentication.ts",
                "mandatory_private_command": "npx tsx script/validate-producer-primary-authentication-private.ts --private-primary",
                "identity_boundary": "Current source assessment separately bound in API identity and UI; original frozen model/source/domain unchanged. Historical frozen gaps remain verbatim but are not the current primary-table assessment.",
            },
            "boundary": "100-year finite-pool zero-terminal diagnostic, NOT original whole-equity 5-year explicit +10-year fade model. Whole-equity/market allocation separately refused. Explicit replacement forward cohorts/capex code exists; inverse nonidentified, never certified.",
            "accounting": "Physical depletion once; DD noncash; development once; no historical cost-per-addition inference; fixed income-tax-per-boe not marginal tax; explicit conditional zero WC, no debt/cash/NCI-to-equity bridge.",
            "private_gate": "85 source assertions plus two historical tests retained verbatim outside public script/*.test.ts wildcard, unconditional mandatory private gate; missing bytes fail. Public source-only sandbox 11 pass is engineering portability, not private proof.",
        },
        "electricity": {
            "source_counts": load(ARTIFACTS[3])["counts"],
            "integration": "Real companyProjection path with seven synthetic controls, not seven actual issuer cases.",
            "formula": "Expense=site MWh*(scenario-baseline price); recovery=expense*recovery fraction; supplier/customer settlement fractions give AP/AR and incremental WC; FCFE deducts incremental cash exactly once. Scope2 tonnes never directly taxed.",
            "boundary": "Five operating plus one under-construction FSLR property; five EIA Ohio industrial regional averages contextual only, not tariffs. Actual source-qualified issuer executions=0. Same-period currency/quantity/tariff/recovery/settlement admission mandatory; no default MWh/FX/pass-through.",
        },
        "supplemental_taxonomy": {
            "namespaces": ["/api/cv/producer-reserve", "/api/cv/location-electricity"],
            "surfaces_per_namespace": ["API GET", "export.json GET", "export.xlsx GET", "Climate Valuation UI panel"],
            "identity": "Independent source/code/material-input/assumption/model/derivation/result hashes and prospective input parent; retainedResultId=null. Exact executed worker closure, not borrowed prior source IDs or retained-result binding.",
            "xlsx": "Public calculation sheet, JSON pointer and Literal JSON value columns; exact ordered lossless API scalar/container serialization, no spreadsheet formulas. Client readback checks body/hash/parent/code/source/derivation.",
            "closure": "Each adapter independently binds its actual worker source closure and source records; absent/stale freeze or changed source refuses. Missing issuer cash bridge stays null. No route overrides, parent/archive selections, private raws or provider calls.",
            "original1001_delta": 0, "fixed29_matrix_delta": 0,
        },
        "repair_history": [
            "Initial full-final.receipt.json failed:1263total/1251pass/11fail/1optionalPGskip; Python not run. Failed terminal receipt preserved, never relabelled as passing.",
            "Screenshot exposed actual ol nested in p; fixed with block-capable markup and24 component UI tests, separately from original11 full-suite census failures.",
            "Component-state10new consumers, export registry15retained+4new and stale source-derived censuses reconciled without weakened assertions or mandatory gates.",
            "234 precise supplemental semantics, no original1001/fixed29 credit. Current census/output register regenerated exclusively with existing tools.",
        ],
        "preservation": "All14 FaIR pins and14 frozen negative files hash-verified. Old124 results/179 headers/416 chunks unchanged by this recorder; no historical export recovery. Original1000/1001 unchanged; fixed29 unchanged. No owner/scientific/source approval fabricated.",
        "runtime": "Inspected local base ad8eccd363be92d354e03596cf046038594b04da plus uncommitted implementation; existing measured runtime567f6062 remains separate until a new measured release. No deployed receipt invented, current_release untouched.",
    }
    for key in IDS:
        row = rows[key]
        row["behaviour_delivered_this_run"] = DELIVERED[key]
        row["economic_bridge_increment"] = {
            "delivered": DELIVERED[key], "next_action": NEXT[key],
            "evidence": f"docs/WORKPLAN_IMPLEMENTATION_REPORT.md#{MARKER[3:].lower().replace(' ', '-')}",
            "source_hashes": summary["source_sha256"],
            "artifact_hashes": summary["artifact_sha256"],
            "receipt_references": {k: {"receipt": v["receipt"], "sha256": v["sha256"]}
                                   for k, v in executions.items()},
            "failure_history_reference": f"latest_increment.{KEY}.failure_history",
            "boundary": "Partial only; no scientific/owner/source acceptance or runtime claim.",
        }
        row["files_functions_changed"] = SOURCE_FILES
        row["next_action"] = NEXT[key]
        row["remaining_gaps"] = [NEXT[key]]
        # Reconcile aliases used by the existing matrix; never leave a stale
        # "not implemented" blocker beside actual new conditional code.
        for field in ("gaps", "exactRemainingGaps"):
            row[field] = [NEXT[key]]
        row["nextAction"] = [NEXT[key]]
        row["blockers"] = [{"kind": "remaining original qualification", "detail": NEXT[key]}]
        row["evidence_caveat"] = "Conditional implementation/source transcription and synthetic tests only; full gate pending unless exact receipt attached. Original criterion remains partial."
        row["inspected_source_sha256"] = {**row.get("inspected_source_sha256", {}), **summary["source_sha256"]}
        for item in executions.values():
            execution = item["execution"]
            if execution not in row.setdefault("executions", []):
                row["executions"].append(execution)
    ledger["latest_increment"][KEY] = summary
    ledger["updated_at"] = now
    for item in executions.values():
        if item["execution"] not in ledger["run_executions"]:
            ledger["run_executions"].append(item["execution"])
    if module("merge-clause-reconciliation").contract_digest(ledger) != contract:
        raise ValueError("Original criterion contract changed")
    if json.dumps(ledger["current_release"], sort_keys=True) != preserved_release:
        raise ValueError("Runtime receipt changed")
    module("completion-ledger").render(ledger)
    matrix_path = ROOT / "docs/WORKPLAN_ACCEPTANCE_MATRIX.md"
    # The matrix has retained historical release material before its generated
    # heading. Preserve it byte-for-byte instead of replacing it with new claims.
    matrix_prefix = matrix_path.read_text().split("# Original workplan acceptance matrix", 1)[0]
    matrix_path.write_text(matrix_prefix + module("merge-clause-reconciliation").matrix(ledger))
    report_path = ROOT / "docs/WORKPLAN_IMPLEMENTATION_REPORT.md"
    text = report_path.read_text()
    end_marker = "<!-- economic-bridge-original-partial:end -->"
    if MARKER in text:
        start = text.index(MARKER)
        end = text.index(end_marker, start) + len(end_marker)
        text = text[:start] + text[end:].lstrip("\n")
    sections = [
        MARKER, "", "**300 original criteria: 63 verified /235 partial /2 blocked. These four remain partial.**",
        "",
        "PV10 diagnostic **2.9773550346%**, not market-implied decline; authentic disclosed **USD151494m** reserve interest. "
        "Seven sensitivities:3 conditional roots/4 no-root; six accounting residuals zero. Finite100-year pool, "
        "zero terminal is not original whole-equity5+10fade. Whole equity and replacement inversion refused; "
        "replacement forward code is explicitly conditional. **Selected primary-table authentication RESOLVED:** "
        "official SEC200,39facts/38rows/261numeric cells; already-retained acceptance2025-02-19T21:39:37Z verified. "
        "Complete mirror PDF identity/publication, owner authorization, successor legal/security continuity and actual market allocation remain unqualified.",
        "",
        "Prior assumptions/domain freeze retained byte-for-byte; only mechanical Set-spread to Array.from(Set) "
        "compatibility repair, inverse hash reconstruction checked privately. Private85 source assertions +2 historical "
        "tests remain verbatim outside public wildcard, mandatory without skip. Source-only sandbox11pass is not private proof.",
        "",
        "Current primary assessment is separately identity-bound in API/UI via producerPrimaryAuthentication.ts; "
        "unconditional validate-producer-primary-authentication-private.ts --private-primary verifies actual retained bytes. "
        "Original model/source/domain freeze unchanged, no fabricated approval or historical rewrite.",
        "",
        "Scope2 real companyProjection integration:7 synthetic controls; SEC5 operating/1 construction site and "
        "EIA5 contextual Ohio price records, no actual applicable tariffs/MWh/recovery; **0 source-qualified issuer executions**. "
        "Electricity expense/recovery/settlement enters WC and FCFE once; no direct tax on Scope2 tonnes.",
        "",
        "New prospective API/UI/JSON/XLSX identities are supplemental only: exact per-worker source/code/input/assumption/"
        "model/derivation/result closure, no borrowed source or retained parent; original1001/fixed29 receive zero credit. "
        "All14 FaIR pins verified; old124/179/416 untouched. Existing runtime567f6062 is not this uncommitted code.",
        "",
        "Current executable runner provenance reconciled in status-choice-width evidence with old hashes retained: "
        "mandatory private producer/freeze, electricity and current primary-authentication gates added, no assertion weakened or original DOCX/numerical rule changed.",
        "",
        "Initial full-final receipt retained:1263total/1251pass/11fail/1skip; Python not run. Screenshot caught "
        "actual ol-in-p DOM nesting, fixed with24 UI tests. Component-state10new consumers, export registry15old+4new "
        "and stale source censuses repaired without weakened gates. Current census adds234 precise supplemental semantics; "
        "census/output register regenerated only through existing tools.",
        "",
        f"**Full gate: {'passed (local receipt only)' if summary['full_gate_passed'] else 'PENDING; no invented counts'}.** "
        "Actual source/artifact/receipt/log hashes and failure history are in latest_increment.economic_bridge_original_partial "
        "and the four criterion records; earlier failed/incomplete receipts are preserved, not reclassified.",
        "",
    ]
    for key in IDS:
        sections += [f"- **{key} partial:** {DELIVERED[key]} Next: {NEXT[key]}"]
    sections += ["", end_marker, "", text]
    report_path.write_text("\n".join(sections))
    print(json.dumps({"status_counts": counts, "full_gate_passed": summary["full_gate_passed"],
                      "receipts": list(executions), "criteria": list(IDS)}, indent=2))


if __name__ == "__main__":
    main()
