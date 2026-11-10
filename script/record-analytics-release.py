import json
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location("m",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
smoke=json.loads(Path("generated-artifacts/workplan-completion/analytics-live.json").read_text())
release={"workspace_commit":"c387b2ac4c4daf5e3d820ed32ed6775abf551f28",
 "github_main":"f814fb21269fa867f4b400f032678bc289ff9338","ci":"42835210133 validate/promote success",
 "railway_deployment":"4b2d87aa-b434-4e68-9440-f2c89f2725a3","railway_status":"SUCCESS",
 "verified_at":smoke["verified_at"],"smoke":smoke,
 "boundary":"Verified implementation revision, not this later documentation commit. Production coverage503 reflects unavailable review/archive dependencies; development coverage200. No data or scientific activation."}
x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=release
inc=x["latest_increment"]["substantive_analytics"];inc["release"]=release
inc["stop_reason"]="Context boundary after substantive analytical implementation and verified gated release; ready original work remains."
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in inc["changed_original_ids"]:
   r["git_commit"]=release["workspace_commit"];r["deployment_revision"]=release["github_main"]
   r["live_release_observation"]=release
x["restart"]["instruction"]="Latestverifiedlivef814fb2,CI42835210133,Railway4b2d87aa;39verified259partial2blocked. Public482TS+117Python; mandatoryprivate4retainedTS+4windPython andissuer/historicalvalidators passed separately. Productioncoverage503 staysnarrowprovisioninggap;DEVcoverage200 actual2442/eligible1. "+x["restart"]["instruction"]
x["restart"]["unfinished_requirement_ids"]=[r["id"] for s in x["stages"] for r in s["requirements"] if r["status"]!="verified"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
with Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md").open("a") as f:
 f.write("\n## Verified substantive-analytics release\n\n"+json.dumps(release,indent=2)+"\n\n")
 f.write("Stopping at context boundary, not completion.39verified259partial2blocked0unreconciled. Full0–17/amendments remain. Code-onlyCI42833772416 initially failed on private-source dependencies; repaired by mandatory explicit private validators, not export/skips. CI42835210133 and Railway then succeeded. Final counts:482publicTS+4privateTS;117publicPython+4privatePython. Allzero fail/skip, plus mandatoryprivateissuer/history assertions. Data activation and independent acceptance unclaimed.\n\n")
 f.write("Safe published source/report is under https://github.com/ahow/climate_implied/tree/f814fb21269fa867f4b400f032678bc289ff9338 ; this later receipt records that verified runtime and is not self-referencing. Fullchangedpaths are above; subsequent integration files include script/record-analytics-gates.py, script/record-analytics-release.py, script/validate-driver-retained-private.ts and script/validate_wind_cost_source_private.py. Private raw inputs remain outside source export.\n")
