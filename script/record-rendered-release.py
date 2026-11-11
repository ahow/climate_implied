import json,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
r={"workspace_commit":"330569935a39812c744eb4ccdf0400c47835c822","github_main":"4d234ebb1c64534508f615d4a6754d3a4e29f77c","ci":"43003874360 success","railway_deployment":"4ae973c7-7302-40a3-aa4b-5e70a92bf8e2","verified_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"build_info":"exact SHA verified","health":200,"affected":"GET conditional XOM summary200,oneissuer,zeroqualified;private/rawinputs never exposed","tests":"550TS/0fail/0skip;147Python;mandatory private NEE remittance passed;typecheck/build;41browsercases40pass1historicaltimingfailure plus1/1focusedfixconfirmation;independentpanel/103leaf XLSX equality","scope":"Code/UI only; no data/scientific activation; later doc/local receipts distinct."}
x["release_history"].append(x["current_release"]);x["current_release"]=r;x["latest_increment"]["rendered_company"]["release"]=r
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] in ["S03-002","S12-001","S16-005","S16-010"]:
   q["live_release_observation"]=r;q["git_commit"]=r["workspace_commit"];q["deployment_revision"]=r["github_main"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Latest verified rendered-company release\n\n"+json.dumps(r,indent=2)+"\n\n"+f.read_text().replace("validated, release pending","released; historical validation detail",1))
