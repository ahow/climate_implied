import json,hashlib,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e=json.JSONDecoder().raw_decode(Path("/tmp/admission-nee-pass.log").read_text())[0]
groups={"S03-002":"docs/s03-002-role-admission-evidence.json","S12-001":"docs/nee-project-cash-waterfall-evidence.json","S07-008":"docs/igcc-alpha1-proof-evidence.json"}
summary={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":e,
"admission":"Canonical role vocabulary plus every bound scenario dependency admission; unsigned joint registry/inventory refuses central generation.22curated+10retained central refusals preserved. No accepted real central forecast.",
"nee":"24conditional paths/384cash/768capitalrows. Historical DMI2.257bn/payment740m; cash including DMI2.183bn versus negative74m without. FPL3.7bn dividend less3.4bn contribution=300m netparent cash. Conditional terminals2.499–3.986bn,values10.567–26.668bn;48negative annual funding rows. No root/qualified original case;0/3.",
"physical":"Exact licensed alpha1 recovered; zero initial modes/full first-last steps/trapezoidal boundary output proved. Five engineering vectors residual0C at1e-14; annualmean differs0.027986C. No attribution or forcing/control ensemble acquisition.",
"coverage":"Original1000/1001 unchanged.8 supplemental fields added: public1331/1332,expanded1492/1493,1711definitions. No original closure.",
"initial_failures":"533/536: stale census and old51leaf assertion. Exact new supplemental fields reconciled, strict gates preserved; final537TS pass.",
"next":"Continue full NEE project commissioning/marginal return and gross non-DMI distribution evidence, XOM original economics and source-specific control/forcing/native-boundary qualification. Preserve new conditional NEE paths, original FSLR/XOM negatives and alpha1 distinction. Complete genuine dated11–15 corpus and operator prerequisites; no synthetic scientific acceptance."}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in groups:
   f=groups[r["id"]];r["admission_nee_alpha1_evidence"]={"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"details":json.loads(Path(f).read_text())}
   r["executions"].append(e);r["next_action"]=summary["next"];r["behaviour_delivered_this_run"]=summary[{"S03-002":"admission","S12-001":"nee","S07-008":"physical"}[r["id"]]]
x["latest_increment"]["admission_nee_alpha1"]=summary;x["restart"]["instruction"]=summary["next"]+" "+summary["admission"]+" "+summary["nee"]+" "+summary["physical"];x["updated_at"]=summary["at"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# New NEE/admission/alpha1 increment — validated, release pending\n\n"+json.dumps(summary,indent=2)+"\n\n"+f.read_text())
