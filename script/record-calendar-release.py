import json,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
smoke=json.loads(Path("generated-artifacts/workplan-completion/calendar-liability-live.json").read_text())
release={"workspace_commit":"b9dfd63175ce1ab692b22d73343d838cd3c0dee3",
 "github_main":"2d0a759b03739447c1c8291ed7b500bb758414bb","ci":"42989861313 validate/promote success",
 "railway_deployment":"ae8ed634-6950-4cde-96e9-41c31fc1d864","railway_status":"SUCCESS",
 "verified_at":smoke["verifiedAt"],"smoke":smoke,
 "receipt_boundary":"Verified implementation; later documentation/local handoff receipts are distinct. Coverage503 remains a provisioning dependency; no data/scientific activation."}
x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=release
x["latest_increment"]["calendar_liability_recovery"]["release"]=release
x["latest_increment"]["calendar_liability_recovery"]["stop_reason"]="Context boundary after recovery, substantive source/calculation work, integrated tests and verified release; original work remains, not completion."
x["latest_increment"]["terminal_recovery"]["additional_observed_tool_failure"]="Earlier async worker wait returned null while the worker continued; accessing .text immediately failed. Subsequent work/checks/publication succeeded. This does not establish the cause of the later platform-level Agent error. Explicit terminal Python cleanup does not catch arbitrary platform/tool-runtime termination."
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S01-001","S15-009","S12-001"]:
   r["git_commit"]=release["workspace_commit"];r["deployment_revision"]=release["github_main"]
   r["live_release_observation"]=release
x["restart"]["instruction"]="Verifiedrelease2d0a759b/CI42989861313/Railwayae8ed634;521publicTS/128Python andnewmandatoryprivatecalendar/XOM checks passed. "+x["restart"]["instruction"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
report=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");text=report.read_text()
text=text.replace("Served GitHub revision `d578715438eb2c84dcaee518e2a0363419aed4ee`,\nCI `42925352694` success, Railway `02d48bbd-282a-42b6-8e84-8272c7219f00` success,\nbuild-info and health verified. This is the later documentation revision of\nimplementation `274440b5`; new local recovery scripts are separately recorded.",
 "Served GitHub revision `2d0a759b03739447c1c8291ed7b500bb758414bb`,\nCI `42989861313` success, Railway `ae8ed634-6950-4cde-96e9-41c31fc1d864` success,\nbuild-info/health verified2026-11-11T08:52:59Z. New recovery/source/calculation code is published; subsequent documentation and local handoff receipts are distinct.")
text+="\n## Final verified calendar/liability release\n\n"+json.dumps(release,indent=2)+"\n\n"+x["latest_increment"]["terminal_recovery"]["additional_observed_tool_failure"]+"\n\nContext boundary, not completion.39verified259partial2blocked0unreconciled,0/3qualified full issuer cases and0/50qualified return comparisons. No callback sent during active work; explicit one-time terminal cleanup follows saved evidence.\n"
report.write_text(text)
