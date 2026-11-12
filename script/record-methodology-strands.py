import json,datetime,hashlib,importlib.util,sys
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
files={"S16-007":"docs/methodology-download-increment-evidence.json","S07-003":"docs/scientific-strands-warning-evidence.json","S16-008":"docs/scientific-strands-warning-evidence.json","S03-007":"docs/indicator-source-fields-increment-evidence.json"}
receipt=json.loads(Path("/tmp/methodology-selection-final-receipt.json").read_text())
gaps={"S16-007":"All26 central sites and10 direct attachments inventoried; UI-selection races refuse, but requested UI state is not authenticated producer input/model/run provenance. producerIdentity remains null; bind genuine producer manifests without public writes. Not every dataset-dependent chart has browser click-through evidence.",
"S07-003":"Three independent statuses implemented at actual producers, UI and manifests. Complete all-consumer migration and authentic physical/Stage9/scenario acceptance still require source-qualified evidence.",
"S16-008":"Exact retained89-file source/12warning hosts audited; no new removals. Original dynamic historical-backtest warning payload archive remains unavailable; unresolved warnings preserved.",
"S03-007":"Eight NOAA product metadata fields and four Pew candidate fields supplied, not original-curated-source authentication. All16 growth years differ from current NOAA; annual levels differ2021/2022/2025. Need source-compatible historical release/licence/regional/uncertainty/calibration evidence for remaining entries; no replacement or central promotion."}
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] not in files:continue
  f=files[q["id"]];q["methodology_strands_increment"]={"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"evidence":json.loads(Path(f).read_text()),"coherent_execution":receipt}
  q["executions"]=(q.get("executions")or[])+[receipt]
  q["behaviour_delivered_this_run"]="Actual implementation and source findings are itemized in "+files[q["id"]]
  q["remaining_gaps"]=[gaps[q["id"]]];q["next_action"]=gaps[q["id"]]
  q["blockers"]=[{"kind":"specific remaining original scope","detail":gaps[q["id"]]}]
summary={"updated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":receipt,"evidence":files,"counts":"56verified242partial2blocked;original1000/1001;0eligiblehistories;0/3cases","scope":"Registry methodology, manifest-bearing downloads, three separate scientific statuses and authenticated warning inventory implemented. NOAA/Pew metadata proposals are not historical source authentication. No new accepted scientific study or issuer economics. Exact remaining limitations in per-clause evidence.","release":"Pending code validation/promotion; previous verifiedruntime remains distinct."}
if len(sys.argv)==4:
 r={"github_main":sys.argv[1],"ci":sys.argv[2],"railway_deployment":sys.argv[3],"verified_at":summary["updated_at"],"health":200,"scope":"Code-only; no data/owner/scientific activation."}
 x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=r;summary["release"]=r
x["latest_increment"]["methodology_strands"]=summary;x["updated_at"]=summary["updated_at"]
x["restart"]["instruction"]="Continue original0–17: registry-methodology/download manifests and separate physical/skill/scenario statuses implemented; inspect actuallatestrelease. Warning inventory retains unresolved limitations; no new removals. Sourceproposals qualify product metadata only: NOAAcurated growth differsall16years, levels differ2021/2022/2025; no historicalsource replacement/vintage claim. Finish actual22indicator sources/calibration, issueroperatingcashflow andqualifieddatedcorpus. Protected14FaIRpins unchanged/operatortransferstill unavailable;privateHTTP403 retained. Current scientificacceptance/3cases remain incomplete."
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Registry methodology, download identity and separate scientific evidence\n\n"+json.dumps(summary,indent=2)+"\n\n"+f.read_text())
