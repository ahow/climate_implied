import json
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
receipt=json.JSONDecoder().raw_decode(Path("/tmp/analytics-separated.log").read_text())[0]
separation=json.loads(Path("docs/driver-validation-separation-evidence.json").read_text())
inc=x["latest_increment"]["substantive_analytics"]
inc["final_code_only_and_private"]={"receipt":receipt,"public_typescript":{"pass":482,"fail":0,"skip":0},
 "mandatory_private_driver":{"pass":4,"fail":0,"skip":0},"public_python":{"pass":117,"fail":0},
 "mandatory_private_wind":{"pass":4,"fail":0},"other_mandatory_private_issuer_checks":"Passed in20261110T141541180337Z.log; source and calculation modules unchanged by validation separation.",
 "ci_failure":"42833772416 failed; promote skipped. Real-retained loader assertions depended on intentionally unexported private inputs. All assertions moved intact to mandatory private commands; synthetic source-only coverage remains. No skip, raw-data export or weakened production gate.",
 "separation":separation}
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in inc["changed_original_ids"]:
   r["executions"].append(receipt);r["analytics_final_code_only_and_private"]=inc["final_code_only_and_private"]
p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+"\n")
with Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md").open("a") as f:
 f.write("\n### Final source-only/private validation boundary\n\n"+json.dumps(inc["final_code_only_and_private"],indent=2)+"\n\n")
 f.write("Prior484/121 local combined receipts retained, not substituted for final split counts:482publicTS+4mandatoryprivateTS;117publicPython+4mandatoryprivatePython, allzero failures/skips. Mandatory private issuer and historical-code checks passed separately. Tests moved intact, not removed; missing private sources demonstrably fail their required validator. No raw retained inputs exported.\n")
