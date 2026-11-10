import json,subprocess
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location("m",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
ts=json.JSONDecoder().raw_decode(Path("/tmp/analytics-final.log").read_text())[0]
py=json.JSONDecoder().raw_decode(Path("/tmp/analytics-private.log").read_text())[0]
http=json.loads(Path("generated-artifacts/company-coverage/parent-http.json").read_text())
inc=x["latest_increment"]["substantive_analytics"];inc.update(final_typescript=ts,python_private=py,development_http=http,
 coverage={"original_bound":1000,"original_total":1001,"original_closed_this_increment":0,"definitions":1703,"current_bound":1323,"current_total":1324,"expanded_bound":1484,"expanded_total":1485,"withheld":27,"aliases":4},
 repaired_failures="Initial479/482: standalone JSON writer rejected; integrated into existing central evidence writer. Updated exact supplemental census counts while preserving both strict-failure guards; no skipped tests.",
 original_summary_investigation="Read five actual development run summaries: perAdapter objects, no producer/version/manifest provenance. Existing Git collector revisions alone cannot identify which code produced a stored run. Raw values and unknown original slot retained.",
 operator_gap="No existing authenticated HTTP principal/role is installed. Owner/auth maintainer must provision the genuine operator contract and disposable DEV principal; no fabricated identity or public write exception added. Supported disposable importer/restore workflow still needs implementation once its authenticated contract exists.")
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in inc["changed_original_ids"]:
   r["executions"].extend([ts,py]);r["analytics_final_verification"]={"typescript":ts,"python_private":py,"development_http":http}
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
paths=sorted(set(subprocess.check_output(["git","diff","--name-only"],text=True).splitlines()+subprocess.check_output(["git","ls-files","--others","--exclude-standard"],text=True).splitlines()))
with Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md").open("a") as f:
 f.write("\n### Final analytics integration checks\n\n"+json.dumps(inc,indent=2)+"\n\n")
 f.write("39verified/259partial/2provisioning-blocked/0unreconciled. Original1000/1001 remains; no neworiginalclosure. Definitions1703,current1323/1324,expanded1484/1485; supplemental fields are not oldgapclosure. Full tests484TS/0fail/0skip;121Python separately plus required private validators; typecheck/build passed. Read-only development HTTP coverage200/133semanticIDs; registry200/51IDs; overlays422. Screenshot confirms page renders, not a browser download interaction.0/3qualified original issuer cases; maintenance benchmark pairs are not substitutes.\n\n")
 f.write("Published-source wind investigation stopped before fitting; missing exact full-window sources. Qualified FaIR intervention SR1.5 SSP245median1.594030779C, distinct annual1.587760543C/decade1.426113020C; not GMST/historical attribution acceptance. Natural forcing unchanged; baseline residual7.76e-17C. Actual issuer166fact historical bridges reconcile; no ownerapproval/productionactivation.\n\n")
 f.write("### Final changed paths\n\n"+"\n".join("- `"+a+"`" for a in paths)+"\n")
