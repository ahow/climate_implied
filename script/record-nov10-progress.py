"""Reconcile this increment without overwriting prior scientific failures."""
import importlib.util
import json
from datetime import datetime, timezone
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "docs/workplan_completion_ledger.json"
ledger = json.loads(path.read_text())
requirements = {r["id"]: r for s in ledger["stages"] for r in s["requirements"]}


def record(ids, behaviour, files, commands, gaps, scientific):
    executions = [e for e in ledger["run_executions"]
                  if e["executed_at"].startswith("2026-11-10") and
                  any(c in " ".join(e["command"]) for c in commands)]
    for identifier in ids:
        r = requirements[identifier]
        r.setdefault("prior_reconciliation", []).append({
            k: r.get(k) for k in ["status", "behaviour_delivered_this_run", "files_functions_changed", "executions"]})
        r.update(status="partial", origin="existing-plus-this-run",
                 behaviour_delivered_this_run=behaviour, files_functions_changed=files,
                 executions=executions, remaining_gaps=gaps,
                 scientific_acceptance=scientific, next_action=gaps[0] if gaps else "Owner review")


record(["S04-001", "S04-006", "S04-007", "S04-009", "S04-010", "S04-011"],
       "Retained frozen EV study rerun unchanged: five fits, Rest of World incomplete, only India passes diagnostic, no promotion. New EIA public-domain storage protocol/tests frozen in 2155948. 2010-2018 training/2019-2024 holdout: exponential MW MAE 6589.37 vs 9204.32 persistence/9027.87 linear; MWh 16218.66 vs 25405.17/25302.87. Both paired 95% improvement intervals exclude zero; MAPE ~47%, sensitivity-only, saturation unidentified.",
       ["script/storage_adoption.py:evaluate", "script/extract-eia-storage.cjs", "script/test_storage_adoption.py",
        "docs/Storage_Adoption_Protocol.md", "docs/Storage_Adoption_Results.md", "script/ev_sales_calibration.py"],
       ["storage_adoption", "extract-eia-storage", "ev_sales_calibration"],
       ["Obtain a defensible sourced saturation prior before bounded storage diffusion; no invented ceiling.",
        "Integrate qualified parameter distributions only after source/region/structural checks; other Stage 4 drivers remain incomplete."],
       "storage-positive-relative-baselines-not-central; EV unchanged")
record(["S03-001", "S03-002", "S03-003", "S03-006", "S03-007"],
       "All 22 driver entries audited against mandatory metadata and actual calculation references. 0/22 metadata-complete and 0/22 central eligible. Explicit date/vintage gaps retained; role and calibration findings enumerated, not converted into acceptance.",
       ["script/audit-driver-evidence.ts", "docs/Driver_Evidence_Audit.md"],
       ["audit-driver-evidence"],
       ["Supply reviewed observation/availability/vintage/licence evidence per indicator; legacy comparator references are not calibrated causal mechanisms."],
       "audit-complete-calibration-incomplete")
record(["S02-001", "S02-002", "S02-003", "S02-007"],
       "Ordered financial/carbon/SDG overlay schema, hashes, guarded persistence/read, cutoff/unit/orphan checks and request-local application implemented. Selector and exports carry IDs/cutoff; absent archives reject rather than use current data. Real retained development baseline 2442 companies/470341 observations with three private synthetic overlays reproduced in two fresh processes, hash 46cc9662b8d7233137d2cbefdf30ea3b578c6fb064a09ff91a5966b926128b3a; baseline unchanged. Stored-result serialization tested, not full recalculation acceptance.",
       ["server/snapshots/overlayContract.ts", "server/snapshots/overlays.ts", "server/routes.ts",
        "server/climateValuation/sharedUtils.ts", "client/src/lib/analysis-selection.ts",
        "client/src/components/analysis-selection.tsx", "client/src/lib/export-contract.ts",
        "script/verify-overlay-replay.ts", "docs/Development_Overlay_Replay.md"],
       ["verify-overlay-replay", "overlay-replay.test", "script/*.test.ts"],
       ["Wire real reviewed refreshes and approval transactions to immutable overlays without auto-approval.",
        "Complete all-material-input replay and concurrent refresh/rejection journeys; file fixture does not establish full application replay.",
        "Production archive schema remains unprovisioned; no DDL attempted."],
       "engineering-partial-no-vintage-certification")
record(["S10-005"],
       "Prepared hash-verified private review packet for all 27 retained issuers and 270 fiscal periods. Workbook/provider identities, currencies, source hashes, filing dates and missing exact t+1/t+4 endpoints included. No identity approval or fiscal-rule change.",
       ["script/prepare-company-review.ts", "docs/Company_Review_Pack.md"],
       ["prepare-company-review"],
       ["Owner/independent identity evidence review remains; missing calendar endpoints do not themselves prove 52/53-week accounting."],
       "not-approved")
requirements["S00-002"]["behaviour_delivered_this_run"] = "Latest full regression: 204 TypeScript/63 Python passed, zero failures/skips; type checking and build exit 0."
requirements["S00-002"]["executions"] = [
    e for e in ledger["run_executions"] if e["executed_at"].startswith("2026-11-10")
    and any(c in " ".join(e["command"]) for c in ["script/*.test.ts", "unittest discover", "npm run check", "npm run build"])]
ledger["handoff_contract"] = {
    "prior_callback": "2026-11-09 23:41:55 HTTP 202 received but NOT MATCHED, owner-confirmed wrong event run-end",
    "event": "continuation_ready", "project_tag": "climate-implied-workplan-7Y7FDSOyaoDAG1SVtLd3ck",
    "test": "script/test_handoff_contract.py: enum, exact tag, actionable selection, incomplete completion rejection, no-network duplicate/202 tests",
    "matching": "HTTP transport acceptance never establishes matched continuation",
}
ledger["handoff_blockers"] = [
    "Production archive tables need supported managed provisioning; independent development remains actionable.",
    "Heat-pump share denominator unavailable under permitted source access.",
    "Owner identity/fiscal-rule review outstanding; no auto-approval."]
ledger["updated_at"] = datetime.now(timezone.utc).isoformat()
ledger["restart"] = {
    "next_requirement": "S02-007",
    "unfinished_requirement_ids": [r["id"] for r in requirements.values() if r["status"] != "verified"],
    "instruction": "Continue all stages 0-17. Finish real development approval-to-overlay capture and full all-material-input/result replay (current fixture is private synthetic overlays on real retained workbook, not full acceptance). Complete field-level semantics; use Driver_Evidence_Audit.md for all 22 missing metadata/source-calibration gaps. EV original gate unchanged; storage exponential beats baselines but no saturation prior or central promotion. Owner review packet has 27 issuers/270 periods, no approvals. Freeze distinct company-specific cost-of-equity sensitivity before fitting, then actual Stage 14 signal only with compatible Stage 12 projections; Gordon remains primary. Reconcile remaining original clauses against actual evidence. Use workplan-checkpoint.py --checkpoint-id with stable ID at true end only, continuation_ready and exact tag; 202 is transport only. Preserve scheduler and production restrictions.",
    "background_tasks": [],
}
path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
spec = importlib.util.spec_from_file_location("ledger", root / "script/completion-ledger.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.render(ledger)
print("Recorded partial evidence without scientific promotion")
