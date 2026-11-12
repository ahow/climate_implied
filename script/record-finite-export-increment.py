"""Append exact original-clause evidence without changing source criteria."""
import json,datetime,hashlib,importlib.util,sys
from pathlib import Path
x=json.loads(Path("docs/workplan_completion_ledger.json").read_text())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
export=json.loads(Path("docs/remaining-export-evidence.json").read_text())
study=json.loads(Path("docs/regional-diffusion-next-evidence.json").read_text())
receipt=json.loads(Path("generated-artifacts/remaining-export-fullchecks-v3.native.complete.receipt.json").read_text())
release={"status":"new source not yet verified deployed","last_verified":x["current_release"]}
if len(sys.argv)==4:
 if x["current_release"].get("github_main")==sys.argv[1]:release=x["current_release"]
 else:
  release={"github_main":sys.argv[1],"ci":sys.argv[2],"railway_deployment":sys.argv[3],"verified_at":now,"health":200,"scope":"Code only; no issuer/science/private HTTP activation."}
  x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=release
evidence={"S16-007":("docs/remaining-export-evidence.json",export),
"S04-001":("docs/regional-diffusion-next-evidence.json",study),
"S12-017":("docs/regional-diffusion-next-evidence.json",study)}
gaps={
"S16-007":"Exact finite handler matrix is in remaining-export-evidence.json: closed/unimplemented/sourceblocked individually named. Unimplemented producer/code/material derivations are engineering work, not external source blockers. Prior nine chains preserved, no blanket disabling ordinary downloads. Genuine private HTTP principal/provisioning remains required; old124/179/416 never rewritten or original XLSX recovered. Fixture readback is engineering, not live historical/scientific acceptance.",
"S04-001":"Ten region/technology combinations have nine training/six heldout observations in each separately retained release; no independently supported regional saturation qualified. Zero new efficacy fits/bootstrap runs. New guarded evaluator is point-only: source/structural/dependence uncertainty still required, not a completed calibration pipeline. Preserve nine prior baseline failures and EU-solar point win without central promotion. Need source-qualified ceilings/priors and original uncertainty gates before qualification; no MW/shipments ceilings, shortened windows, revised-vintage substitution or arbitrary priors.",
"S12-017":"Bounded new DOE/IRS programme sources do not establish FSLR collections/eligible watts/BOM/current-law case qualification, NEE gross recipient/priorities/commissioning/marginal returns or XOM executed fees/novation/billings/opex/funding. FSLR IR403 and selected NEE/XOM404 routes are scoped request outcomes, not global unavailability. No issuer FCFE insertion, duplicate cash/expense, future backdating or approval. Prior XPLR/Williams/TamilNadu findings preserved."}
summary={"updated_at":now,"release":release,"execution":receipt,"finite_export_counts":export.get("matrixCounts"),
"sources":["docs/remaining-export-evidence.json","docs/regional-diffusion-next-evidence.json"],
"scientific_decision":"No new accepted calibration, historical efficacy or issuer case; safeguards/fixtures are engineering only."}
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] not in evidence:continue
  f,d=evidence[q["id"]]
  q["finite_export_diffusion_increment"]={**summary,"evidence":{"path":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"detail":d}}
  q["behaviour_delivered_this_run"]="Exact source/functions/formulas/tests/counts/failures are in clause-local finite_export_diffusion_increment; scientific and owner acceptance unchanged."
  q["remaining_gaps"]=[gaps[q["id"]]];q["next_action"]=gaps[q["id"]]
  q["executions"]=(q.get("executions")or[])+([receipt] if receipt not in (q.get("executions")or[]) else [])
x["latest_increment"]["finite_exports_and_diffusion"]=summary;x["updated_at"]=now
x["restart"]["unfinished_requirement_ids"]=[q["id"] for s in x["stages"] for q in s["requirements"] if q["status"]!="verified"]
x["restart"]["next_requirement"]="S16-007 exact remaining unimplemented matrix entries; S04-001 sourced regional saturation; S12-017 qualified issuer economics"
x["restart"]["instruction"]="Continue all original0–17. Read finite29-handler matrix in docs/remaining-export-evidence.json; do NOT reopen nine prior chains or newly closed entries. Ordinary downloads were not blanket disabled. Remaining unimplemented parent/code/material/derivation contracts are engineering, not source blockers. Preserve genuine privateHTTP403/operatorCLI, old124/179/416/no originalXLSXrecovery. Regional diffusion: actual150observations per separately retained release, ten combinations nine training/six heldout; zero new fits because no sourced saturation qualifies. Preserve original negatives/point win, windows/baselines/bootstrap; no invented ceilings. New programme-level primary sources/403/404 do not qualify issuer cash economics. Continue named FSLR/NEE/XOM fields and actual dated11–15/22-driver inputs, not repeated old kernels. Original1000/1001 and scientific/owner gates unchanged. Verify current_release vs docs/local receipts; existing promotion only."
Path("docs/workplan_completion_ledger.json").write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
sp=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
p=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
p.write_text("# Finite non-signal exports and regional diffusion evidence\n\n```json\n"+json.dumps(summary,indent=2)+"\n```\n\n"+p.read_text())
