#!/usr/bin/env python3
"""Reconcile authentic observed economic code release; no deploy or network IO."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "cbb877324aac9890c18b784fbf4c8817c7e8c3c5"
PUBLIC = "b8d98f6837e329a800067e42b366d93325859725"
IDS = ["S13-001", "S13-002", "S13-005", "S12-005"]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "script" / f"{name}.py")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", required=True)
    args = parser.parse_args()
    observed = json.loads((ROOT / args.receipt).read_text())
    if (observed["workspace_source"], observed["public_source"]) != (SOURCE, PUBLIC):
        raise ValueError("Code source mismatch")
    ci, railway, live = observed["ci"], observed["railway"], observed["live"]
    if ci["head_sha"] != PUBLIC or ci["conclusion"] != "success" or {
        j["name"]: j["conclusion"] for j in ci["jobs"]
    } != {"validate": "success", "promote": "success"}:
        raise ValueError("Existing source validation/promotion not successful")
    if observed["production_validated"] != PUBLIC or railway["status"] != "SUCCESS" or railway["source_commit"] != PUBLIC:
        raise ValueError("Validated Railway source mismatch")
    checks = live["safeChecks"]
    if [c["status"] for c in checks] != [200, 200, 200, 400, 400, 403, 403, 403]:
        raise ValueError("Metadata/catalog/private refusal status mismatch")
    if checks[0]["body"]["sourceCommit"] != PUBLIC or any(
        c["cacheControl"] != "no-store" or c["attachment"] for c in checks
    ):
        raise ValueError("Actual build or safe headers mismatch")
    if {c["identity"]["key"] for c in live["economicChecks"]} != {"producerReserve", "locationElectricity"}:
        raise ValueError("Both real economic reports required")
    for result in live["economicChecks"]:
        if not result["allIdentityHashesVerified"] or len(result["attachments"]) != 2 or any(
            not a["exactDocumentReadback"] or a["status"] != 200 for a in result["attachments"]
        ):
            raise ValueError("Six actual API/JSON/XLSX readbacks required")
    ledger = json.loads((ROOT / "docs/workplan_completion_ledger.json").read_text())
    rows = {r["id"]: r for s in ledger["stages"] for r in s["requirements"]}
    counts = dict(Counter(r["status"] for r in rows.values()))
    if len(rows) != 300 or counts != {"verified": 63, "partial": 235, "blocked-production-provisioning": 2} or any(
        rows[key]["status"] != "partial" for key in IDS
    ):
        raise ValueError("Original clause/status census changed")
    increment = ledger["latest_increment"]["economic_bridge_original_partial"]
    execution_ref = increment["receipts"]["full"]["receipt"]
    execution = json.loads((ROOT / execution_ref).read_text())
    if execution["exit_code"] != 0 or sha(execution["log"]) != execution["log_sha256"] or execution["command"] != module("workplan-evidence-run").FULL_CHECK_COMMAND:
        raise ValueError("Exact coherent mandatory gate did not pass")
    if execution["suite_counts"] != {
        "typescript": {"tests": 1272, "pass": 1271, "fail": 0, "skipped": 1},
        "python": {"tests": 255, "pass": 255, "fail": 0, "skipped": 0},
    }:
        raise ValueError("Unexpected retained full-gate counts")
    reports = {c["identity"]["key"]: c for c in live["economicChecks"]}
    release = {
        "workspace_commit": SOURCE, "github_main": PUBLIC,
        "production_validated": observed["production_validated"],
        "ci": f'{ci["run"]} validate/promote success', "ci_url": ci["url"],
        "ci_steps": "Existing public TS/Python/typecheck/build job-step metadata succeeded. CI counts/logs not inspected; local mandatory private validators are not public CI counts.",
        "railway_deployment": railway["id"], "railway_status": railway["status"],
        "railway_completed_at": railway["updated_at"], "verified_at": live["verifiedAt"],
        "verified_base": live["base"], "build_info_source_commit": PUBLIC, "health": 200,
        "receipt": args.receipt, "receipt_sha256": sha(args.receipt),
        "runtime": "Exact live code SHA/health and six new nonpersisting API/JSON/XLSX readbacks executed. All identity/source/material/model/derivation/result hashes and source closure files verified; complete JSON and literal XLSX match actual current API outputs. Empty safe paired catalog200, override/missing pins400, private routes403/no-store.",
        "economic_live": {
            key: {"identity_id": result["identity"]["id"], "result_hash": result["identity"]["resultHash"],
                  "code_archive_id": result["identity"]["codeArtifact"]["id"],
                  "source_artifact_id": result["identity"]["sourceArtifact"]["id"],
                  "closure_files_verified": result["codeClosureFilesVerifiedAgainstLocalSource"],
                  "findings": result["findings"],
                  "attachments": result["attachments"]}
            for key, result in reports.items()
        },
        "local_execution": {
            "receipt": execution_ref, "receipt_sha256": sha(execution_ref),
            "log_sha256": execution["log_sha256"], "counts": execution["suite_counts"],
            "command": execution["command"],
            "private_checks": "Original document, authentic chronology,85 producer source assertions,2 historical freeze tests, new primary39facts/38rows/261cells/SEC acceptance, location electricity, monetary and issuer validators all mandatory and passed; typecheck/build passed.",
            "post_recorder_receipt": "generated-artifacts/economic-bridge-integration/post-full-recorder-focused.receipt.json",
        },
        "counts": counts, "partial_implementation_criteria": IDS,
        "scientific_acceptance": False, "newly_qualified_pairs": 0,
        "source_assessment": "Selected primary-table authentication resolved, not blanket source/owner approval: official SEC200,39facts/38rows/261numeric cells and retained2025-02-19T21:39:37Z acceptance. Separate current identity/UI assessment; original frozen model, source declarations and domain unchanged.",
        "economic_limits": "2.9773550346% closed-reserve conditional depletion against disclosed151494m PV10; seven sensitivities3roots/4no-root and six zero accounts. Not whole equity, market-implied decline, FCFE or certified replacement inverse. Location report5operating/1construction/5contextual EIA prices; actualIssuerResult=null/0qualified issuer cash bridges. Real companyProjection expense/WC integration tested synthetically only; Scope2 is not directly taxed.",
        "adverse_history": "Initial full1263total/1251pass/11fail/1skip retained, Python not reached. Actual ol-in-p warning/client block-markup repair and24SSR component checks retained; no weakened gate. Prior chronology adverse partial remains; Gordon primary.",
        "preservation": "63/235/2 all300 unchanged; original1000/1001 and fixed29 unchanged; all14 FaIR pins/14 frozen negatives preserved. Optional PostgreSQL skip explicit; separate isolated PostgreSQL does not accept deployed PostgreSQL. No newly qualified calibration/economic pairs or scientific/owner acceptance.",
        "previous_release_boundary": {
            "implementation_public": "b801777f4d8f018f510a4e74b24608235ec456cc",
            "documentation_public": "567f6062e8e1e4740eb9126aebd9d692f80e2642",
            "local_terminal": "ad8eccd363be92d354e03596cf046038594b04da",
        },
        "native_behavior_limit": "No production native candidate GET or browser execution. New economic routes explicitly do not persist and were actually executed/read back; do not confuse these with native retention or a qualified issuer cash bridge.",
        "custom_domain_observation": "No domain request/change; prior non-JSON custom-domain observation remains historical/unresolved, outside service-domain claim.",
        "remaining_dependencies": [rows[key]["next_action"] for key in IDS] + ledger["current_release"]["remaining_dependencies"],
        "documentation_boundary": "Subsequent docs/receipt-only source is distinct from independently measured implementation/public code. A later docs-only publication/runtime is recorded separately in a terminal local receipt, never recursively rewritten into this implementation measurement.",
        "scope": "Four original clauses remain partial; no scientific/owner/source blanket approval, new qualified pair or completion promotion. Existing CI promotion only; no dispatch/cancel/new monitoring/native GET/domain/public writes/production mutation/auth/config/resources/callback.",
    }
    ledger.setdefault("release_history", []).append(ledger["current_release"])
    ledger["current_release"] = release
    increment["verified_release"] = release
    increment["runtime"] = release["runtime"] + " " + release["native_behavior_limit"]
    ledger["updated_at"] = live["verifiedAt"]
    for key in IDS:
        rows[key]["economic_bridge_increment"]["verified_code_release"] = {
            "workspace_source": SOURCE, "public_runtime": PUBLIC, "ci": release["ci"],
            "railway": railway["id"], "scientific_acceptance": False,
            "actual_new_economic_readbacks": True, "actual_qualified_issuer_cash_bridge": False,
        }
    headline = (
        "## Current verified economic-bridge code release — 2026-11-12\n\n"
        f"Implementation `{SOURCE}` → public/runtime `{PUBLIC}`; CI `{ci['run']}` "
        f"validate/promote success; Railway `{railway['id']}` SUCCESS. Actual exact build-info/health200. "
        "**All six new nonpersisting economic API/JSON/XLSX routes executed and read back**, including "
        "complete current-output identities, source authentication assessment, literal spreadsheet content and download manifests.\n\n"
        "**63 verified /235 partial /2 provisioning-blocked; all300 unchanged.** "
        "S13-001/S13-002/S13-005/S12-005 remain partial;0 newly qualified pairs/scientific acceptance. "
        f"{release['source_assessment']}\n\n{release['economic_limits']}\n\n"
        "Retained local coherent full gate **1272TS/1271pass/0fail/1optionalPGskip +255Python pass**, "
        "all original and new mandatory private gates/typecheck/build passed. These are local counts, "
        "not CI counts. Exact command and receipt/log hashes recorded below. "
        f"{release['adverse_history']} {release['preservation']}\n\n"
        f"{release['native_behavior_limit']} {release['custom_domain_observation']}\n\n"
        f"{release['documentation_boundary']} Prior code b801777/docs567f606/localad8eccd receipts retained. "
        "Existing DEV screenshot normal initial viewport only; new panels independently covered by24SSR checks, "
        "not visually verified below fold. No workflow restart by this worker.\n\n"
        f"Safe runtime receipt `{args.receipt}` SHA256 `{release['receipt_sha256']}`; "
        f"full log SHA256 `{execution['log_sha256']}`. Earlier runtime statements below are historical.\n\n"
    )
    ledger["restart"]["instruction"] = headline + ledger["restart"]["instruction"]
    module("completion-ledger").render(ledger)
    matrix = module("merge-clause-reconciliation").matrix(ledger)
    (ROOT / "docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(headline + matrix)
    report = ROOT / "docs/WORKPLAN_IMPLEMENTATION_REPORT.md"
    report.write_text(headline + "### Exact observed economic code release\n\n" +
                      json.dumps(release, indent=2) + "\n\n" + report.read_text())
    print(json.dumps(release, indent=2))


if __name__ == "__main__":
    main()
