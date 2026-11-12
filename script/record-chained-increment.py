"""Incremental original-clause receipts; never change original criteria/status."""
import json,datetime,hashlib,importlib.util,sys
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
files={"S16-007":["docs/signal-chained-lineage-evidence.json"],"S12-017":["docs/issuer-source-next-evidence.json"]}
changes={"S16-007":["shared/derivedConsumer.ts:deriveSignalConsumer","client/src/lib/producer-download.ts:retainProducerDownload,captureSignalConsumer,derivedConsumerIdentity","client/src/lib/analysis-selection.ts:analysisFetch","client/src/components/download-data-button.tsx:handleClick,handleJsonClick","client/src/lib/derived-consumer-workbook.ts:assertLiteralCells,verifyDerivedConsumerWorkbook","client/src/pages/decarb-signal.tsx","client/src/pages/decarb-gap-signal.tsx","shared/derivedConsumerSemantics.ts","script/signal-chained-lineage.test.ts"],
"S12-017":["server/calculation/issuerCashSourceQuarterFollowup.ts","server/calculation/xomSourceInputQualification.ts","script/issuer-source-next-evidence.test.ts"]}
gaps={"S16-007":"Six signal/gap chains now bound in addition to prior three P/E paths, with actual JSON/XLSX handler readback and request-start selection pinning. Nonempty chains are isolated engineering fixtures, not qualified historical efficacy. Other non-signal/custom downloads still require exact producer/derivation contracts where missing; production HTTP operator activation remains unauthorized,403 preserved. Old124results/179headers/416chunks not edited, original XLSX not recovered. No new private persistence activation.",
"S12-017":"New XPLR consolidated cash/FCFBG closes, but net CSCS7m,partner89m contributions/85m distributions and CFO-to-FCFBG103m difference do not identify NEE recipient/gross LLC/project returns. Williams up-to1m tonnes/year is not priced executed CCS billing/novation. Tamil Nadu response covers different programmes/recipients, not FSLR installment/BOM/eligible watts. XPLR Q3 filing403 contents unverified. Need specific original LLC recipient/priority/commissioning/reinvestment, FSLR programme collections/component-cost/current-law, XOM signed fee/opex/funding/novation evidence; no FCFE insertions/approvals or future backdating."}
receipt=json.loads(Path("/tmp/chained-final-v2-receipt.json").read_text())
failure=json.loads(Path("/tmp/chained-final-receipt.json").read_text())
release={"status":"new code not yet verified deployed","last_verified":x["current_release"]}
if len(sys.argv)==4:
 release={"github_main":sys.argv[1],"ci":sys.argv[2],"railway_deployment":sys.argv[3],"verified_at":stamp,"health":200,"scope":"Code-only; private HTTP403, no data/issuer/science activation."}
 x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=release
summary={"updated_at":stamp,"release":release,"coherent_execution":receipt,"initial_failed_execution":failure,"evidence":files,
"decision":"Engineering lineage delivered; no new empirical efficacy or qualified issuer case. Original denominators/frozen studies unchanged."}
if Path("/tmp/chained-live-receipt.json").exists():
 summary["live_readonly_receipt"]=json.loads(Path("/tmp/chained-live-receipt.json").read_text())
summary["release_observation_note"]="Initial bounded CI polling shell exited -1 without output; separate observed run43160860130 validate/promote both completed success. No restart/cancel/bypass."
for stage in x["stages"]:
 for q in stage["requirements"]:
  if q["id"] not in files:continue
  q["chained_increment"]={**summary,"sources":[{"path":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"detail":json.loads(Path(f).read_text())} for f in files[q["id"]]]}
  q["files_functions_changed_this_increment"]=changes[q["id"]]
  q["behaviour_delivered_this_run"]=summary["decision"]+" See clause-local chained_increment exact evidence."
  q["remaining_gaps"]=[gaps[q["id"]]];q["next_action"]=gaps[q["id"]]
  q["executions"]=(q.get("executions")or[])+([receipt] if receipt not in (q.get("executions")or[]) else [])
  q["check_scope_this_increment"]="Engineering/source qualification, not independent scientific or owner acceptance."
x["latest_increment"]["signal_chained"]=summary;x["updated_at"]=stamp
x["restart"]["instruction"]="Continue original0–17. SIX signal/gap JSON/XLSX chains now implemented/tested beyond prior threePE. Preserve exact ordered parents/material/code/model/snapshots/intermediates/filter/order/units; request-start selection pin fixes delayedresponse race; literal-cell checks refuse formulas/links. Nonempty evidence engineeringfixtures, not genuine historical efficacy. Continue OTHER non-signal/custom consumers and qualifiedrealinput journeys, not restart completednine. DEVoperatorCLI export lifecycle preserved; HTTP403 requires genuineprincipal, no activation/oldXLSXrecovery; old124/179/416 untouched. NewXPLR cash/FCFBG closes but notNEErecipientcash; Williams capacity notpricedCCS; TamilNadu programme notFSLR; Q3filing403 unverified. Continue named issuer economic fields and compatible22driver/fullwindow/historical11–15 evidence;0eligiblehistories/0of3cases. Frozennegative studies/Gordon/14FaIRpins/original1000of1001 unchanged. Inspectcurrent_release vsdocs/localreceipt; existingpromotion only."
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
f.write_text("# Signal/chained consumer integration and new issuer source evidence\n\n```json\n"+json.dumps(summary,indent=2)+"\n```\n\n"+f.read_text())
