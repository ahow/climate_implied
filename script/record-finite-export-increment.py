"""Record finite engineering evidence without changing any original criterion.

Optional SHA/CI/deployment arguments require an already observed, matching runtime
receipt. They never manufacture release success, health, or publication authority.
"""
import datetime
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

LEDGER = Path("docs/workplan_completion_ledger.json")
OUTPUTS = ["docs/workplan_completion_ledger.json", "docs/WORKPLAN_ACCEPTANCE_MATRIX.md",
           "docs/WORKPLAN_IMPLEMENTATION_REPORT.md"]
EXPORT = "docs/remaining-export-evidence.json"
STUDY = "docs/regional-diffusion-uncertainty-evidence.json"
RUNTIME = "docs/finite-export-runtime-receipts.json"
RECEIPT = "generated-artifacts/remaining-export-all22.ready.receipt.json"


def read(path):
    return json.loads(Path(path).read_text())


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def contract(ledger):
    return [{key: requirement.get(key) for key in ("id", "requirement", "source_section", "origin")}
            for stage in ledger["stages"] for requirement in stage["requirements"]]


x, export, study, receipt = read(LEDGER), read(EXPORT), read(STUDY), read(RECEIPT)
original_contract = contract(x)
original_statuses = {q["id"]: q["status"] for s in x["stages"] for q in s["requirements"]}
assert receipt["exit_code"] == 0 and receipt["canonical_ledgers_modified"] is False
assert receipt["suite_counts"]["typescript"] == {"tests": 1089, "pass": 1089, "fail": 0, "skipped": 0}
assert receipt["suite_counts"]["python"] == {"tests": 248, "pass": 248, "fail": 0, "skipped": 0}
assert digest(receipt["log"]) == receipt["log_sha256"]
assert export["matrixCounts"]["implementedThisIncrement"] == 22
assert len(export["centralHandlerMatrix"]) + len(export["customHandlerMatrix"]) == 29
for path, expected in export["frozenSourceHashes"].items():
    assert digest(path) == expected, f"Export source drift: {path}"
for path, expected in study["implementationHashes"].items():
    if path.endswith(".py"):
        assert digest(path) == expected, f"Regional uncertainty source drift: {path}"

now = datetime.datetime.now(datetime.timezone.utc).isoformat()
release = {"status": "New local source validated; new release not yet observed",
           "last_verified": x["current_release"]}
if len(sys.argv) not in (1, 4):
    raise SystemExit("Use no arguments, or verified source SHA / CI run ID / Railway deployment ID")
if len(sys.argv) == 4:
    observed = read(RUNTIME)["latest"]
    sha, ci, deployment = sys.argv[1:]
    assert observed["sourceCommit"] == sha
    assert str(observed["ci"]) == ci and observed["ciConclusion"] == "success"
    assert observed["railwayDeployment"] == deployment and observed["railwayStatus"] == "SUCCESS"
    assert observed["health"] == 200 and observed["observedAt"]
    release = {"github_main": sha, "ci": ci, "railway_deployment": deployment,
               "verified_at": observed["observedAt"], "health": observed["health"],
               "scope": "Observed code only; no issuer/science/source approval/private HTTP activation."}
    if x["current_release"] != release:
        x.setdefault("release_history", []).append(x["current_release"])
        x["current_release"] = release

changed = set(OUTPUTS)
for args in (["git", "diff", "--name-only", "128cafe", "HEAD"],
             ["git", "diff", "--name-only"],
             ["git", "ls-files", "--others", "--exclude-standard"]):
    changed.update(subprocess.check_output(args, text=True).splitlines())
summary = {
    "updated_at": now, "release": release, "execution": receipt,
    "execution_receipt": {"path": RECEIPT, "sha256": digest(RECEIPT)},
    "finite_export_counts": export["matrixCounts"], "runtime_receipts": RUNTIME,
    "changed_paths_since_handoff": sorted(changed), "sources": [EXPORT, STUDY],
    "failure_history": export["tests"]["failedFullChecksPreserved"],
    "source_and_acceptance_boundary": "Finite28engineering-closed+1private HTTP403. Existing manifests/claim labels and generated registry sections are implemented; no fabricated producer identity under unavailable persistence. No live new-code verification inferred from local tests.",
    "scientific_decision": "Regional joint uncertainty implementation tested on synthetic engineering fixtures only; zero actual new candidate fits/bootstrap/heldout scores. No new issuer source, issuer model insertion, accepted calibration, historical efficacy, publication permission or owner acceptance."
}
gaps = {
    "S16-007": (
        "Original written criterion remains unchanged: registry-generated methodology and a manifest/claim label on every download. "
        "Finite engineering inventory now28closed+1unauthorized privateHTTP403, including all22previously unimplemented contracts; no remaining finite producer-code/derivation gap is called an external data blocker. "
        "Default public custom bytes preserve compatibility with manifest/claim headers; embedded metadata is opt-in. Ordinary exports may honestly have null producer identity when retained storage/source material is unavailable; identity is not the UI selection. "
        "Original clause remains partial pending new-code deployed verification of registry-linked pages and representative actual completed default/embedded downloads across available contexts, plus genuinely authorized/provisioned contexts where required. "
        "This is a live-verification/availability boundary, not a demand for independent model validation added to the written criterion. No private auth bypass, recovered original XLSX, original-history or scientific acceptance claim; old124/179/416 immutable. "
        "Remaining original1000/1001 cohort gaps and other clauses are not promoted by this finite engineering increment."
    ),
    "S04-001": (
        "Point-only limitation is superseded by implemented guarded joint uncertainty code: fixed9train/6holdout,1000circular-block3 replications, seed20261108, shared annual indices, jointly refitted logit intercept/slope and source-authored hash-bound joint training/K/structural-offset draws; fixed ten-family Holm diagnostics are supplemental, not original acceptance. "
        "Twenty-two synthetic engineering tests and retained-study regression tests pass. Actual execution remains UNEXECUTED: zero qualified regional saturation priors/joint source bundles, zero new actual candidate fits/bootstrap/heldout scores. "
        "Need independently sourced regional generation-share ceilings and authenticated, reviewed source/structural/dependence law/numerical draws plus original input/vintage/holdout gates; no arbitrary priors, independent marginal synthesis, default zero offsets, shortened windows, MW/shipments ceilings or release splicing. "
        "Retain all nine original baseline failures and EU-solar point win only. Original EV/heat-pump/storage technology-specific source/window/interval and acceptance gaps remain; no scientific/central/owner promotion."
    )
}
evidence = {"S16-007": (EXPORT, export), "S04-001": (STUDY, study)}
for stage in x["stages"]:
    for requirement in stage["requirements"]:
        if requirement["id"] not in evidence:
            continue
        path, detail = evidence[requirement["id"]]
        old = requirement.get("finite_export_diffusion_increment")
        if old and old.get("evidence", {}).get("sha256") != digest(path):
            history = requirement.setdefault("finite_export_diffusion_increment_history", [])
            if old not in history:
                history.append(old)
        requirement["finite_export_diffusion_increment"] = {
            **summary, "evidence": {"path": path, "sha256": digest(path), "detail": detail}}
        requirement["behaviour_delivered_this_run"] = (
            "Clause-local exact producer/source/formulas/tests/failure history and current versus live-release boundary recorded; original criterion and partial status preserved.")
        requirement["remaining_gaps"] = [gaps[requirement["id"]]]
        requirement["next_action"] = gaps[requirement["id"]]
        requirement["executions"] = requirement.get("executions") or []
        if receipt not in requirement["executions"]:
            requirement["executions"].append(receipt)
        for item in (path, RECEIPT):
            if item not in requirement.setdefault("existing_evidence", []):
                requirement["existing_evidence"].append(item)

x.setdefault("latest_increment", {})["finite_exports_and_diffusion"] = summary
x["updated_at"] = now
x["restart"]["unfinished_requirement_ids"] = [
    q["id"] for s in x["stages"] for q in s["requirements"] if q["status"] != "verified"]
x["restart"]["next_requirement"] = "S16-007 finite code ready, verify deployed available contexts; S04-001 authenticate sourced regional priors/joint uncertainty draws; preserve all other original partial scope"
x["restart"]["instruction"] = (
    "Continue ALL original0–17, no plan/package pause. Finite29now28engineering-closed+1privateHTTP403; all22remaining contracts implemented, prior6and9PE/signal preserved. "
    "Exact manifests/claim labels/registry pages are the S16-007 criterion; local engineering is not deployed evidence. Use existing validated promotion only, inspect actual contexts without auth bypass/production mutations; do not fabricate retained identity under source/archive outage. "
    "Preserve original1000/1001, old124/179/416,14FaIRpins,0eligiblehistories/0of3issuer cases and all scientific/owner gates. "
    "Regional uncertainty is now implemented but actual execution UNEXECUTED: zero qualified saturation/joint bundles and zero actual fits/bootstrap/scores; authentic full source/structural/dependence numerical draws required. No retuning known nine failures or EUsolar pointwin, priors, splicing or default offsets. "
    "No new issuer source or model work claimed; preserve existing FSLR/NEE/XOM exact economic-input gaps and every other partial original clause. "
    "Latest local1089TS/248Python plus original/private/type/build receipt is engineering only. Distinguish source, CI, Railway release and docs observation revisions; runtime receipts must be observed before recording release success.")
assert contract(x) == original_contract
assert {q["id"]: q["status"] for s in x["stages"] for q in s["requirements"]} == original_statuses
LEDGER.write_text(json.dumps(x, indent=2, ensure_ascii=False) + "\n")
spec = importlib.util.spec_from_file_location("merge", "script/merge-clause-reconciliation.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
Path(OUTPUTS[1]).write_text(module.matrix(x))
report = Path(OUTPUTS[2])
previous_report = report.read_text()
if previous_report.startswith("# Finite export contracts and guarded regional joint uncertainty"):
    previous_report = previous_report.split("\n```\n\n", 1)[1]
report.write_text("# Finite export contracts and guarded regional joint uncertainty — engineering increment\n\n"
                  "Original criteria/statuses preserved; no new issuer source or actual diffusion efficacy execution.\n\n```json\n"
                  + json.dumps(summary, indent=2) + "\n```\n\n" + previous_report)
