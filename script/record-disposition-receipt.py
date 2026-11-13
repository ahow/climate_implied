import json,importlib.util,subprocess
from pathlib import Path
b=Path("generated-artifacts/dated-cash");p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
publication={"workspace_code":"6bdb5d5a6f69f003df65a16fc847149221d4b209","public_source":"74988dcc4216663051a7cb2119f4b7fa5d29e516",
 "ci":json.loads((b/"disposition-ci-latest.json").read_text()),"promotion":json.loads((b/"disposition-promotion-status.json").read_text()),
 "boundary":"Local standard-clause evidence corrections are receipt-only, not republished. Public source includes new code and structured clause evidence; no new runtime assertion without readback."}
x["latest_increment"]["publication"]=publication;x["pending_release"]=publication
if (b/"disposition-live.json").exists():
 live=json.loads((b/"disposition-live.json").read_text())
 if live.get("passed") and live.get("source")==publication["public_source"]:
  if x["current_release"].get("runtime")!=live["source"]:x.setdefault("release_history",[]).append(x["current_release"])
  x["current_release"]={"runtime":live["source"],"ci":43356930092,"conclusion":"success","readback":live,
   "scope":"Observed2023 accounting/privacy only, not new private asset execution or issuer/science acceptance"}
  x.pop("pending_release",None)
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["git_commit"]=publication["public_source"]
   r["deployment_revision"]=x["current_release"]["runtime"]
   r["revisions"]["cutoff_asset_disposition"]=publication
   r["revision_boundary"]="New asset code/public validation are distinct from observed runtime and synthetic private execution."
x["next_action"]="Continue ALL original0–17. CI43356930092 validate+promote SUCCESS and production-validated=74988dcc; last measured runtime217b0f9, so reconcile existing Railway rollout/read exact749 health/observedJSON-XLSX without restarting/superseding/receipt-only push. Implementation6bdb5d5; local per-clause evidence corrections separate. Preserve cutoff-disposition-1/v4 cash branch and earned gates. NEXT explicit post-disposition issuer-rights vs physical-stock ledger (sale is not retirement), matched delayed operating/accrual/cash intervals, already-accrued obligation item matching/recovery eligibility, then funded sustainable cycles and compatible full-domain inversion. Current immediate-cutoff cash bridge is NOT full liquidation/whole-equity/science. Genuine principal absent, private403 intact. NucorEx99.2 new examination resolved no pricing/billing/funding cash; no repeat.65verified233partial2blocked/all300/0of3 unchanged."
if "pending_release" not in x:
 x["next_action"]=x["next_action"].replace("last measured runtime217b0f9, so reconcile existing Railway rollout/read exact749 health/observedJSON-XLSX without restarting/superseding/receipt-only push.",
  "exact runtime74988dcc/health200/observedJSON-XLSX/private403 now verified; do NOT repeat unchanged promotion/readback. This is observed2023 only, not private future/issuer execution.")
x.setdefault("restart",{})["instruction"]=x["next_action"]
for stage in x["stages"]:
 for requirement in stage["requirements"]:
  if requirement["id"]=="S13-004":
   requirement["next_action"]=x["next_action"]
   requirement["nextAction"]=x["next_action"]
   requirement["gaps"]=requirement["remaining_gaps"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");marker="<!-- disposition-publication-history -->\n";text=r.read_text()
if marker in text:text=text.split(marker,1)[1]
r.write_text("# Current asset-disposition publication receipt\n\n"+json.dumps({"current_release":x["current_release"],"pending_release":x.get("pending_release"),"publication":publication,"next_action":x["next_action"]},indent=2)+"\n\n"+marker+text)
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
h=Path("docs/TERMINAL_VIEWER_HANDOFF.md")
h.write_text("# Current compact continuation (local receipt)\n\n"+x["next_action"]+
 "\n\nEvidence: generated-artifacts/dated-cash/disposition-final-full.receipt.json, disposition-pg-frozen.log, disposition-render-frozen.log, disposition-live.json.1362TS/1361pass/0fail/1optionalPGskip;264Python; mandatory private/type/build. Standalone1test; PG17checks/1208rows2416cells; actual component SSR A/B/A, not new browser interaction. Previous217 viewer browser remains separate.\n\n"+
 "Modules: cohortDisposition.ts -> companyCohortProjection.ts -> retained finiteProducerBinding/finiteCompanyDocument/Workbook -> local-only viewer. Immediate cutoff owned-claim sale AR100 minus restoration20 and tax5 yields75, ownership not multiplied twice. Unsupported material economics keep null combined value. No periodic/whole-equity/issuer qualification.\n\n"+
 "Source: Nucor accession0001193125-26-432117/Ex99.2 slide16; primary indexOct26publication. Up-to800kt and Q3operation do NOT resolve executed fee/billing/opex/funding/commoncash. Do not repeat this examination. Preserve all14FaIRpins/original1000of1001/frozen negatives/old124-179-416/private403. Standard per-clause evidence corrections are local until a later coherent source release, not a receipt-only push.\n")
