"""Record evidence without changing original criteria or scientific statuses."""
import json,datetime,hashlib,importlib.util,sys
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json")
x=json.loads(p.read_text())
files={"S16-007":"docs/producer-download-increment-evidence.json",
"S07-003":"docs/status-choice-width-increment-evidence.json",
"S11-001":"docs/status-choice-width-increment-evidence.json",
"S13-010":"docs/status-choice-width-increment-evidence.json",
"S03-007":"docs/remaining-source-inputs-evidence.json"}
gaps={
"S16-007":"Nine retained valuation producers and exact stored-result JSON have verified result/material/route/input-context binding. Current unretained responses and derived chart rows remain unbound. Complete genuine chart/custom-XLSX journeys and remaining producer surfaces; no independent recalculation/container attestation claimed.",
"S07-003":"24 finite climate API consumers have three distinct status headers; eight chart consumers and all gauge branches render statuses. Complete dataset-dependent browser journeys and exact remaining consumer evidence; scientific acceptance remains independently unestablished.",
"S11-001":"Five original child choices now have strict prospective register/branches. Original unified pre-build timing remains unauthenticated; no original retrospective specification reconstructed. Complete source-qualified prospective cases and original historical study.",
"S13-010":"Prospective full-domain hashed width contract computes strict comparisons without numeric defaults. Original thresholds/pre-result owner confirmation and defensibility of actual full assumption domains remain unestablished; no old corpus scored.",
"S03-007":"GDP and corporate-target/implementation product proposals added. 15/16 current nominal GDP observations differ from retained values; not constant2011PPP Kaya input. SBTi counts are not market-cap coverage or measured implementation. IEA/CBI403 scoped to attempted sources. Qualify actual curated-source/vintage/region/uncertainty/calibration fields, without replacement or central promotion."}
receipt=json.loads(Path("/tmp/producer-final-receipt.json").read_text())
for stage in x["stages"]:
 for q in stage["requirements"]:
  if q["id"] not in files:continue
  f=files[q["id"]]
  q["producer_source_increment"]={"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"evidence":json.loads(Path(f).read_text()),"coherent_execution":receipt}
  if q["id"] in ["S16-007","S07-003"]:
   q["producer_source_increment"]["actual_browser"]=json.loads(Path("docs/producer-chart-browser-evidence.json").read_text())
  if receipt not in (q.get("executions")or[]):q["executions"]=(q.get("executions")or[])+[receipt]
  q["behaviour_delivered_this_run"]="Implementation, sources and actual tests: "+f
  q["remaining_gaps"]=[gaps[q["id"]]]
  q["next_action"]=gaps[q["id"]]
  q["blockers"]=[{"kind":"remaining original scope","detail":gaps[q["id"]]}]
summary={"updated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":receipt,
"evidence":files,"counts":"56verified242partial2blocked; original1000/1001;0eligiblehistories;0/3qualifiedcases",
"scope":"Producer-bound stored JSON, separate scientific statuses, unscored prospective choices/width and new WB/SBTi source proposals. Actual browser current/archive/return completed; exact producer endpoint200 readback, click navigation timed out. Empty observed P/E charts had disabled downloads; derived XLSX/JSON readback not exercised. No scientific promotion or issuer-case completion.",
"release":"Pending existing code validation/promotion; prior verified runtime remains distinct."}
if len(sys.argv)==4:
 r={"github_main":sys.argv[1],"ci":sys.argv[2],"railway_deployment":sys.argv[3],"verified_at":summary["updated_at"],"health":200,"scope":"Code-only; no data/owner/scientific activation."}
 x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=r;summary["release"]=r
x["latest_increment"]["producer_source"]=summary;x["updated_at"]=summary["updated_at"]
x["restart"]["instruction"]="Continue all original0–17. Nine retained valuation producers/exact stored JSON now bind real retained result/material/ordered input-context identity; unretained current and derived chart rows remain null. Finish actual chart/custom-sheet journeys and other producer consumers. Separate24API/eightchart statuses and prospective five-choice/full-domain-width contracts delivered; original timing/thresholds not reconstructed. New WB nominalGDP differs15/16years and is NOT Kaya2011PPP; SBTi counts NOT market-cap/implementation. Continue remaining source-qualified22indicator and NEE/FSLR/XOM operating economics/qualified11–15corpus. No old studies rerun, no source replacement/owner approval. FaIRpins/bundle unchanged, operator access unavailable. Check current_release; do not equate docs/local receipt with runtime."
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
f.write_text("# Producer identity, prospective contracts and new source evidence\n\n"+json.dumps(summary,indent=2)+"\n\n"+f.read_text())
