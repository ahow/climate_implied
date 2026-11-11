import json,hashlib,datetime,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text());e=json.JSONDecoder().raw_decode(Path("/tmp/fair-components-final.log").read_text())[0]
summary={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":e,
"fair":"24route surfaces inventoried; explicit exactartifact/version/manifest/ensemble/memberhash selection and refusal.16retained ensembles/13456members independently validated;96actualconsumer invocations. NoPythonHTTP/no scientificpromotion. Deploymentprivateartifact availability still separate.",
"component":"60/60actualdynamiccomponents cumulatively invoked;1738JSX/106bindings. New36cohort and focusedportal/hover/export/archive flows. Initial10flowplan6pass2fail1partial1unrun; targeted4residualflows4pass after actualfocus/title/source/refetch fixes. Historicalnull-datehover limitation retained, no all-field/all-branch claim/no unchanged41suite rerun.",
"issuer":"Actual FSLR selected3transfercohorts2258.8mface→2154.9mreceived/proceeds,103.9mdifference; separate117.6mTreasurycash; selectedobservedreceipts2272.5m. NotfullGAAPgrants/CFO andno doubleaddition. EnLink2024Q3routefinancinguncertain; CF2025interimEOR/Rosepermit dependency invalidates assumedhistoricalroutecontinuity.0/3qualified.",
"next":"Complete residual per-field/branch contracts beyond60componentinvocation and preserve targetedbrowser evidence. Deploy authorized exactofflineartifact bundle via existing supported private provisioning, never regeneratePythonHTTP. Separately integrate actualcredit receipts with retained2023origin/othergrant normalization and stubbasis; find laterEnLink/ONEOKarrangement/Rosepermit, actualCCSfees and NEEcashpriorities. Scientificjoint/physical/historicalcorpus gates remain; no proxy efficacy.",
"counts":"40verified258partial2blocked; original1000/1001;0/3qualified. No whole-stage acceptance."}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S07-002","S12-001","S16-005"]:
   r["executions"].append(e);r["next_action"]=summary["next"];r["behaviour_delivered_this_run"]=summary[{"S07-002":"fair","S12-001":"issuer","S16-005":"component"}[r["id"]]]
   if r["id"]!="S16-005":
    f={"S07-002":"docs/originalS07-002-route-artifact-evidence.json","S12-001":"docs/issuer-cash-collections-evidence.json"}[r["id"]]
    r["fair_component_evidence"]={"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest(),"details":json.loads(Path(f).read_text())}
   else:r["remaining_gaps"]=["All60components directly invoked; cumulative targeted10logicalinteraction flows resolved with separatefailed/followup receipts. Exhaustive dynamicfield/branch combinations and null-date no-hover behavior are not an all-fields pass."]
   if r["id"]=="S07-002":r["remaining_gaps"]=["ExactversionedNodeconsumers and missing/corrupt/versionrefusals implemented/retained validated; deployed authorized privateensemble availability remains unproven. NoPythonHTTP. Scientificacceptance belongs to separatecriteria."]
x["latest_increment"]["fair_component"]=summary;x["restart"]["instruction"]=summary["next"]+" "+summary["counts"];x["updated_at"]=summary["at"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Offline ensembles and remaining component contracts — validated; release pending\n\n"+json.dumps(summary,indent=2)+"\n\n"+f.read_text())
