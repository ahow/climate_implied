import json,datetime,hashlib,subprocess
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
receipt=json.JSONDecoder().raw_decode(Path("/tmp/resume-analytics-check.log").read_text())[0]
groups={"S12-001":["docs/fslr-paid-spare-capacity-evidence.json"],"S07-008":["docs/igcc-gmst-source-bridge-evidence.json","docs/igcc-control-thermal-bridge-evidence.json"]}
summary={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":receipt,
"issuer":"48 conditional FSLR paths/768 cash rows;18 positive and30 nonpositive post-credit terminals;9 positive funded-plan values. Zero-future-credit paths all nonpositive. FY2024 FCFE negative: CAGR refused;0/3qualified.",
"physical":"176annual years1850-2025 ×200 actual GMST observation members assembled.84 thermal comparisons: midpoint residual2.6645352591003757e-15C; supported modal update zero residual. Midpoint versus annual means NOT equivalent; GHG/Nat/OHF maxima0.100754/0.303043/0.040193C. No attribution or member-share claim.",
"scope":"39verified259partial2blocked; original1000/1001 unchanged. No approval/data/scientific promotion.",
"next":"Continue NEE project/noncommon funding and XOM original economic inputs; FSLR source-conditioned marginal economics and current-law qualification, preserving new negative stress outcomes. Obtain model-specific control permissions, actualforcing ensembles and alpha1 timing/initialization/native-boundary proof before attribution. Preserve all frozen studies and remaining original0-17 work."}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] not in groups:continue
  paths=groups[r["id"]]
  r.setdefault("source_bridge_prior",{"behaviour":r.get("behaviour_delivered_this_run"),"next_action":r.get("next_action")})
  r["source_bridge_evidence"]=[{"path":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"details":json.loads(Path(f).read_text())} for f in paths]
  r["executions"].append(receipt)
  r["behaviour_delivered_this_run"]=summary["issuer" if r["id"]=="S12-001" else "physical"]
  r["next_action"]=summary["next"]
x["latest_increment"]["source_bridge_increment"]=summary
x["restart"]["instruction"]=summary["next"]+" New525publicTS plus source-bridge Python and mandatory private FSLR checks passed. Do not rerun unchanged kernels. "+summary["issuer"]+" "+summary["physical"]
x["updated_at"]=summary["at"];p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
report=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
report.write_text("# New source-bridge increment — validation complete, release pending\n\n"+json.dumps(summary,indent=2)+"\n\n"+report.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
