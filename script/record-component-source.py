import json,hashlib,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text());e=json.JSONDecoder().raw_decode(Path("/tmp/component-source-final.log").read_text())[0]
groups={"S12-001":["docs/issuer-contract-law-evidence.json"],"S04-003":["docs/kaya-fullbasis-monthly-source-evidence.json"],"S04-005":["docs/kaya-fullbasis-monthly-source-evidence.json","docs/climatetrace-monthly-100mb-source-evidence.json"]}
summary={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":e,
"sources":"CF2022original announcement/factsheet/8K acquired; announcementmetric versus annualshortton conflict retained. Exact11402METS sign-in boundary not bypassed. Original45X laws/IRSnotice source-qualified;16statutorypaths14companyeligibility unresolved/2generationzero, cashnull.0/3cases.",
"climate":"Full separateWDI2021PPP revision2026-10-08:465GDP+465populationcells;75regionalyears,RoW/transport30null. Original2011PPP54gaps unchanged. ActualmonthlyCO2 archive118279rows/1939listedminingassets/80countries;2024–25sameasset/month23268pairs exactlyequal. Partialportfolio/revisedhistory/freshnessnotqualified; noholdouts orsynthetic outcomes.",
"components":"60actualdynamiccomponents/1733JSXexpressions/106fieldbindingexpressions;24directlySSRrendered,36namedunrendered. New missingness/defaultzero/staleexport fixes. Initial preview caught closed-modal eager undefined-export-key crash; fixed before release with actualmodal regressions and clean initial-route screenshots. No schema weakening. Modalportal/hover interactions notbrowserverified.",
"next":"Continue36unrenderedcomponentcontracts and interaction-only branches without repeatingpassedroutefixtures. Obtain actual CCScontracteconomics and issuer-specific45X/material-cost/cash eligibility; NEEcashpriorities/projectreturns remain. Qualify alternativefullGDP/energy/CO2joint boundaries and monthlysource freshness/vintage/fullscope before frozenholdout; retain repeatedpublisherrows, no invented independentoutcomes.",
"counts":"40verified258partial2blocked;original1000/1001 unchanged;0/3qualified cases."}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in groups:
   r["component_source_evidence"]=[{"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"details":json.loads(Path(f).read_text())} for f in groups[r["id"]]]
   r["executions"].append(e);r["next_action"]=summary["next"];r["behaviour_delivered_this_run"]=summary["sources" if r["id"]=="S12-001" else "climate"]
  if r["id"]=="S16-005":
   r["executions"].append(e);r["behaviour_delivered_this_run"]=summary["components"]
   r["remaining_gaps"]=["36of60 dynamiccomponents not individuallySSRrendered; modalportal/hover/issuer-control and export/archivepreview permutations not exhaustively exercised. Existing41route evidence preserved."]
   r["next_action"]=summary["next"]
x["latest_increment"]["component_source"]=summary;x["restart"]["instruction"]=summary["next"]+" "+summary["counts"];x["updated_at"]=summary["at"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Component contracts and primary series — validated; release pending\n\n"+json.dumps(summary,indent=2)+"\n\n"+f.read_text())
