#!/usr/bin/env python3
"""Record exact original finite clauses without claiming a missing full gate.

Idempotent local recorder; no runtime, collection, scoring, Git write or release.
The parent can supply the coherent full receipt after a long-lived execution.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = {
    "S05-009": "docs/boundary-fixture-evidence.json",
    "S08-003": "docs/regional-counterfactual-surface-evidence.json",
    "S11-041": "docs/valuation-rule-chronology-evidence.json",
}
PRIMARY = "docs/counterfactual-run-primary-evidence.json"
SUPPORTING_EVIDENCE = [
    "docs/chronology-portability-evidence.json",
    "docs/regional-source-closure-evidence.json",
    "generated-artifacts/original-counterfactual-integration/focused-portable-final-repair-evidence.json",
]
SOURCES = {
    "S05-009": [
        "server/calculation/emissionsCandidate.ts", "server/calculation/nativeMechanisms.ts",
        "server/calculation/data/inventory2024.json", "script/boundary-fixture-evidence.test.ts",
        "script/emissions-candidate.test.ts", "script/native-mechanism-matrix.test.ts",
    ],
    "S08-003": [
        "shared/regionalCounterfactual.ts", "shared/regionalFieldSemantics.ts",
        "shared/legacyExportConsumer.ts", "server/calculation/regionalProjections.ts",
        "server/routes.ts", "client/src/components/regional-comparison.tsx",
        "client/src/pages/dashboard.tsx", "client/src/pages/methodology.tsx",
        "script/regional-counterfactual-labels.test.ts", "script/legacy-export-producer.test.ts",
        "script/quantity-label-contracts.test.ts", "script/residual-label-scan.ts",
        "script/field-semantics-census.ts", "docs/field_semantics_census.json",
        "script/regional-source-closure.test.ts",
    ],
    "S11-041": [
        "script/valuation-rule-chronology-evidence.test.ts",
        "script/valuation-rule-chronology-portability.test.ts",
        "script/validate-valuation-rule-chronology-private.ts",
        "script/workplan-evidence-run.py", "script/test_workplan_evidence_receipt.py",
    ],
}


def load(path):
    return json.loads((ROOT / path).read_text())


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def save(path, value):
    (ROOT / path).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "script" / f"{name}.py")
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def receipt(path, success=True):
    value = load(path)
    if success and value["exit_code"] != 0:
        raise ValueError(f"Required execution failed: {path}")
    if sha(value["log"]) != value["log_sha256"]:
        raise ValueError(f"Receipt/log mismatch: {path}")
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--focused-receipt", required=True)
    parser.add_argument("--private-receipt", required=True)
    parser.add_argument("--reconciliation-receipt")
    parser.add_argument("--full-receipt")
    args = parser.parse_args()
    focused = receipt(args.focused_receipt)
    private = receipt(args.private_receipt)
    reconciliation = receipt(args.reconciliation_receipt) if args.reconciliation_receipt else None
    full = receipt(args.full_receipt, False) if args.full_receipt else None
    if full and full["command"] != module("workplan-evidence-run").FULL_CHECK_COMMAND:
        raise ValueError("Full receipt must use the exact mandatory --full-checks command, including private chronology")
    private_log = (ROOT / private["log"]).read_text()
    for validator in ("status-choice-width-private-1", "workbook-money-integration-3",
                      "completeApprovedIssuerCases", "authenticatedIssuerReconciliations"):
        if validator not in private_log:
            raise ValueError(f"Mandatory private validator missing: {validator}")
    preservation = load("generated-artifacts/mechanism-matrix/preservation.json")
    for group in ("fair14Pins", "frozenNegativeFiles"):
        if len(preservation[group]) != 14:
            raise ValueError(f"Protected census changed: {group}")
        for item in preservation[group]:
            if sha(item["path"]) != item["expected"]:
                raise ValueError(f"Protected bytes changed; never repin: {item['path']}")
    census = load("docs/field_semantics_census.json")
    original = census["originalGapReconciliation"]
    if (original["originalPublicSlots"], original["originalFullyBoundFields"],
        original["remainingOriginalUnboundSlots"]) != (1001, 1000, 1):
        raise ValueError("Original semantic cohort changed")
    ledger = load("docs/workplan_completion_ledger.json")
    rows = {r["id"]: r for s in ledger["stages"] for r in s["requirements"]}
    if len(rows) != 300:
        raise ValueError("Original300 criterion census changed")
    contract = module("merge-clause-reconciliation").contract_digest(ledger)
    previous = ledger["latest_increment"].get("original_counterfactual_reconciliation", {})
    before = previous.get("status_before", dict(Counter(r["status"] for r in rows.values())))
    now = datetime.now(timezone.utc).isoformat()
    failures = []
    for path in sorted((ROOT / "generated-artifacts/original-counterfactual-integration").glob("*.receipt.json")):
        value = receipt(str(path.relative_to(ROOT)), False)
        if value["exit_code"] != 0:
            failures.append({"receipt": str(path.relative_to(ROOT)), **value})
    for path in sorted((ROOT / "generated-artifacts/original-counterfactual-integration").glob("full*.log")):
        if not path.with_suffix(".receipt.json").exists():
            failures.append({"log": str(path.relative_to(ROOT)), "log_sha256": sha(path.relative_to(ROOT)),
                             "exit_code": None, "counts": None,
                             "boundary": "Incomplete full execution without a terminal receipt; no pass claimed."})
    postgres_path = "docs/disposable-cache-transport-evidence.json"
    postgres = load(postgres_path)
    pg = {
        "path": postgres_path, "sha256": sha(postgres_path),
        "passed": postgres["passed"], "finished_at": postgres["finishedAt"],
        "actual_postgresql_witnesses": [w for w in postgres["witnesses"]
                                        if w.get("postgresqlTransportExecuted") is True],
        "boundary": "Historical separate isolated local PostgreSQL success, not rerun here, not production acceptance. Any optional full-suite skip remains a skip, never subtracted or replaced by memory-route success.",
    }
    source_hashes = {key: {p: sha(p) for p in paths} for key, paths in SOURCES.items()}
    supplementary_receipts = [
        "generated-artifacts/original-counterfactual-integration/focused-portable-final.receipt.json",
        "generated-artifacts/original-counterfactual-integration/focused-private-runner-final.receipt.json",
    ]
    supplementary_executions = [
        {"receipt": path, "sha256": sha(path), "execution": receipt(path)}
        for path in supplementary_receipts
    ]
    integration = {
        "focused_receipt": args.focused_receipt, "focused_counts": focused["suite_counts"],
        "private_receipt": args.private_receipt, "private_counts": private["suite_counts"],
        "reconciliation_receipt": args.reconciliation_receipt,
        "reconciliation_counts": reconciliation["suite_counts"] if reconciliation else None,
        "full_receipt": args.full_receipt, "full_exit_code": full["exit_code"] if full else None,
        "full_counts": full["suite_counts"] if full else None,
        "full_gate_passed": bool(full and full["exit_code"] == 0),
        "gate_boundary": "No publication, release or callback before the exact coherent full gate passes, including unconditional private chronology and all previous mandatory validators. Focused/private receipts do not substitute for that gate.",
        "pending_gate_action": ("Coherent full receipt attached; no scientific or runtime promotion follows automatically."
                                if full and full["exit_code"] == 0 else
                                 "Await the parent's already-running full gate AB0dmFa3 and generated-artifacts/original-counterfactual-integration/full-portable-final.receipt.json, then rerun this recorder with --full-receipt. Do not duplicate active checks or substitute a shortened gate."),
        "failure_history": failures, "separate_local_postgresql": pg,
        "supporting_evidence_sha256": {p: sha(p) for p in SUPPORTING_EVIDENCE},
        "supplementary_executions": supplementary_executions,
        "receipt_sha256": {
            p: sha(p) for p in (
                args.focused_receipt, args.private_receipt,
                args.reconciliation_receipt, args.full_receipt,
            ) if p
        },
        "protected_fair_pins": 14, "protected_frozen_negative_files": 14,
        "source_hashes": source_hashes,
        "source_contract_accounting": {
            "definitions": census["definitions"], "typed_entries": len(census["fields"]),
            "fully_bound_fields": census["fullyBoundFields"],
            "original_public_slots": original["originalPublicSlots"],
            "original_fully_bound": original["originalFullyBoundFields"],
            "remaining_original_unbound": original["remainingOriginalUnboundSlots"],
            "current_public_slots": original["currentPublicSlots"],
            "supplemental_slots": original["publicSlotDenominatorDelta"],
            "expanded_public_slots": census["supplementalSlotAccounting"]["expandedApiAndDownloadPublicSlots"],
            "expanded_bound_slots": census["supplementalSlotAccounting"]["expandedApiAndDownloadBoundSlots"],
            "regional_surfaces": 20, "regional_export_columns": 8,
            "new_original_closure_credit": 0,
        },
        "repairs": [
            "Initial recorder rejected the proposed server/routes.ts byte change against its existing FaIR source pin. Reverted only the two regional error-string edits; success claims still come from the shared regional calculator. No pin updated or exception added.",
            "Actual shared regional row-builder and bindings are followed by exact imported-symbol/source identity in the census; eight existing columns restored, no wildcard certification or denominator edits.",
            "Quantity-label AST evaluation receives the actual moved shared functions; exact notes asserted against the regional contract, retaining every fixed5Gt/null/numerical assertion.",
            "One exact residual-text exception moved verbatim to its new shared source; no broad exemption, no altered lexical classifier.",
            "Historical chronology assertions moved verbatim into an unconditional mandatory private validator; public source-only execution and an adverse negative control verify portability without impersonating historical Git proof.",
            "Retained the actual failed full receipt (1196 tests,1191 pass,4 fail,1 skip). Inspected warning/source-hash repairs and retained prior lines/hashes; focused portability/runner receipts do not replace the new complete gate.",
            "Regional source closure reviewed through actual calculator/producer dependency graphs, source archive and manifest identity, four retained-code refusal probes and process-local cache lifetime. No cache/replay bug found; no FaIR pin or route namespace changed.",
        ],
        "runtime": "No workflow restart, native production GET, data mutation, private export, auth/DDL/resource/domain change, commit, release or callback. Existing current_release remains historical.",
    }
    screenshot = "screenshots/original-counterfactual-methodology-integration.jpg"
    if (ROOT / screenshot).exists():
        integration["visual_check"] = {
            "path": screenshot, "sha256": sha(screenshot),
            "boundary": "Already-running local /methodology renders normally. First viewport only, not the lower counterfactual section or an interactive regional panel. Actual regional rendered markup/XLSX checked by focused contracts; no runtime restart or hosted-app claim.",
        }
    for key, path in EVIDENCE.items():
        evidence = load(path)
        evidence["parentIntegration"] = {**integration, "current_source_sha256": source_hashes[key]}
        if key == "S08-003":
            evidence["status"] = "original finite20-surface naming contract verified locally; coherent full gate separately required"
        save(path, evidence)
    delivered = {
        "S05-009": "Original finite renewables/EV/overlap boundary fixtures pass in the real native engine. A calibrated production ensemble is not a prerequisite of this clause; no calibration or science acceptance is inferred.",
        "S08-003": "All20 actual API/UI/ordinary and retained XLSX/JSON surfaces audited. Exact shared global-intensity counterfactual question/claim, eight columns, source-basis caveats and selected/unavailable/null/zero behavior verified; no numerical changes.",
        "S11-041": "Partial, NOT verified. Earliest retained ANY-result candidate is the14:35:14.432Z cash-flow outcomes audit, before14:41:11Z rule commit. Local mtime is not immutable execution proof; executing revision unknown. Later paired-result order does not repair chronology; no rerun/refreeze/backdating.",
    }
    limits = {
        "S05-009": "Finite numerical boundary criterion only. Independent sourced calibration, production ensemble and central/scientific admission remain unpromoted.",
        "S08-003": "Legacy global conditional diagnostic only, not regional temperature, regional inventory, source-qualified intensity pathway or net zero. Ordinary exports are not verified producer lineage.",
        "S11-041": load(EVIDENCE["S11-041"])["remainingGap"],
    }
    for key, path in EVIDENCE.items():
        row = rows[key]
        row.setdefault("original_counterfactual_prior", {
            k: row.get(k) for k in ("status", "behaviour_delivered_this_run", "remaining_gaps", "next_action")
        })
        status = "partial" if key == "S11-041" else "verified"
        gaps = [limits[key]] if key == "S11-041" else []
        next_action = ("Preserve adverse FIRST ANY audit and unknown executing revision; only authentic immutable historical evidence could resolve chronology, never a new rerun or refreeze."
                       if gaps else "No remaining exact finite-clause work; independent scientific/source gates remain unchanged.")
        row.update(status=status, proposedStatus=status, behaviour_delivered_this_run=delivered[key],
                   evidence_caveat=limits[key], remaining_gaps=gaps, exactRemainingGaps=gaps,
                   gaps=gaps, next_action=next_action, nextAction=next_action,
                   scientific_acceptance="not-promoted", scientificAcceptance="not-promoted")
        paths = [path] + SOURCES[key]
        for field in ("existing_evidence", "directEvidenceFiles"):
            row[field] = list(dict.fromkeys(row.get(field, []) + paths))
        row.setdefault("inspected_source_sha256", {}).update({p: sha(p) for p in paths})
        row["original_counterfactual_reconciliation"] = {
            "criterion": row["requirement"], "source_sha256": {p: sha(p) for p in paths},
            "delivered": delivered[key], "independent_limits": limits[key],
            "focused_receipt": args.focused_receipt,
        }
        if focused not in row["executions"]:
            row["executions"].append(focused)
    # Documentary findings advance existing source scope only, never numerical inputs.
    for key in ("S04-001", "S12-001"):
        rows[key]["counterfactual_primary_source_review"] = {
            "path": PRIMARY, "sha256": sha(PRIMARY),
            "qualified_production_inputs": 0, "scientific_promotion": False,
            "boundary": "Nine authentic primary requests:7 HTTP200/2 HTTP403; four report/workbook/statements, three routing/context HTML. EDGAR Buildings=1A4+1A5 overlap mismatch and issuer-specific materials are documentary positives, not qualified splits/joint laws/economic pairs. No study rerun.",
        }
    summary = {
        "at": now, "status_before": before,
        "status_after": dict(Counter(r["status"] for r in rows.values())),
        "scope": "Original S05-009/S08-003 finite criteria verified; S11-041 remains adverse partial. All300 original criteria; no existing verified clause reopened.",
        "evidence_sha256": {p: sha(p) for p in [*EVIDENCE.values(), PRIMARY]},
        **integration,
        "source_findings": "0 qualified numerical buildings splits,0 new regional ceilings/joint bundles,0 new issuer economic pairs; nine requests7 HTTP200/2 HTTP403, not seven qualified data sources. Original1000/1001 and all14FaIR pins preserved. Original1000-replication S04-001 remains UNEXECUTED; nine baseline failures and point-only EU solar preserved. Gordon remains primary.",
    }
    ledger["latest_increment"]["original_counterfactual_reconciliation"] = summary
    ledger["updated_at"] = now
    for execution in (focused, private, reconciliation, full,
                      *(entry["execution"] for entry in supplementary_executions)):
        if execution and execution not in ledger["run_executions"]:
            ledger["run_executions"].append(execution)
    if module("merge-clause-reconciliation").contract_digest(ledger) != contract:
        raise ValueError("Original criterion contract changed")
    module("completion-ledger").render(ledger)
    (ROOT / "docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(module("merge-clause-reconciliation").matrix(ledger))
    report = ROOT / "docs/WORKPLAN_IMPLEMENTATION_REPORT.md"
    marker = "## Original boundary/counterfactual/chronology increment — local integration"
    text = report.read_text()
    if marker in text:
        prefix, rest = text.split(marker + "\n\n", 1)
        _, end = json.JSONDecoder().raw_decode(rest)
        text = prefix + marker + "\n\n" + json.dumps(summary, indent=2) + rest[end:]
    else:
        text = marker + "\n\n" + json.dumps(summary, indent=2) + "\n\n" + text
    report.write_text(text)
    print(json.dumps({"status_after": summary["status_after"], "full_gate_passed": integration["full_gate_passed"],
                      "source_contract_accounting": integration["source_contract_accounting"]}, indent=2))


if __name__ == "__main__":
    main()
