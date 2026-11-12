import json,datetime,hashlib,importlib.util,subprocess,sys
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e=json.JSONDecoder().raw_decode(Path("/tmp/review-final2.log").read_text())[0]
changes={
"S03-004":("docs/S03-004-persistence-evidence.json","Added append-only DEVELOPMENT source/review persistence, pinned historical selection and calculator/API-test/UI/XLSX roundtrip. Four states preserved, interior blanks and supplied paired draws only. Public reads corrected to403 before private-store access; default application never mounts engineering injection.","Actual private HTTP/UI access requires genuine operator principal or independently trusted disclosure. Production persistence and real source uncertainty remain unqualified."),
"S16-006":("docs/readonly-diff-history-evidence.json","Mounted read-only explicit-version carbon/SDG/financial/driver comparisons and paginated exact affected-analysis references. Counts/hashes only, no private source values. Missing/corrupt/version mismatch refuses without current fallback.","Privileged refresh/import/restore remains unavailable; readonly comparison is not a completed operational refresh."),
"S09-001":("docs/readonly-diff-history-evidence.json","Three exact original type codes/labels bound to recalculations, reviewed response headers, charts and historical/affected-analysis exports. Current-model reconstructions explicitly revised history; missing or inconsistent labels withhold downloads.","Authentic archived-forecast/verified-past-input corpus and cutoff-only parameter estimation remain absent. Do not infer universal run coverage from selected paths."),
"S12-007":("docs/carbon-pass-through-source-evidence.json","Retrieved original pass-through literature and added frozen source admission plus actual optional companyProjection carbonDrag/tax/FCFE consumption. German peak117% preserved; refinery ratios distinguished from log elasticities and insignificance. Exact regime/product/geography and incremental Scope1 accounting gates; no issuer cash evidence invented.","No actual issuer assumption admitted. Need issuer-owned activity, paid/net allowance costs, recovery collection/lag, taxes, working capital and common-owner cash; source price formation is not cash."),
}
for s in x["stages"]:
 for q in s["requirements"]:
  if q["id"] in changes:
   f,b,g=changes[q["id"]]
   q["review_history_increment"]={"evidence_file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"detail":json.loads(Path(f).read_text()),"coherent_execution":e}
   q["behaviour_delivered_this_run"]=b;q["remaining_gaps"]=[g];q["next_action"]=g
   q["blockers"]=[{"kind":"specific remaining original scope","detail":g}]
   q["executions"]=(q.get("executions")or[])+[e]
  elif q["id"]=="S03-009":
   q["review_history_increment"]={"files":["server/calculation/legacyDriverAdmission.ts","server/calculation/forwardProjection.ts","server/calculation/driverConsumptionTrace.ts","script/legacy-driver-admission.test.ts"],"behavior":"All19 actual legacy indicator parameters have explicit roles. Calculator rejects central/accepted-sensitivity mode before reading coefficients; default seeded comparator remains numerically identical. Native registry acceptance remains separate.","test":"2/2 focused; included in coherent execution","execution":e}
   q["remaining_gaps"]=["No accepted calibrated joint headline exists; diagnostic coefficients remain uncalibrated, never promoted by this role guard."]
   q["next_action"]="Supply accepted source-linked native mechanisms/distributions; preserve legacy-only comparator gate."
summary={"executed_at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":e,
"counts":"56 verified /242 partial /2 blocked; original1000/1001;0eligible histories;0/3qualified issuers",
"failures":"First integrated923TS:908pass15fail. Second930TS:928pass2fail. Actual missing-type fixture, SSR env, component policies and precise semantics/export census corrected. Legacy workbook metadata was wrongly broadened; restored EXACT old meaning/formula/golden, scoped new semantics to opt-in only. No golden repin or weakened gates. Detailed logs retained.",
"semantics":"Original1000/1001 unchanged. New22 diff export slots exactly bound; supplemental360/360, public1360/1361;2111definitions;68components. No new original closure credit.",
"scientific":"No old negative study rerun; no calibrated ensemble or actual issuer/history efficacy claimed.",
"release":"Pending new coherent source promotion; previous verified3413ebc remains distinct.",
"changed_paths":subprocess.check_output(["git","diff","--name-only","721faf8"],text=True).splitlines()+subprocess.check_output(["git","ls-files","--others","--exclude-standard"],text=True).splitlines()}
if len(sys.argv)==4:
 r={"github_main":sys.argv[1],"ci":sys.argv[2],"railway_deployment":sys.argv[3],"verified_at":summary["executed_at"],"health":200,"affected":"history-types200; pass-through evidence200; missingness403; invalid explicit-version diff422; no data/approval activation"}
 x.setdefault("release_history",[]).append(x["current_release"]);x["current_release"]=r;summary["release"]=r
x["latest_increment"]["review_history"]=summary
x["restart"]["instruction"]="Continue original work: DEVELOPMENT missingness persistence/review/calculator/XLSX implemented, privateHTTP403 pending genuine principal; read-only diffs/affected results and historical labels implemented but refresh/import and authentic histories missing. New source-backed pass-through component consumes declared incremental Scope1 assumptions in FCFE; no issuer economics admitted. All19legacy parameters diagnostic-only gate; 22driver source/calibration gaps stillunqualified. Preserve all frozen negatives, original1000/1001,0/3cases. Check latest CI/runtime vs docs receipt before further work. All14 FaIR source pins unchanged; no bundle replacement needed."
x["updated_at"]=summary["executed_at"];p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Persisted missingness, historical identity and source-qualified pass-through\n\n"+json.dumps(summary,indent=2)+"\n\n"+"\n\n".join(k+": "+v[1]+"\nRemaining: "+v[2] for k,v in changes.items())+"\n\n"+f.read_text())
