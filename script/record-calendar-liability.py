import json,hashlib,datetime,importlib.util,subprocess
from pathlib import Path
spec=importlib.util.spec_from_file_location("m",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
receipt=json.JSONDecoder().raw_decode(Path("/tmp/recovery-final-pass.log").read_text())[0]
groups=[
 (["S01-001","S15-009"],"docs/return-calendar-evidence.json",
 ["server/calculation/returnQualitySourceConvention.ts","script/validate-return-calendar-private.ts","script/return-quality-source-convention.test.ts","script/capture-return-publisher-docs.ts"],
 "Established original M/empty-end/X(RI)~U$ formula metadata and retained day22 labels; no inferred trading-date/FX/dividend methodology. Reproduced one mismatch through PostgreSQL real/text representation in read-only transaction; not historical importer proof.",
 "99/100 original XLSX boundaries exactly equal;100/100 immutable/recovery boundaries equal; original/frozen discrepant numbers share binary32 bits.0/50qualified comparisons; no repairs, date substitution or break-rate claim.",
 "Obtain applicable licensed publisher RI/calendar/FX/dividend/adjustment methodology and original upload/import linkage, then exact historical listing/source reconstruction; preserve fixed50 and raw bytes."),
 (["S12-001"],"docs/xom-climate-liability-evidence.json",
 ["server/calculation/xomClimateLiabilityCase.ts","script/run-xom-climate-liability-case.ts","script/validate-xom-climate-liability-private.ts","script/xom-climate-liability-case.test.ts","script/capture-xom-climate-liability-sources.ts"],
 "Added source-bound permit/legal liability component integrated as incremental expense/recovery/AR/CFO/FCFE only; no second subtraction of unidentified embedded baseline carbon expense.",
 "Two exact permit/legal joins;24 conditional component cases;384 independently reconciled cash rows and768 allowance-unit rows. Price/FX/banking/allocation/pass-through/timing remain explicit conditional assumptions.0/3qualified full issuer cases.",
 "Resolve source statutory gas/unit boundaries, permit/site scope and actual banking/purchase/cash timing; qualify full original operating inputs and owner identity separately; preserve all prior no-root findings.")
]
for ids,path,files,behavior,result,next_action in groups:
 data=json.loads(Path(path).read_text());h=hashlib.sha256(Path(path).read_bytes()).hexdigest()
 for s in x["stages"]:
  for r in s["requirements"]:
   if r["id"] not in ids:continue
   r.setdefault("before_calendar_liability",{k:r.get(k) for k in ["files_functions_changed","behaviour_delivered_this_run","inputs_versions_assumptions","numerical_results","next_action"]})
   r["files_functions_changed"]=(r["files_functions_changed"] or [])+[f for f in files if f not in (r["files_functions_changed"] or [])]
   r["behaviour_delivered_this_run"]=behavior
   if not isinstance(r["inputs_versions_assumptions"],dict):r["inputs_versions_assumptions"]={"prior":r["inputs_versions_assumptions"]}
   r["inputs_versions_assumptions"]["calendar_liability"]={"file":path,"sha256":h,"details":data}
   if not isinstance(r["numerical_results"],dict):r["numerical_results"]={"prior":r["numerical_results"]}
   r["numerical_results"]["calendar_liability"]=result;r["next_action"]=next_action
   r["executions"].append(receipt)
   r["remaining_gaps"]=list(dict.fromkeys(r["remaining_gaps"]+[next_action]))
paths=sorted(set(subprocess.check_output(["git","diff","--name-only"],text=True).splitlines()+subprocess.check_output(["git","ls-files","--others","--exclude-standard"],text=True).splitlines()))
summary={"recordedAt":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":receipt,"changedPaths":paths,
 "counts":"521publicTS/0fail/0skip;128publicPython passed; both new mandatoryprivate validators passed; typecheck/build passed.",
 "initialFailure":"519/521 TS: stale census inventory for three new XLSX test-fixture sheets. Regenerated inventory only; no original denominator/strict-gate change.",
 "coverage":"Original1000/1001 unchanged;1703definitions,current1323/1324,expanded1484/1485;4aliases/27withheld separate.",
 "status":"39verified259partial2provisioning-blocked0unreconciled;0/3qualified original issuers;0/50qualified return comparisons. No scientific acceptance or production activation.",
 "handoff":"Explicit terminal-only wrapper saves before operation and before existing idempotent callback;5offline cleanup tests and6existing handoff tests. Process/platform death remains uncatchable/unproven. No callback sent during work."}
x["latest_increment"]["calendar_liability_recovery"]=summary
x["restart"]["instruction"]="Continue alloriginal0–17/amendments. Preserve521publicTS/128Python plusnewmandatoryprivate checks; original1000/1001unknown. Newcalendar evidence: originalmonthlyM/X(RI)~U$/empty-end metadata;oneboundaryfloat32/textrepresentation reproduced, not ingestion/vintage proof.0/50return comparisons; obtain applicable RI/FX/calendar/dividend methodology and originaluploadlink, no nearestdate. NewXOMtwo-permit incremental liability24componentcases/384cash/768allowance rows is conditionalonly, notfullissuer; baselineexpense notdeductedtwice.0/3qualified originalcases. Continue NEE project/noncommon inputs,FSLR source-qualified terminal/capacity, genuine historicalIGCC/native/memberandjointdriver evidence and actualdatedStage11–15corpus. Preserve allfrozennegativebeta/fleet/EV/storage/Gordonprimary andscientific/auth/owner gates. Existingterminalwrapper onlytrueend; nooldmatchedcallbackresend."
x["updated_at"]=summary["recordedAt"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
report=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md")
text=report.read_text().replace("**511 public TypeScript tests and123 public Python tests**","**521 public TypeScript tests and128 public Python tests**",1)
text+="\n## Calendar provenance, incremental liability and cleanup integration\n\n"+json.dumps(summary,indent=2)+"\n"
for ids,path,files,behavior,result,next_action in groups:
 text+=f"\n### {', '.join(ids)}\n{behavior}\n\n{result}\n\nNext: {next_action}\n\nEvidence: `{path}`; paths: "+", ".join(f"`{f}`" for f in files)+"\n"
report.write_text(text)
