import json,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
r={"workspace_commit":"37b92be048df7a5cfed641350100534ace6219b0","github_main":"592957cddbdc6a67856cb326f61b6dfa2d0e7eda","ci":"43019539782 success","railway_deployment":"68d8a8b8-e5e4-4e9b-9d4a-5bc96b4ff71f","verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"build_info":"exact SHA verified","health":200,"affected":"data-management200; closed-modal crash fixed and initialrender screenshots clean before release; no unchanged41browser suite rerun","tests":"Final623TS/0fail/0skip/typecheck/build;172Python and mandatoryprivate issuer-law validator passed before client-only modalfix, measured code unchanged","scope":"Code/source only; no data/scientific promotion; later documentation/local receipts distinct."}
x["release_history"].append(x["current_release"]);x["current_release"]=r;x["latest_increment"]["component_source"]["release"]=r
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] in ["S04-003","S04-005","S12-001","S16-005"]:
   q["live_release_observation"]=r;q["git_commit"]=r["workspace_commit"];q["deployment_revision"]=r["github_main"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Latest verified component/source release\n\n"+json.dumps(r,indent=2)+"\n\n40verified/258partial/2blocked;0/3qualified;original1000/1001. Context boundary, not completion.\n\n"+f.read_text().replace("validated; release pending","released; historical validation detail",1))
