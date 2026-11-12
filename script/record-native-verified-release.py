#!/usr/bin/env python3
"""Record an observed gated release; never deploy, test, approve or call back."""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "script" / f"{name}.py")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--receipt", required=True)
    args = parser.parse_args()
    path = ROOT / args.receipt
    observed = json.loads(path.read_text())
    source = "4822023fcdd5ae539150856749bad6fc778dc564"
    public = "d75e183a5be95b4fca5cfb97f083362b41c1516e"
    if observed["workspace_source"] != source or observed["public_source"] != public:
        raise ValueError("Unexpected source identity")
    if observed["ci"]["conclusion"] != "success" or any(
        job["conclusion"] != "success" for job in observed["ci"]["jobs"]
    ):
        raise ValueError("Both existing CI validation and promotion must succeed")
    if observed["production_validated"] != public:
        raise ValueError("Validated deployment branch does not identify source")
    if observed["railway"]["status"] != "SUCCESS" or observed["railway"]["source_commit"] != public:
        raise ValueError("Railway success does not identify source")
    checks = {check["path"]: check for check in observed["read_only_checks"]}
    if checks["/api/build-info"]["body"]["sourceCommit"] != public:
        raise ValueError("Actual build identity mismatch")
    if checks["/api/health"]["status"] != 200:
        raise ValueError("Actual health check failed")
    ledger = json.loads((ROOT / "docs/workplan_completion_ledger.json").read_text())
    criteria = {r["id"]: r for s in ledger["stages"] for r in s["requirements"]}
    counts = dict(Counter(r["status"] for r in criteria.values()))
    if len(criteria) != 300 or counts != {
        "verified": 61, "partial": 237, "blocked-production-provisioning": 2
    }:
        raise ValueError("Original census or reconciled criterion counts changed")
    increment = ledger["latest_increment"]["native_mechanism_finite_reconciliation"]
    if increment["full_counts"] != {
        "typescript": {"tests": 1188, "pass": 1187, "fail": 0, "skipped": 1},
        "python": {"tests": 255, "pass": 255, "fail": 0, "skipped": 0},
    } or increment["full_gate_passed"] is not True:
        raise ValueError("Required retained parent full-gate evidence changed")
    execution_path = ROOT / increment["full_receipt"]
    execution = json.loads(execution_path.read_text())
    if execution["exit_code"] != 0 or hashlib.sha256(
        (ROOT / execution["log"]).read_bytes()
    ).hexdigest() != execution["log_sha256"]:
        raise ValueError("Retained parent execution receipt failed authentication")
    release = {
        "workspace_commit": source,
        "github_main": public,
        "production_validated": observed["production_validated"],
        "ci": f'{observed["ci"]["run"]} validate/promote success',
        "ci_url": observed["ci"]["url"],
        "ci_steps": "Existing public TypeScript/Python, typecheck and build steps succeeded. CI counts/logs not inspected; local counts and private checks are not CI counts.",
        "railway_deployment": observed["railway"]["id"],
        "railway_status": "SUCCESS",
        "railway_completed_at": observed["railway"]["updated_at"],
        "verified_at": observed["verified_at"],
        "build_info_source_commit": public,
        "health": 200,
        "runtime": observed["runtime_scope"],
        "verified_base": observed["base"],
        "static_artifact": observed["static_artifact"],
        "custom_domain_observation": observed["custom_domain_observation"],
        "receipt": args.receipt,
        "receipt_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "local_execution": {
            "receipt": increment["full_receipt"],
            "receipt_sha256": hashlib.sha256(execution_path.read_bytes()).hexdigest(),
            "log_sha256": execution["log_sha256"],
            "counts": increment["full_counts"],
            "private_checks": "Original choice/width document, monetary integration, issuer cashflow and issuer reconciliation passed in the retained parent full command; no duplicate execution.",
        },
        "separate_local_postgresql": increment["separate_local_postgresql"],
        "scientific_acceptance": False,
        "counts": counts,
        "finite_engineering_criteria": ["S05-004", "S05-010", "S06-006", "S07-020"],
        "native_behavior_limit": "Native candidate GET retains analysis records as normal app behavior. It was NOT called in production, including via a dashboard screenshot. Exact hosted code identity and static native-v3 client artifact were checked read-only; no claim of live native numerical/retention execution.",
        "remaining_dependencies": [
            "Source-qualified regional generation-share saturation K, complete compatible vintage/rights panel, reviewed whole-draw joint law/dependence and genuine prefit receipt; no new qualified calibration or joint bundle.",
            "Approved native joint distribution/inventory, empirical mechanism calibration and curated-to-regional central bridge; adapter readiness is not an actual accepted Phase VI dataset or production ensemble.",
            "FSLR actual India/Alabama cash reconciliation and component/cohort eligibility/material/PFE evidence; NEE gross dated LLC cash waterfall and marginal commissioning economics; XOM executed priced transport/storage, serviced quantities, collections and own funding waterfall.",
            "No newly qualified operating-FCFE economic pairs or dated11-15 preparation/valuation runs; scientific efficacy, authorized retained-report publication and independent owner acceptance remain absent.",
            "Two original production-provisioning clauses remain blocked; separate isolated local PostgreSQL success does not accept deployed PostgreSQL.",
            "Custom-domain API paths returned identical non-JSON HTML, not this verified Railway API; owner/platform routing investigation remains, with no domain/DNS/config changes authorized or made.",
        ],
        "documentation_boundary": "This subsequent local documentation/receipt script is distinct from implementation workspace source and verified public/runtime source. Any docs-only export through existing sync is a later revision, not this measured runtime.",
        "scope": "61 verified finite engineering /237 partial /2 provisioning-blocked; all300 original clauses retained. Four exact finite engineering criteria only; scientific/source/owner acceptance remains unpromoted. No manual CI bypass, dispatch, new monitoring, privileged POST, production mutations, data activation, callback, frozen negative protocol or14FaIR-pin changes.",
    }
    if ledger["current_release"].get("github_main") != public:
        ledger.setdefault("release_history", []).append(ledger["current_release"])
    ledger["current_release"] = release
    increment["verified_release"] = release
    increment["runtime"] = release["native_behavior_limit"]
    ledger["updated_at"] = observed["verified_at"]
    for clause in release["finite_engineering_criteria"]:
        criteria[clause]["native_increment_reconciliation"]["verified_code_release"] = {
            "workspace_source": source, "public_runtime": public,
            "ci": release["ci"], "railway": release["railway_deployment"],
            "native_execution_boundary": release["native_behavior_limit"],
            "scientific_acceptance": "not-promoted",
        }
    ledger["restart"]["instruction"] = (
        f"Verified native-v3 CODE release {public}, CI {observed['ci']['run']}, "
        f"Railway {release['railway_deployment']} SUCCESS and actual build-info/health. "
        "Native production GET intentionally NOT executed because it retains records; no numerical runtime claim. "
        "Parent full gate1188TS/1187pass/0fail/1optionalPGskip +255Python and mandatoryprivate checks passed; "
        "separate isolated PostgreSQL success is independent, never subtract the skip. "
        "61verified/237partial/2blocked; four finite engineering criteria only, science unaccepted. "
        "Prior incomplete/failed receipts retained. No callback. "
    ) + ledger["restart"]["instruction"]
    module("completion-ledger").render(ledger)
    headline = (
        "## Current verified native-v3 code release — 2026-11-12\n\n"
        f"Workspace implementation `{source}`; public/runtime `{public}`; "
        f"CI `{observed['ci']['run']}` validate/promote success; "
        f"Railway `{release['railway_deployment']}` SUCCESS; actual build-info exact and health200.\n\n"
        "**61 verified finite engineering /237 partial /2 provisioning-blocked; all300 original clauses.** "
        "Only S05-004/S05-010/S06-006/S07-020 finite engineering criteria reconciled. "
        "**Scientific/source/owner acceptance remains unpromoted.**\n\n"
        "Retained parent full gate: **1188 TypeScript tests,1187pass,0fail,1optional PostgreSQL skip; "
        "255Python pass** plus mandatory original choice/width, monetary and issuer private checks, "
        "typecheck and build. CI job/step success is independently observed; these counts are local, not CI counts. "
        "Separate actual isolated PostgreSQL succeeded (company311 queries/8analytical receipts; "
        "namespace12queries/5receipts), not production PostgreSQL acceptance and not removal of the full-suite skip. "
        "All prior failed/incomplete receipts and14FaIR/frozen-negative pins remain preserved.\n\n"
        f"{release['native_behavior_limit']}\n\n"
        "Verified runtime base: `https://dashboard-production-4d39.up.railway.app`. "
        "Custom domain `https://climatetracking.live` returned200 identical non-JSON HTML on API paths, "
        "not successful API checks; custom-domain routing is unverified and requires owner/platform investigation. "
        "No DNS/domain/config changes were made.\n\n"
        f"{release['documentation_boundary']}\n\n"
        "Older local-only/runtime statements below remain historical observations, superseded for code deployment "
        "only by this verified release. Remaining science/source/data/owner dependencies are not closed.\n\n"
    )
    matrix = module("merge-clause-reconciliation").matrix(ledger)
    (ROOT / "docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(headline + matrix)
    report = ROOT / "docs/WORKPLAN_IMPLEMENTATION_REPORT.md"
    report.write_text(headline + "### Exact verified release receipt\n\n" +
                      json.dumps(release, indent=2) + "\n\n" + report.read_text())
    print(json.dumps(release, indent=2))


if __name__ == "__main__":
    main()
