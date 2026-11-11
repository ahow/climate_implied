import json,datetime,hashlib,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e=json.JSONDecoder().raw_decode(Path("/tmp/grant-final.log").read_text())[0]
groups={
"S04-003":(["docs/kaya-joint-territorial-source-evidence.json"],"3285native territorial quadruples/2844numericallycomplete;105regional rows/75numericallycomplete. EUenergy aggregation disagrees all15years;World energy residual notbunker estimate. Originalprotocols unchanged; no forecast scoring.","Resolve exactnull/identity/territory/bunker andEUenergy aggregation gaps in retained joint census; no PPPsplice or residual imputation."),
"S12-008":(["docs/fslr-grant-scope-evidence.json"],"997.6m specific45Xbenefit differs from1014.121m all-income grants.8.721m bridge decomposed into16.521m scope difference and−7.8m mixedscope residual; neither othergrantcash.19.711/19.712m nativeasset/noncash differences do not explain19.676m cash bridge. Old32rows/conditionalvalues unchanged.","Obtain programme-specific recognition/receivable/collection rollforward; exactQ1day remains undisclosed in examinednote, retain boundedtiming."),
"S12-017":(["docs/nee-related-source-followup-evidence.json"],"ActualexecutedNEE-related LLCcontracts sourcecash/taxpriority/flip/buyout rules.422m scopeddistributions separate58m contributions; no inferred364m netcash orprojectIRR. Conditional normalizedclaim96.5%preflip/18.82%postflip; actualAvailableCash missing.0/3qualified.","Inspect filingattachment inventory for referencedExhibitB ExcelIRRmodel andactualdatedAvailableCash; do not treat contractualIRR as projectreturn."),
"S01-001":(["docs/fslr-grant-scope-evidence.json","docs/nee-related-source-followup-evidence.json"],"Three newpublic sourcedfacts/formulas bound inreadonlyAPI/UI/XLSX;84conditionaldefinitions. Original1000/1001unchanged.","Originalopaque summary leaf stillneeds producer provenance; newfacts do notclose originalgap.")}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] not in groups:continue
  fs,behavior,nxt=groups[r["id"]]
  r["grant_kaya_increment"]={"evidence":[{"path":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"detail":json.loads(Path(f).read_text())} for f in fs],"execution":e}
  r["executions"]=(r.get("executions") or [])+[e];r["behaviour_delivered_this_run"]=behavior;r["next_action"]=nxt
x["latest_increment"]["grant_kaya"]={"execution":e,"counts":"41verified257partial2blocked","release":"Local implementation validated; release receipt pending","clauses":list(groups)}
x["restart"]["instruction"]="Continue actualLLCExhibitB attachment/cash-series retrieval and FSLRprogrammecashrollforward. Kaya jointcensus is nowassembled with exactEUenergy/residual/identity/null gaps; resolve compatiblebasis beforefrozenholdouts. PrivateFaIRtransfer awaitsManusoperator investigation;155bd3ffbundle unchanged. No unchangedUI/bundle/mining audits.0/3cases,no efficacy."
x["updated_at"]=datetime.datetime.now(datetime.timezone.utc).isoformat();p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Grant/LLC and joint territorial input implementation — release pending\n\n"+json.dumps(x["latest_increment"]["grant_kaya"],indent=2)+"\n\n"+"\n\n".join(k+": "+v[1]+"\nNext: "+v[2] for k,v in groups.items())+"\n\n"+f.read_text())
