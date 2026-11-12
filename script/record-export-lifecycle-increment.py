import json,datetime,hashlib,importlib.util,sys
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
files={"S16-007":["docs/new-export-lifecycle-evidence.json","docs/derived-consumer-evidence.json"],
"S03-007":["docs/indicator-issuer-new-evidence.json"],
"S04-005":["docs/highfrequency-new-source-evidence.json"],
"S12-017":["docs/indicator-issuer-new-evidence.json"]}
gaps={"S16-007":"Actual DEV workspace-operator CLI persistence/read lifecycle and three closed P/E derivations delivered. No genuine HTTP operator principal/publication exists; private HTTP remains403. Permanent activation not performed. Other signal/chained consumers still need exact lineage; real nonempty P/E browser export remains unavailable. Old124 results have no original XLSX attachments; new captures never recover them. Application append-only is not owner/root-resistant WORM; crash-left staging needs authorized recovery.",
"S03-007":"CAT product metadata/rights qualified only as recorded; design ratings do not establish implementation or curated historical calibration. No numeric history substituted. Continue remaining compatible full-window source/uncertainty/calibration evidence; nominalWB and SBTi limitations unchanged.",
"S04-005":"Existing Carbon Monitor routes reviewed without repeat requests. No qualified original-release numerical rows for2024/2025/2026; 2025 report projections, 2026 supplement annual growth and bunker inclusion are not qualified monthly targets. Need author-published original-release/version archive mapping, immutable files, dates/cutoffs, rights and complete country/sector data. No public locator identified or author contact initiated; frozen EIA estimator not transplanted.",
"S12-017":"New NEE interim service costs/receivable/net-sweep disclosures do not identify gross LLC cash, recipient cash, commissioning/marginal returns or attributable FCFE. FSLR/XOM additional source routes unlocated/unattempted this increment, not globally unavailable. Need programme cash/eligible watts/BOM/current-law and executed CCS operating instrument/novation/billings/opex/funding; no source-to-cash invention."}
receipt=json.loads(Path("/tmp/lifecycle-final-receipt.json").read_text())
changes={"S16-007":["server/snapshots/prospectiveResultExportLifecycle.ts:captureStoredProspectiveResultExport,readStoredProspectiveResultExport","server/prospectiveResultExportApi.ts:denyPrivateProspectiveExport,registerProspectiveResultExportBoundary","script/operator-prospective-result-export.ts","shared/derivedConsumer.ts:deriveValuationPE","client/src/lib/derived-consumer-workbook.ts:appendDerivedConsumerWorkbookLineage,verifyDerivedConsumerWorkbook"],
"S03-007":["server/calculation/indicatorSourceMetadata.ts:indicatorSourceDocuments,admitIndicatorSourceMetadataProposal,indicatorSourceMetadataProposal"],
"S04-005":["docs/highfrequency-new-source-evidence.json"],
"S12-017":["docs/indicator-issuer-new-evidence.json"]}
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] not in files:continue
  q["export_lifecycle_increment"]={"evidence":[{"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"detail":json.loads(Path(f).read_text())} for f in files[q["id"]]],"coherent_execution":receipt}
  q["files_functions_changed_this_increment"]=changes[q["id"]]
  q["check_scope_this_increment"]="Development engineering and source qualification only; no scientific or owner acceptance."
  q["scientific_decision_this_increment"]="No calibration, numeric-history replacement, issuer-case qualification or efficacy promotion."
  if receipt not in (q.get("executions")or[]):q["executions"]=(q.get("executions")or[])+[receipt]
  q["behaviour_delivered_this_run"]="See exact implementation/source/test receipts: "+", ".join(files[q["id"]])
  q["remaining_gaps"]=[gaps[q["id"]]];q["next_action"]=gaps[q["id"]]
  q["blockers"]=[{"kind":"remaining original scope","detail":gaps[q["id"]]}]
summary={"updated_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":receipt,"evidence":files,
"counts":"56verified242partial2blocked; original1000/1001;0eligiblehistories;0/3qualifiedcases",
"scope":"Real DEV CLI NEW-export persistence/read/retry/concurrency verified; old archives unchanged. Three derived P/E consumers bound with nonempty fixture XLSX readback, not nonempty real browser/science. CAT metadata and new NEE source findings; no FCFE/calibration promotion.",
"release":"Pending existing validation/promotion; previous verified runtime remains distinct."}
if len(sys.argv)==4:
 r={"github_main":sys.argv[1],"ci":sys.argv[2],"railway_deployment":sys.argv[3],"verified_at":summary["updated_at"],"health":200,"scope":"Code-only; no permanent export/data/owner/scientific activation."}
 x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=r;summary["release"]=r
for stage in x["stages"]:
 for q in stage["requirements"]:
  if q["id"] in files:q["export_lifecycle_increment"]["release"]=summary["release"]
x["latest_increment"]["export_lifecycle"]=summary;x["updated_at"]=summary["updated_at"]
x["restart"]["instruction"]="Continue original0–17. NEW export lifecycle now wired through existing DEV workspace operatorCLI: immutable0600 files in explicit existing0700 private directory, retries/concurrency/access/parent/version/corruption checked with genuine retained DEV parent. Old124results and179headers/416chunks unchanged. HTTP403 genuine-principal gap remains; no permanent activation or original-XLSX recovery. Three P/E chart/export derivations now bind parent/filter/order/units and real binary cells; nonempty fixtures engineering only, actualcurrent P/Eempty. Finish other signal/chained consumers and authentic HTTP/production activation only through existing controls. CAT metadata noncommercial-rights restriction; design not implementation. NewNEE120mservice costs/net sweeps notgrosscash/FCFE. Continue specificNEE/FSLR/XOM source economics and compatible22driver/historical11–15 inputs, no repeated kernels or invented facts. Original1000/1001 and science gates unchanged; preserve all14FaIRpins/bundle. Inspect exactcurrent_release; docs/local receipts not runtime."
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
f.write_text("# Private export lifecycle, derived consumers and new source findings\n\n"+json.dumps(summary,indent=2)+"\n\n"+f.read_text())
