#!/usr/bin/env python3
"""Record observed code deployment, never deploy or execute a production model."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "d520594d27f1ecd3c939cdc49757cd049866d989"
PUBLIC = "b801777f4d8f018f510a4e74b24608235ec456cc"


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
    if observed["workspace_source"] != SOURCE or observed["public_source"] != PUBLIC:
        raise ValueError("Unexpected code source")
    ci = observed["ci"]
    if ci["head_sha"] != PUBLIC or ci["conclusion"] != "success":
        raise ValueError("Existing source CI has not succeeded")
    if {j["name"]: j["conclusion"] for j in ci["jobs"]} != {
        "validate": "success", "promote": "success"
    } or observed["production_validated"] != PUBLIC:
        raise ValueError("Existing validation/promotion not verified")
    railway = observed["railway"]
    if railway["status"] != "SUCCESS" or railway["source_commit"] != PUBLIC:
        raise ValueError("Railway actual source not successful")
    checks = {c["path"]: c for c in observed["read_only_checks"]}
    if checks["/api/build-info"]["body"]["sourceCommit"] != PUBLIC:
        raise ValueError("Actual served code source mismatch")
    expected = {
        "/api/build-info": 200, "/api/health": 200,
        "/api/research/paired-research/catalog": 200,
        "/api/research/paired-research/catalog?source=unapproved": 400,
        "/api/research/paired-research": 400,
        "/api/development/qualified-missingness": 403,
        "/api/development/qualified-missingness/export": 403,
        "/api/analysis/results/" + "0" * 64 + "/prospective-exports": 403,
    }
    if {p: checks[p]["status"] for p in expected} != expected or any(
        checks[p]["cache_control"] != "no-store" or checks[p]["attachment"]
        or checks[p]["producer_binding"] for p in expected
    ):
        raise ValueError("Safe read-only runtime contracts failed")
    catalog = checks["/api/research/paired-research/catalog"]["body"]
    if catalog["reports"] or catalog["scientificAcceptance"] or catalog["investmentEvidence"]:
        raise ValueError("Unexpected qualified catalog/acceptance")
    if not all(observed["static_artifact"]["labels"].values()):
        raise ValueError("Served counterfactual labels missing")
    ledger = json.loads((ROOT / "docs/workplan_completion_ledger.json").read_text())
    rows = {r["id"]: r for s in ledger["stages"] for r in s["requirements"]}
    counts = dict(Counter(r["status"] for r in rows.values()))
    if len(rows) != 300 or counts != {
        "verified": 63, "partial": 235, "blocked-production-provisioning": 2
    } or rows["S11-041"]["status"] != "partial":
        raise ValueError("Original census/adverse chronology changed")
    increment = ledger["latest_increment"]["original_counterfactual_reconciliation"]
    execution = json.loads((ROOT / increment["full_receipt"]).read_text())
    if execution["exit_code"] != 0 or sha(execution["log"]) != execution["log_sha256"]:
        raise ValueError("Parent full-gate receipt/log mismatch")
    if execution["suite_counts"] != {
        "typescript": {"tests": 1199, "pass": 1198, "fail": 0, "skipped": 1},
        "python": {"tests": 255, "pass": 255, "fail": 0, "skipped": 0},
    } or execution["command"] != module("workplan-evidence-run").FULL_CHECK_COMMAND:
        raise ValueError("Full command/counts changed; private chronology must remain mandatory")
    release = {
        "workspace_commit": SOURCE, "github_main": PUBLIC,
        "production_validated": observed["production_validated"],
        "ci": f'{ci["run"]} validate/promote success', "ci_url": ci["url"],
        "ci_steps": "Existing public TS/Python/typecheck/build step metadata succeeded; no CI logs/counts inspected. Mandatory private checks are local, not public CI counts.",
        "railway_deployment": railway["id"], "railway_status": railway["status"],
        "railway_completed_at": railway["updated_at"],
        "verified_at": observed["verified_at"], "build_info_source_commit": PUBLIC,
        "health": 200, "verified_base": observed["base"],
        "runtime": observed["runtime_scope"], "static_artifact": observed["static_artifact"],
        "receipt": args.receipt, "receipt_sha256": sha(args.receipt),
        "local_execution": {
            "receipt": increment["full_receipt"], "receipt_sha256": sha(increment["full_receipt"]),
            "log_sha256": execution["log_sha256"], "counts": execution["suite_counts"],
            "private_checks": "All unchanged mandatory original choice/width, historical valuation chronology, monetary integration, issuer cashflow and reconciliation validators passed, plus typecheck/build. No duplicate execution.",
        },
        "counts": counts, "finite_engineering_criteria": ["S05-009", "S08-003"],
        "scientific_acceptance": False, "newly_qualified_pairs": 0,
        "chronology": "S11-041 remains partial/adverse: earliest retained ANY-result candidate precedes rule commit by356568ms; weak mtime, exact executing revision/first-ever result unknown. Later paired ordering does not repair it; Gordon primary, reverse DCF unpromoted.",
        "portability": "Public source-only chronology and negative-control checks passed; authentic historical assertions retained verbatim in unconditional mandatory private validator. Exported history is not historical Git proof.",
        "preservation": "All300 clauses; original1000/1001 bindings; all14 FaIR pins and14 frozen negative files unchanged. Failed/incomplete receipts retained. Separate isolated local PostgreSQL success does not remove full-suite optional skip or accept deployed PostgreSQL.",
        "native_behavior_limit": "No production native candidate GET, browser execution or numerical calculation/retention run. HTML/JS fetched as bytes only; labels and exact build SHA verified, not live numerical API behavior.",
        "custom_domain_observation": "Not probed this run; prior custom-domain non-JSON routing observation remains historical/unresolved. No domain/DNS/native GET/config mutation.",
        "remaining_dependencies": ledger["current_release"]["remaining_dependencies"],
        "documentation_boundary": "This subsequent documentation/receipt revision is separate from implementation source and observed public/runtime code. A later docs-only sync is not the runtime measured by this receipt; no recursive release-receipt promotion claims.",
        "scope": "63 verified finite engineering /235 partial /2 provisioning-blocked; science/source/owner acceptance unpromoted. Zero newly qualified calibration/economic pairs. No dispatch/rerun/cancel/new monitoring/production mutation/callback.",
    }
    ledger.setdefault("release_history", []).append(ledger["current_release"])
    ledger["current_release"] = release
    increment["verified_release"] = release
    increment["runtime"] = release["native_behavior_limit"]
    ledger["updated_at"] = observed["verified_at"]
    for clause in ("S05-009", "S08-003"):
        rows[clause]["original_counterfactual_reconciliation"]["verified_code_release"] = {
            "workspace_source": SOURCE, "public_runtime": PUBLIC,
            "ci": release["ci"], "railway": railway["id"],
            "scientific_acceptance": False, "numerical_runtime_executed": False,
        }
    headline = (
        "## Current verified boundary/counterfactual code release — 2026-11-12\n\n"
        f"Implementation workspace `{SOURCE}` → public/runtime `{PUBLIC}`. "
        f"Existing CI `{ci['run']}` validate/promote succeeded; Railway `{railway['id']}` SUCCESS. "
        "Actual build-info exact SHA and health200; safe catalog200 empty, override/missing-pins400, "
        "private missingness/export/prospective-export403, all no-store/no attachment/no producer binding. "
        "Served JS contains exact global-intensity counterfactual title/question/claim/labels and native-v3 identifier.\n\n"
        "**63 verified finite engineering /235 partial /2 provisioning-blocked; all300 original clauses.** "
        "S05-009/S08-003 exact finite clauses only; **scientific/source/owner acceptance unpromoted; "
        "0 newly qualified calibration/economic pairs.**\n\n"
        "Local coherent full gate: **1199 TypeScript total/1198pass/0fail/1optional PostgreSQL skip; "
        "255Python/255pass**, all mandatory private validators including unconditional historical chronology, "
        "typecheck/build passed. CI job/step metadata success is separate, not these local counts. "
        "All adverse/failed/incomplete receipts retained; separate isolated PostgreSQL evidence never removes "
        "the skip or accepts deployed PostgreSQL. All14 FaIR pins/frozen-negative protocols preserved.\n\n"
        f"{release['chronology']} {release['portability']}\n\n"
        f"{release['native_behavior_limit']} {release['custom_domain_observation']}\n\n"
        f"{release['documentation_boundary']} Existing DEV /methodology screenshot rendered normally; "
        "initial viewport only, not production model execution. No workflow restart by this recorder.\n\n"
        f"Safe exact runtime receipt: `{args.receipt}` SHA256 `{release['receipt_sha256']}`. "
        f"Local full log SHA256 `{execution['log_sha256']}`. Older statements below are historical; "
        "remaining science/source/issuer/production/owner dependencies are not closed.\n\n"
    )
    ledger["restart"]["instruction"] = headline + ledger["restart"]["instruction"]
    module("completion-ledger").render(ledger)
    matrix = module("merge-clause-reconciliation").matrix(ledger)
    (ROOT / "docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(headline + matrix)
    report = ROOT / "docs/WORKPLAN_IMPLEMENTATION_REPORT.md"
    report.write_text(headline + "### Exact observed release\n\n" + json.dumps(release, indent=2)
                      + "\n\n" + report.read_text())
    print(json.dumps(release, indent=2))


if __name__ == "__main__":
    main()
