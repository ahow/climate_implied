import json,datetime,hashlib,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e=json.JSONDecoder().raw_decode(Path("/tmp/render-company-pass.log").read_text())[0]
summary={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"execution":e,
"browser":"41 distinct synthetic GET-only cases executed:40pass/1timing-assertion failure; narrow correctedcase subsequently1/1pass. Historical failures retained. Independent NEE/FSLR/XOM panel loading/error/partial/selection checked;XOM103JSONleaves=103XLSXrows. Not scientific/whole-stage acceptance.",
"issuer":"New NEE remittance/counterparty48assessments/768cashrows:48positive terminals,47positive planvalues,1refused NPV; signedPV -477.512m to17.945bn.156negative annual rows.0/3qualified. No previouskernel reruns.",
"ui":"GET-only allowlisted conditional company panel/API/JSON/XLSX integrated; no private/provider rawbytes. Source/conditional/formula/unit/refusal separation. Nozero-fill/stalecached selection data; legitimatezeros preserved.",
"coverage":"Original1000/1001 unchanged;1774definitions;expanded1555/1556.63supplemental APIsemantic entries notoriginalclosure.",
"next":"Continue NEE undisclosed gross distributions/LLC priorities/project marginalreturns and XOM source economics; realhistorical control/forcing/native-boundary evidence and genuine dated11–15corpus. Preserve rendered fixture coverage, extend futurechangedcomponents only; originalopaque summary and authenticated isolatedmutation/provisioning remain narrow gaps."}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S03-002":
   r["remaining_gaps"]=["No accepted real joint regional distribution/native inventory or scientific forecast acceptance; canonical role/admission mismatch was fixed and is not an open engineering gap."]
   r["next_action"]="Obtain qualified joint distributions/inventory and independent scientific acceptance without weakening canonical role admission."
  if r["id"] in ["S12-001","S16-005","S16-010"]:
   r["executions"].append(e);r["rendered_company_increment"]=summary;r["next_action"]=summary["next"]
   if r["id"].startswith("S16"):
    r["remaining_gaps"]=["Rendered synthetic all-route state coverage and conditional panel/export checks now exist; genuine data/owner/scientific acceptance and exhaustive future dynamic combinations are not established."]
for f in ["docs/nee-remittance-counterparty-evidence.json","docs/company-conditional-integration-evidence.json"]:
 summary.setdefault("focused_evidence",[]).append({"file":f,"sha256":hashlib.sha256(Path(f).read_bytes()).hexdigest()})
x["latest_increment"]["rendered_company"]=summary;x["restart"]["instruction"]=summary["next"]+" "+summary["browser"]+" "+summary["issuer"];x["updated_at"]=summary["at"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n");Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
f=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");f.write_text("# Rendered company integration — validated, release pending\n\n"+json.dumps(summary,indent=2)+"\n\n"+f.read_text())
