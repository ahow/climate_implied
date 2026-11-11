import json,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
r={"workspace_commit":"c7798ae0e76e039e62c4022cbf076a0780ea7c36","github_main":"5ef7bce0ba95722d5b57ad15dbe8a63dafadb2f2","ci":"42994876823 success","railway_deployment":"0a4da756-a81b-4510-994d-c7fc76a12d6f","verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"build_info":"exact SHA verified","health":200,"tests":"525TS/0fail/0skip;140Python;mandatory private FSLR passed;typecheck/build passed","scope":"Code only; no data/scientific activation. Subsequent documentation and local callback receipt distinct."}
x["release_history"].append(x["current_release"]);x["current_release"]=r
x["latest_increment"]["source_bridge_increment"]["release"]=r
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] in ["S12-001","S07-008"]:
   q["live_release_observation"]=r;q["git_commit"]=r["workspace_commit"];q["deployment_revision"]=r["github_main"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Latest verified source-bridge release\n\n"+json.dumps(r,indent=2)+"\n\n"+f.read_text().replace("# New source-bridge increment — validation complete, release pending","# Source-bridge increment — released; historical validation detail",1))
