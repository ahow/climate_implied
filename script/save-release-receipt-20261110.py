"""Record the already-observed release; never deploy or mutate application data."""
import json
from datetime import datetime,timezone
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json")
x=json.loads(p.read_text())
release={
 "workspace_commit":"978a5994c7d195017cc074d53bae155aa61facee",
 "github_main":"d8439602674d880ee5007f25463f72906de67a1b",
 "ci":"42806902864 validate/promote success",
 "railway_deployment":"e0278526-15fb-476f-a1a5-045e861b6d2e",
 "railway_status":"SUCCESS",
 "verified_at":"2026-11-10",
 "recorded_at":datetime.now(timezone.utc).isoformat(),
 "timestamp_precision":"Verification date; no invented second for the completed HTTP probe.",
 "smoke":"Exact d843960 build source/health200/1141registrydefinitions/raw run summaries preserved/publicPOST403; development data-management screenshot renders22indicators/read-only controls.344TS+95Python, typecheck/build, privatefilingvalidator and355privateReceiptAssertions pass. No data/scientific activation.",
 "later_local_only":"This final receipt/checkpoint documentation is not deployed; published implementation/report is d843960."
}
if x["current_release"]["github_main"]!=release["github_main"]:
 x.setdefault("release_history",[]).append(x["current_release"])
x["current_release"]=release
for stage in x["stages"]:
 for record in stage["requirements"]:
  record.setdefault("revision_boundary",{})["subsequently_verified_release"]={
   "workspace_source":release["workspace_commit"],"github_runtime":release["github_main"],
   "ci":release["ci"],"railway":release["railway_deployment"],
   "scope":"Current integrated code release; does not promote this criterion's scientific or owner acceptance."
  }
x["latest_increment"]["current_20261110_release"]=release
x["latest_increment"]["stop_reason"]="Conversation context boundary after implementation, all300-clause integration, actual negative-source CI control and verified release. Actionable original scope remains; checkpoint is not the reason for stopping."
x["restart"]["next_requirement"]="S01-001 / S12-001 / S07-008 / S02-008"
x["restart"]["unfinished_requirement_ids"]=[r["id"] for s in x["stages"] for r in s["requirements"] if r["status"]!="verified"]
x["restart"]["background_tasks"]=[]
x["latest_increment"]["full_reconciliation_20261110"]["restored_final_check"]={
 "command":"npm run check && npx tsx --test script/*.test.ts && uv run python -m unittest discover -s script -p 'test_*.py' && npx tsx script/validate-company-filing-private.ts && npx tsx script/validate-clause-private-evidence.ts && npm run build",
 "executed_at":"2026-11-10T11:12:37.055931Z","exit_code":0,
 "typescript":"344pass/0fail/0skip","python":"95pass/0fail/0skip",
 "private_receipts":355,"log":"generated-artifacts/workplan-completion/20261110T111237055931Z.log"
}
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
import importlib.util
spec=importlib.util.spec_from_file_location("merge",Path(__file__).with_name("merge-clause-reconciliation.py"))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(module.matrix(x))
report=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
marker="\n## Final observed release — d843960 (local receipt)\n"
if marker not in report.read_text():
 report.write_text(report.read_text()+marker+"\n"+json.dumps(release,indent=2)+"\n\n"+
 "Published report/matrix/full300-clause ledger: GitHub ahow/climate_implied at d8439602674d880ee5007f25463f72906de67a1b, docs/. This dated local receipt is not a claim of another deployment. Full changed paths: docs/Implementation_Change_Index_20261110.md.\n\n"+
 "Remaining engineering: opaque historical-summary leaves and supplemental display/export inventory; legitimate HTTP operator identity/import/restore contract; exact dated share/identity/reference/terminal/reinvestment/stub reconciliation and full NEE/XOM operating bridges; compatible physical baselines/observables and2025source criteria; qualified historical company projections, sourced outcomes and full frozen research family. Owner/provisioning and missing statistical series are narrow constraints, not blanket implementation blockers.0/3completecases; no new historical efficacy or calibratedensemble acceptance.\n\n"+
 x["latest_increment"]["stop_reason"]+"\n")
