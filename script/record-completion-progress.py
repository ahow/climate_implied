"""Record the November 9 execution evidence; does not mark unreviewed scope done."""
import importlib.util
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "docs/workplan_completion_ledger.json"
ledger = json.loads(path.read_text())
requirements = {r["id"]: r for s in ledger["stages"] for r in s["requirements"]}
executions = ledger["run_executions"]


def record(ids, behaviour, files, commands, gaps, status="partial"):
    actual = [e for e in executions if any(c in " ".join(e["command"]) for c in commands)]
    for identifier in ids:
        r = requirements[identifier]
        r.update(status=status, origin="existing-plus-this-run",
                 behaviour_delivered_this_run=behaviour,
                 files_functions_changed=files, executions=actual,
                 remaining_gaps=gaps, scientific_acceptance="not-applicable-operational")


record(["S00-002"], "Full current-worktree regression executed: 192 TypeScript and 51 Python tests; type check/build passed.",
       ["script/workplan-evidence-run.py"], ["script/*.test.ts", "unittest discover", "npm run check", "npm run build"],
       [], "verified")
record(["S00-003", "S00-007"],
       "Two fresh Node processes recomputed fixed-input baseline and all six category trajectories through 2100 (1,000 draws each, seed 123); exact full-payload hash agreement.",
       ["script/verify-process-baseline.ts"],
       ["verify-process-baseline"],
       ["Regional external-input, company valuation, implied-carbon-price and full walk-forward fixtures remain.",
        "Synthetic/public-number characterization is not scientific validity."])
record(["S00-004", "S00-008", "S00-009"],
       "All 14 declared mutating routes exercised in isolated Express harness: 7 diagnostics allowed, 7 mutations denied; oversized diagnostic body rejected with HTTP 413. Existing rate-limit test also passes.",
       ["script/privileged-route-inventory.test.ts", "server/releaseSafety.ts"],
       ["privileged-route-inventory", "script/*.test.ts"],
       ["GET paid-provider inventory, authorised CLI positive paths and client secret scan need separate acceptance."])
record(["S02-001"],
       "Archive readiness now checks exact public table, trigger event mask, function and enabled state, rather than global trigger-name counts.",
       ["server/snapshots/guards.ts:validSnapshotGuards", "server/snapshots/store.ts:snapshotsAvailable,persist", "script/snapshot-guards.test.ts"],
       ["snapshot-guards", "script/*.test.ts", "verify-workbook-snapshot"],
       ["Complete financial/carbon/SDG overlay archival and readers remain unimplemented.",
        "Production has no archive tables or guards."])
record(["S02-006", "S02-010"],
       "Actual development records exported in one read-only repeatable-read transaction, restored from files in a separate process into temporary tables, and exact hashes verified with zero public writes.",
       ["script/rehearse-analytical-recovery.ts:scan", "server/snapshots/recoveryContract.ts", "docs/Recovery_Rehearsal_Protocol.md"],
       ["rehearse-analytical-recovery", "script/*.test.ts"],
       ["This is not production backup/recovery or a complete schema migration rehearsal.",
        "Corrupt-file end-to-end rejection remains to be exercised."])
for identifier in ("S02-006", "S02-010"):
    requirements[identifier]["inputs_versions_assumptions"] = ["Development capture generated-artifacts/recovery/20261109/manifest.json; existing schema supplies column types; no users or secrets captured"]
    requirements[identifier]["numerical_results"] = [
        {"metric": "restored_company_rows", "actual": 2442, "expected": 2442, "decision": "pass"},
        {"metric": "restored_observation_rows", "actual": 470341, "expected": 470341, "decision": "pass"},
        {"metric": "restored_indicator_rows", "actual": 63, "expected": 63, "decision": "pass"},
        {"metric": "exact_table_hashes", "actual": 3, "expected": 3, "decision": "pass"},
        {"metric": "public_writes", "actual": 0, "expected": 0, "decision": "pass"},
    ]
for identifier in ("S02-005", "S02-011"):
    r = requirements[identifier]
    r["status"] = "blocked-production-provisioning"
    r["blockers"] = [{
        "observed_at": "2026-11-09T22:08:00Z",
        "evidence": "Read-only executeSql production: headers=false, chunks=false, guards=0. Railway_Hosting.md documents the existing Replit production database.",
        "attempted_remedy": "Checked database skill's managed/external distinction; inspected documented hosting topology and read-only managed production catalog. No DDL attempted.",
        "owner_action": "Supported Replit production schema publish is required; guard deployment support must be confirmed separately. Do not overwrite production data.",
        "scope": "Production archive capture and replay only; independent development work continues.",
    }]
    r["next_action"] = "Confirm supported managed rollout includes required guards, obtain owner publish action, then verify and capture production archive."
ledger["updated_at"] = datetime.now(timezone.utc).isoformat()
ledger["restart"] = {
    "next_requirement": "S00-003",
    "unfinished_requirement_ids": [r["id"] for r in requirements.values() if r["status"] != "verified"],
    "instruction": "Do not re-plan or repeat passed checks unless code changes invalidate them. Complete frozen baseline two-process capture for all required legacy paths, then S00-005/S00-010 scheduler ownership. Continue clause-by-clause reconciliation (most 300 clauses remain not-yet-reconciled). Recovery data already captured/restored exactly; add corrupt-file negative execution. Production archive depends on supported managed schema/guards; no direct DDL. Next independent substantive work: full overlay replay, 22-driver evidence, remaining calibration. Research work is NOT complete.",
    "background_tasks": [],
}
path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
spec = importlib.util.spec_from_file_location("ledger", ROOT / "script/completion-ledger.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.render(ledger)
print("Recorded observed executions; unverified requirements remain open")
