#!/usr/bin/env python3
"""Finite, resumable execution of the workplan's available verification jobs.

This executes existing implementations, not an autonomous code-writing agent.
Open acceptance requirements remain open even when every command passes.
"""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "generated-artifacts" / "workplan"


def ts(*names):
    return ["npx", "tsx", "--test", *[f"script/{name}.test.ts" for name in names]]


# Acceptance gaps are deliberately separate from executable regression checks.
# Do not delete a gap merely because a command exits successfully.
STAGES = [
    ("Baseline and safety", [ts("release-safety", "read-safety"), ["npm", "run", "check"]],
     "Production recovery rehearsal, single scheduler ownership and deliberate failing-commit CI gate test; validated-branch promotion is implemented."),
    ("Output register", [ts("public-valuation-contract", "ui-claims", "export-contract", "output-register")],
     "Complete inventory of all output consumers and exports."),
    ("Immutable inputs", [ts("snapshot-contract", "analysis-manifest", "request-overrides")],
     "Persistent overlays, all reader migration, production provisioning, historical selector and full import/isolation acceptance."),
    ("Driver evidence", [ts("driver-evidence")],
     "Complete source, units, uncertainty and vintage evidence for every intended quantitative driver."),
    ("Driver calibration", [["uv", "run", "python", "-m", "unittest", "script/test_driver_calibration.py", "script/test_electricity_demand.py", "script/test_demand_predictive_validation.py"]],
     "Remaining driver fits and validated joint uncertainty; demand predictive/break diagnostics implemented, not promoted."),
    ("Emissions ensemble", [ts("emissions-candidate", "calculation-foundations", "regional-land", "ensemble-convergence", "regional-engine", "regional-sampling")],
     "Actual region/sector/gas model, overlap accounting and 10,000-member convergence."),
    ("Reference pathways", [ts("reference-scenarios", "native-pathway-contract"),
        ["uv", "run", "python", "-m", "unittest", "script/test_ngfs_assessment.py",
         "script/test_ngfs_pathway_adapter.py", "script/test_pathway_gap_sensitivity.py"]],
     "Complete compatible policy/commitment source coverage and missing-gas sensitivity."),
    ("Climate response", [ts("ensemble", "workplan-corrections", "member-metrics", "ensemble-convergence"),
        ["uv", "run", "python", "-m", "unittest", "script/test_fair_native_bridge.py"]],
     "Independent modern FaIR reference, updated historical forcing and integrated coherent censored ensemble outputs."),
    ("Regional attribution", [ts("research-blocks", "member-attribution")],
     "Real regional emissions ledgers and warming attribution with error bounds; helper tests are not regional results."),
    ("Historical skill", [ts("historical-validation", "vintage-audit")],
     "Archived-vintage evidence and actual frozen short-horizon climate evaluation."),
    ("Company inputs", [ts("isin", "financial-identity", "financial-mapping", "financial-review", "statement-history", "minor-currencies")],
     "Evidence-reviewed full-universe identities, lifecycle, financial histories and currency reconciliation."),
    ("Valuation comparison", [ts("cash-flow-valuation", "valuation-solver", "valuation-integrity", "valuation-statistics", "valuation-comparison", "completed-cash-flow")],
     "Empirical common-sample D8 comparison and actual company model coverage."),
    ("Company projections", [ts("workplan-corrections", "company-projection", "company-baseline")],
     "Evidence-based activity, climate, margin and cost mappings with worked-company validation."),
    ("Scenario identification", [ts("workplan-corrections")],
     "Actual defensible valuation/activity mappings and public assumption registry; market-expectation identification remains unproven."),
    ("Paired signal research", [ts("signal-research", "evaluation", "research-blocks", "research-family")],
     "New valuation-gap data, frozen full testing family and actual paired outcomes. Old intensity study is not this stage."),
    ("Portfolio research", [ts("long-short", "backtest-costs", "walk-forward")],
     "Actual historical portfolios, borrow/FX/dividend/lifecycle evidence and sensitivity comparisons."),
    ("Interface integration", [ts("ui-claims", "public-valuation-contract"), ["npm", "run", "build"]],
     "Full UI/API/export consistency and historical-selection/approval propagation acceptance."),
    ("Final acceptance", [ts("handover"),
        ["uv", "run", "python", "-m", "unittest", "discover", "-s", "script", "-p", "test_*.py"]],
     "Clean-environment reproduction, independent acceptance and release reconciliation after remaining implementation."),
]

# These are opt-in read-only data checks, not provider-paid collection,
# approvals, migrations or production writes.
DATA_CHECKS = {
    4: [["uv", "run", "python", "script/driver_calibration.py"],
        ["uv", "run", "python", "script/electricity_demand_calibration.py"],
        ["uv", "run", "python", "script/demand_predictive_validation.py"]],
    9: [["npx", "tsx", "script/audit-existing-vintages.ts"]],
    10: [["npx", "tsx", "script/financial-coverage.ts"]],
}


def fingerprint():
    digest = hashlib.sha256()
    for directory in ("server", "shared", "client", "script", "docs"):
        for path in sorted((ROOT / directory).rglob("*")):
            if path.is_file() and "__pycache__" not in path.parts:
                digest.update(str(path.relative_to(ROOT)).encode())
                digest.update(path.read_bytes())
    for name in ("package.json", "package-lock.json", "uv.lock", "pyproject.toml"):
        path = ROOT / name
        if path.exists():
            digest.update(name.encode())
            digest.update(path.read_bytes())
    return digest.hexdigest()


def atomic_json(path, data):
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(data, indent=2) + "\n")
    temporary.replace(path)


def execute(command, logfile, timeout):
    started = time.time()
    environment = os.environ.copy()
    # Existing Python fixtures import sibling analysis modules.
    environment["PYTHONPATH"] = os.pathsep.join(
        [str(ROOT / "script"), environment.get("PYTHONPATH", "")]
    )
    with logfile.open("w") as output:
        process = subprocess.Popen(command, cwd=ROOT, stdout=output,
                                   stderr=subprocess.STDOUT, start_new_session=True,
                                   env=environment)
        try:
            code = process.wait(timeout=timeout)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            os.killpg(process.pid, signal.SIGTERM)
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()
            code = 124
    return {"command": command, "exitCode": code,
            "seconds": round(time.time() - started, 2),
            "status": "passed" if code == 0 else "failed",
            "log": str(logfile.relative_to(ROOT)) if logfile.is_relative_to(ROOT) else str(logfile)}


def render_report(state):
    lines = ["# Automated workplan execution", "",
             f"Run state: **{state['status']}**", "",
             "**This is execution of available checks, not completion of unfinished implementation.**",
             "No scientific approval, production migration, Git push or deployment is performed by this runner.",
             "", "| Stage | Scope | Check result | Implementation acceptance |",
             "|---|---|---|---|"]
    for i, (title, _, gap) in enumerate(STAGES):
        result = state["stages"].get(str(i))
        status = result["status"] if result else "pending"
        lines.append(f"| {i} | {title} | {status} | Incomplete |")
    lines += ["", "## Outstanding acceptance requirements", ""]
    for i, (title, _, gap) in enumerate(STAGES):
        lines.append(f"- **{i} — {title}:** {gap}")
    lines += ["", "Full command results and log paths: `status.json` beside this report.",
              "Failed checks do not stop independent subsequent checks.",
              "Resume reuses passed stages only when the source fingerprint and run options match.", ""]
    temporary = OUTPUT / "report.md.tmp"
    temporary.write_text("\n".join(lines))
    temporary.replace(OUTPUT / "report.md")


def run_stages(state, output, timeout, data_checks, executor=execute, on_change=None):
    for i, (title, commands, gap) in enumerate(STAGES):
        previous = state["stages"].get(str(i), {})
        if previous.get("status") == "passed":
            continue
        record = {"title": title, "status": "running", "acceptance": "incomplete",
                  "outstanding": gap, "checks": []}
        state["stages"][str(i)] = record
        if on_change:
            on_change()
        print(f"Stage {i}: {title}", flush=True)
        for j, command in enumerate(commands + (DATA_CHECKS.get(i, []) if data_checks else [])):
            try:
                check = executor(command, output / f"stage-{i:02d}-{j:02d}.log", timeout)
            except OSError as error:
                check = {"command": command, "status": "failed", "exitCode": None,
                         "error": type(error).__name__}
            record["checks"].append(check)
            if on_change:
                on_change()
        record["status"] = "passed" if all(c["status"] == "passed" for c in record["checks"]) else "failed"
        if on_change:
            on_change()
    state["status"] = "checks-finished-implementation-incomplete"
    if on_change:
        on_change()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--data-checks", action="store_true")
    parser.add_argument("--timeout", type=int, default=900)
    args = parser.parse_args()
    if args.timeout < 1:
        parser.error("timeout must be positive")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with (OUTPUT / "runner.lock").open("w") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            sys.exit("Another workplan runner is already active.")
        source = fingerprint()
        status_file = OUTPUT / "status.json"
        state = {"sourceFingerprint": source, "dataChecks": args.data_checks,
                 "status": "running", "stages": {}, "startedAt": time.time()}
        if args.resume and status_file.exists():
            previous = json.loads(status_file.read_text())
            if previous["sourceFingerprint"] == source and previous["dataChecks"] == args.data_checks:
                state = previous
                state["status"] = "running"
        def save():
            state["updatedAt"] = time.time()
            atomic_json(status_file, state)
            render_report(state)
        save()
        run_stages(state, OUTPUT, args.timeout, args.data_checks, on_change=save)
        print(f"All 18 stages visited. Report: {OUTPUT / 'report.md'}", flush=True)
        # Nonzero distinguishes outstanding acceptance from actual completion.
        return 1 if any(s["status"] == "failed" for s in state["stages"].values()) else 2


if __name__ == "__main__":
    sys.exit(main())
