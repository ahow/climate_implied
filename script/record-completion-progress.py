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


record(["S00-002"], "Latest full regression executed: 195 TypeScript and 51 Python tests; type check/build passed. Earlier executions retained.",
       ["script/workplan-evidence-run.py"], ["script/*.test.ts", "unittest discover", "npm run check", "npm run build"],
       [], "verified")
record(["S00-003", "S00-007"],
       "Fresh-process fixtures match global/category trajectories, Gordon/gap/legacy finance and walk-forward. Additional fresh HTTP servers match four captured OWID regional results and real archived-workbook grouped endpoints: 187 valuation groups, 193 SDG rows, 187 tercile rows. Headers confirm frozen identities.",
       ["script/verify-process-baseline.ts", "script/verify-remaining-baselines.ts"],
       ["verify-process-baseline", "verify-remaining-baselines"],
       [], "verified")
record(["S00-004", "S00-008", "S00-009"],
       "All 14 declared mutating routes exercised in isolated Express harness: 7 diagnostics allowed, 7 mutations denied; oversized diagnostic body rejected with HTTP 413. Existing rate-limit test also passes.",
       ["script/privileged-route-inventory.test.ts", "server/releaseSafety.ts"],
       ["privileged-route-inventory", "script/*.test.ts"],
       ["GET paid-provider inventory, authorised CLI positive paths and client secret scan need separate acceptance."])
record(["S02-001"],
       "Strong archive guards retained. Added immutable regional external-input capture/load, paired indicator/regional historical API execution without live/cache fallback, response identity validation, selector UI and export IDs.",
       ["server/snapshots/guards.ts:validSnapshotGuards", "server/snapshots/regional.ts:captureRegionalInputs,loadRegionalInputs", "server/snapshots/regionalContract.ts", "server/calculation/regionalProjections.ts:calculateRegionalFromInputs", "server/routes.ts", "client/src/components/analysis-selection.tsx", "client/src/lib/analysis-selection.ts", "client/src/lib/export-contract.ts"],
       ["snapshot-guards", "script/*.test.ts", "verify-workbook-snapshot", "capture-regional-snapshot", "regional-archive", "regionalSnapshotId"],
       ["Complete financial/carbon/SDG overlay archival and readers remain unimplemented.",
        "Production has no archive tables or guards."])
record(["S02-006", "S02-010"],
       "Actual development records exported in one read-only repeatable-read transaction, restored from files in a separate process into temporary tables, and exact hashes verified with zero public writes.",
       ["script/rehearse-analytical-recovery.ts:scan", "server/snapshots/recoveryContract.ts", "docs/Recovery_Rehearsal_Protocol.md"],
       ["rehearse-analytical-recovery", "script/*.test.ts"],
       ["This is not production backup/recovery or a complete schema migration rehearsal."])
for identifier in ("S00-003", "S00-007", "S02-001"):
    requirements[identifier]["inputs_versions_assumptions"] = [
        "Workbook archive 271caaddc11350f1def50a1a379ac8689bbff745b7efa805e5fcd8146b6d45ac",
        "Indicator archive f31b9af915967998043a530b54dfd6a87e59b089a9053ad063437065832be6cd",
        "Regional archive 9d18a61c845fb4a13af3ae75795651c6512bbeea46709d3e6018cc55151433a2",
        "Resolved OWID co2_per_gdp values (PPP); capture is not original-publication-vintage evidence.",
    ]
    requirements[identifier]["numerical_results"] = [
        {"metric": "fresh_process_public_response_hash", "actual": "e8674592be19ad13956fd9da94e90245456e5170a5f65a48528baf10756166bf", "threshold": "exact equality", "decision": "pass"},
        {"metric": "regional/valuation/SDG/tercile_rows", "actual": [4, 187, 193, 187], "threshold": "same counts in both processes", "decision": "pass"},
    ]
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
for identifier in ("S00-005", "S00-010"):
    r = requirements[identifier]
    r["status"] = "partial"
    r["behaviour_delivered_this_run"] = "Read-only Railway logs confirm scheduler disabled; development disabled; Replit still has an active autoscale legacy deployment. No second scheduler enabled."
    r["existing_evidence"] = ["docs/WORKPLAN_IMPLEMENTATION_REPORT.md"]
    r["remaining_gaps"] = ["Exactly-one scheduler ownership across legacy autoscale instances is not certified."]
    r["next_action"] = "Verify Replit production deployment's scheduler instance/configuration ownership through supported controls; retain Railway disabled until ownership is settled."
record(["S11-002", "S11-003", "S11-031"],
       "Eight additional provider-matched candidate histories acquired under a pre-committed protocol. Eleven-candidate completed FCFE outcome audit (OCF already includes working-capital change, plus capex and net borrowing): 56 completed, 54 unavailable. Coverage now derived from inputs; duplicate issuer versions rejected.",
       ["script/collect-company-worked-inputs.ts", "server/financialData/completedCashFlow.ts:completedOutcomeCoverage", "script/audit-completed-cash-flow.ts", "docs/Company_Coverage_Expansion_Protocol.md", "docs/Company_Coverage_Expansion_Results.md"],
       ["collect-company-worked-inputs.ts --manifest", "audit-completed-cash-flow"],
       ["No paired historical Gordon/reverse-DCF predictions or rank correlations computed.", "Ten common eligible issuers over six consecutive valuation origins not established.", "Identity approvals, publication vintages and cash-flow classification review incomplete."])
for identifier in ("S11-002", "S11-003", "S11-031"):
    requirements[identifier]["scientific_acceptance"] = "not-accepted-study-incomplete"
for identifier in ("S00-005", "S00-010"):
    r = requirements[identifier]
    r["status"] = "verified"
    r["behaviour_delivered_this_run"] = (
        "Opt-in gate (DATA_SCHEDULER_ENABLED) enforced in server/dataIngestion/scheduler.ts:startScheduler. "
        "Exactly one environment starts the scheduler: Replit production autoscale logs '[scheduler] Started' "
        "(fetchDeploymentLogs 2026-10-20..2026-11-09, every cold start); Railway logs 'Disabled for this instance'; "
        "development disabled. Concurrent autoscale instances of that one environment (e.g. two starts at "
        "2026-11-07T07:00:31Z) are serialized by pg_try_advisory_lock(126907,1) in "
        "server/dataIngestion/collectionLock.ts:withCollectionLock plus the running-row check and the persisted "
        "last-run cadence. Read-only production indicator_fetch_runs: scheduled runs 2026-06-07, 07-07, 08-06, "
        "09-06, 10-06, one per ~30 days, no duplicate scheduled run.")
    r["existing_evidence"] = ["docs/WORKPLAN_IMPLEMENTATION_REPORT.md#scheduler-ownership-verified"]
    r["executions"] = [e for e in executions if "collection-lock" in " ".join(e["command"])]
    r["remaining_gaps"] = []
    r["scientific_acceptance"] = "not-applicable-operational"
    r["next_action"] = "Keep Railway disabled while Replit autoscale remains the collector; any host move must switch both flags in one change."
record(["S11-007", "S11-008", "S11-009", "S11-010", "S11-012", "S11-014", "S11-030", "S11-031"],
       "First executed D8 as-of comparison: 27 ex-ante issuers, 138 origins built, 88 complete (14/12/15/18/13/16 for 2017-2022), gate met. DCF-minus-Gordon forecast MAE improvement -0.92pp [95% CI -1.09,-0.70]; IC improvement +0.048 [-0.183,0.279]. Gate fail: reverse DCF not promoted; Gordon primary.",
       ["server/financialData/asOfValuation.ts:buildAsOfRows", "script/build-asof-valuation-rows.ts", "script/asof-valuation.test.ts", "docs/AsOf_Valuation_Prediction_Protocol.md", "docs/AsOf_Valuation_Comparison_Results.md"],
       ["asof-valuation", "build-asof-valuation-rows", "compare-valuation-models"],
       ["Company-specific beta variant not run (common 8% cost of equity).", "Revised-history statements, not as-first-reported.", "Signal comparison uses implied-growth proxy, not the Stage 14 signal.", "Identities unapproved; 52/53-week fiscal years excluded pending owner review."])
for identifier in ("S11-007", "S11-008", "S11-009", "S11-010", "S11-012", "S11-014", "S11-030", "S11-031"):
    requirements[identifier]["scientific_acceptance"] = "negative-DCF-not-promoted"
record(["S04-001"],
       "Heat-pump source acquired: AHRI public US air-source heat-pump shipments 2006-2025 (table image SHA-256 e6d5b997...). Frozen diagnostic (commit 7c8121d): eval 2019-2025 MAPE primary 2011-2018 window persistence 21.0%, linear 9.0%, log-linear 11.3%; 2006-2018 sensitivity 21.0/22.7/21.2%. Window-sensitive; no share denominator, so no logistic fit.",
       ["docs/Heat_Pump_Diffusion_Protocol.md", "docs/Heat_Pump_Diffusion_Results.md", "script/heat_pump_diffusion.py:evaluate", "script/test_heat_pump_diffusion.py"],
       ["heat_pump_diffusion"],
       ["No permitted heating-equipment denominator (AHRI furnace/monthly PDFs login-only; EHPA/JRAIA paid) so heat-pump share diffusion is uncalibrated.", "EV, storage and bootstrap-interval diffusion fits remain."])
requirements["S04-001"]["scientific_acceptance"] = "not-accepted-levels-sensitivity-only"
ledger["current_release"] = {"workspace_commit": "daa136d893bb6f8f4153ec19de8fa9e7f9e6ef62", "github_main": "1aba6d08e9df2c771722a8d1b301b59477164d93", "ci": "Source validation success; production-validated advanced", "railway_deployment": "620cf31a-d6a3-4a85-827a-11738c0b41f2", "railway_status": "SUCCESS", "verified_at": "2026-11-09"}
ledger["restart"] = {
    "next_requirement": "S11-004",
    "unfinished_requirement_ids": [r["id"] for r in requirements.values() if r["status"] != "verified"],
    "instruction": "UPDATE 2026-11-09 late: S00-005/S00-010 verified (single Replit autoscale scheduler environment + advisory lock + one scheduled run per month in production). D8 as-of study executed: negative for reverse DCF, Gordon stays primary; next run company-specific beta variant (S11-004) and Stage 14 signal. US heat-pump levels diagnostic done (AHRI); share calibration blocked on denominator. Then 22-driver audit, overlay replay, field semantics. Earlier note: S00-003/S00-007 baseline coverage passed, including actual grouped HTTP endpoints and regional captured inputs across fresh servers. Do not repeat unless invalidated. Verify S00-005/S00-010 legacy Replit autoscale scheduler ownership; Railway and development disabled, no second scheduler. Regional immutable replay now works in development with optional selector, export identity and no live fallback. Continue missing financial/carbon/SDG overlay and result replay, field-level semantics, all 22 driver evidence entries. Company outcome audit expanded to eleven candidates (56 outcomes); next build historical as-of Gordon/reverse-DCF predictions for those origins. Heat-pump source search found IEA 2019–2024 CC BY chart but no downloadable data and direct HTTP403; investigate AHRI/EHPA/JRAIA next, not all-source blocked. Full reconciliation, calibration, 10k ensemble, company and signal/portfolio research remain unfinished. Managed production archive provisioning and independent acceptance remain separate.",
    "background_tasks": [],
}
path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
spec = importlib.util.spec_from_file_location("ledger", ROOT / "script/completion-ledger.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.render(ledger)
print("Recorded observed executions; unverified requirements remain open")
