"""Record integrated receipts without changing original criteria."""
import json,subprocess
from pathlib import Path
from collections import Counter
import importlib.util
spec=importlib.util.spec_from_file_location("merge",Path(__file__).with_name("merge-clause-reconciliation.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
receipt=json.JSONDecoder().raw_decode(Path("/tmp/ready-coherent.log").read_text())[0]
python_receipt=json.JSONDecoder().raw_decode(Path("/tmp/ready-rest.log").read_text())[0]
paths=sorted(set(subprocess.check_output(["git","diff","--name-only"],text=True).splitlines()+subprocess.check_output(["git","ls-files","--others","--exclude-standard"],text=True).splitlines()))
prior=x["latest_increment"]["ready_implementation_20261110"]
prior.update(verification=receipt,python_verification={"tests":106,"pass":106,"fail":0,"skipped":0,"log":python_receipt["log"],"command":"uv run python -m unittest discover -s script -p test_*.py","executed_at":python_receipt["executed_at"],"boundary":"Python passed; subsequent old-source validation initially failed, then was repaired using pinned historical code and passed in final coherent receipt."},
 changed_paths=paths,coverage={"original_bound":1000,"original_total":1001,"original_gap_closed_this_increment":0,"original_remaining":1,"definitions":1553,"current_bound":1306,"current_total":1307,"expanded_bound":1334,"expanded_total":1335,"withheld":27,"aliases":4,"download_sites":23,"concrete_export_bindings":103},
 failures_preserved=["First integrated TS430/434; second433/434. Fixed actual disclaimers, stale generated output register and historical proposal comparison without removing assertions.","Historical private validator detected code drift; exact frozen code was recovered/hashed/executed, not refrozen or skipped."],
 source_outcomes=["3 exact-date FMP requests200; currency/class/completecase inputs still unresolved;0/3qualifiedcases.","Actual2025 SR1.5GMST1.37 versus Annual1.38;2016–2025mean1.24[1.0,1.5]. No attributed-modelGMST certification.","27native conditional accounts; legacy60.3 unverified baseline withholds. No nativeGWP/mass mixing.","CO2 forcing raw/alignedRMSE0.0870798/0.0873259Wm2; no fitting or promotion."],
 stop_reason="Approaching context limit after substantive implementation, integrated repairs and gated release; original scope remains incomplete.")
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in prior["changed_original_ids"]:
   r["executions"].append(receipt)
   r["ready_implementation_check"]={"scope":"Final coherent implementation receipt; total test count is suite-wide, not a clause-specific test count.","receipt":receipt}
   r["live_release_observation"]="Pending new gated promotion; prior verified d843960 remains until exact runtime receipts."
x["restart"]["instruction"]+=" Three FMP exact-date requests nowSUCCEEDED: FSLR2025-02-21,NEE/XOMpredecessor2025-01-31. Currency/class/fullstub-terminal inputs stillneeded; docs403 wasNOTentitlementfailure. Native27source-derivedconditionaldiagnostics nowimplemented;legacy60.3withholds. Preserve frozen FSLRhistoriccode archive and mandatoryprivatevalidation; do notrefreezeoldstudy tohidecode drift."
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
counts=Counter(r["status"] for s in x["stages"] for r in s["requirements"])
text="\n\n## Ready implementation integration — 2026-11-10\n\n"
text+=f"Original clause counts: {dict(counts)}. Original contract hash unchanged. Independent acceptance unclaimed.\n\n"
text+="439/439 TypeScript;0 failures/skips.106/106 Python separately. Typecheck/build, mandatory private validators, pinned historical FSLR10cases/50rows and changed running threshold API smoke passed. Logs: `"+receipt["log"]+"` and `"+python_receipt["log"]+"`. Prior failed attempts retained above/in canonical records.\n\n"
text+="Original semantics1000/1001, no original closure this increment;1 opaque historical summary remains.1553 definitions; current1306/1307 and expanded1334/1335.27 withheld/4aliases separate;23downloadsites/103concretebindings. Added306 current-public slots since1001 cohort; expanded adds28 nominal-output leaves (334 total added), not original closure. Strict unknown-summary gate intentionally fails.\n\n"
text+="New: producer/version/source-manifest summary sidecars; actual-r Gordon labels; exact selected2024 5% diagnostics with legacy-default withholding and27conditional native accounts; original2.5–4% nominal terminal/fade endpoint; all-scope abatement/replay; operator-only news refresh and read-only scheduler census; dated FCFE stubs and3exact-date price candidates; actual2025 human-GMST source, retained forcing reconciliation. No new empirical model accepted, no three qualified issuer cases or historical new-gap efficacy.\n\n"
text+="Per-clause evidence: S00-004/005/010,S01-001/004/007,S07-008,S11-010,S12-001/014. Detailed proposal files: docs/next-{summary,threshold,valuation,accounting,company,physical}-evidence.json and docs/Privileged_Operation_Execution_20261110.md. Actual outcomes and narrow gaps are in each canonical clause, not only this increment.\n\n"
text+="### Complete changed-path index\n\n"+"\n".join("- `"+v+"`" for v in paths)+"\n"
text+="\nRelease boundary: implementation pending existing Git/CI/Railway gates; prior verified runtime d843960. A later receipt records exact promotion; local documentation is not itself a deployment.\n"
Path("docs/READY_IMPLEMENTATION_20261110.md").write_text(text)
with Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md").open("a") as f:f.write(text)
print(dict(counts))
