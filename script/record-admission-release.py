import json,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
r={"workspace_commit":"f4b51f076f1f516298a08048f12b33e51a701f12","github_main":"2fb18f029f62368ae3b1471c9820a6bf7eb0e5b5","ci":"42998932455 success","railway_deployment":"7afb6d64-5660-4da9-8cbe-f16e7672b2c5","verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"build_info":"exact SHA verified","health":200,"tests":"537TS/0fail/0skip;147Python;mandatory private NEE passed;4private driver assertions preserved/passed focused;typecheck/build passed","scope":"Code only, no data/scientific promotion. Later doc/local receipts distinct."}
x["release_history"].append(x["current_release"]);x["current_release"]=r;x["latest_increment"]["admission_nee_alpha1"]["release"]=r
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] in ["S03-002","S12-001","S07-008"]:
   q["live_release_observation"]=r;q["git_commit"]=r["workspace_commit"];q["deployment_revision"]=r["github_main"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Latest verified NEE/admission/alpha1 release\n\n"+json.dumps(r,indent=2)+"\n\n"+f.read_text().replace("validated, release pending","released; historical validation detail",1))
