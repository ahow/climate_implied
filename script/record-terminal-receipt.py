import json,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
b=Path("generated-artifacts/dated-cash");ci=json.loads((b/"terminal-ci-latest.json").read_text())
release={"workspace_implementation":"28efe1714f6d91b4abd770378dd6385bd03092f6","public_source":"217b0f9ebc6041e03d5368265dfac19d84f33fa4","ci":ci,"scope":"Public source and local gates are not deployment or scientific acceptance"}
x["latest_increment"]["publication"]=release;x["pending_release"]=release
if (b/"terminal-live.json").exists():
 live=json.loads((b/"terminal-live.json").read_text())
 if live.get("passed") and live.get("source")==release["public_source"]:
  x.setdefault("release_history",[]).append(x["current_release"])
  x["current_release"]={"runtime":live["source"],"ci":ci["id"],"conclusion":ci["conclusion"],"readback":live,"scope":"Observed2023 and private403 only, not future execution"}
  x.pop("pending_release",None)
x["next_action"]="Continue ALL original0–17/amendments. Preserve dated terminal v3 and local viewer; do not rerun unchanged gates/PG/browser. First reconcile CI43353222176/public217b0f9 without restarting/superseding; local28efe17 and receipt-only changes separate. If deployed verify exact runtime and safe observed2023 JSON/XLSX plus new viewer assets; not future execution. Next implement surviving physical-asset disposal/obligations and funded sustainable cycle boundary/full-domain compatible inversion; current terminal only declared financial balances. Genuine HTTP principal unavailable, local-only reader does not authenticate. Continue new actual settlement/election/LLCA/common-claim sources; fourth amendment is not cash receipt. Preserve all300/65verified233partial2blocked/0of3/original1000of1001/14pins/frozen negatives."
x.setdefault("restart",{})["instruction"]=x["next_action"]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");marker="<!-- terminal-publication-history -->\n";text=r.read_text()
if marker in text:text=text.split(marker,1)[1]
r.write_text("# Current terminal/viewer publication receipt\n\n"+json.dumps({"current_release":x["current_release"],"pending_release":x.get("pending_release"),"publication":release,"next_action":x["next_action"]},indent=2)+"\n\n"+marker+text)
import subprocess
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact continuation\n\n"+x["next_action"]+"\n\n"+
 "Local full gate:1361TS/1360pass/0fail/1optionalPGskip;264Python; mandatory private/type/build passed. Focused10, census correction4, postledger5. Actual terminal-specific disposablePG17 checks,964rows/1928cells. Browser A/B/A964 exact rows, tamper/reset/no-network-or-storage; optional final recapture interrupted. Intermediate full gate4fail and first census2fail retained, then corrected exact new98component census while original60 unchanged.\n\n"+
 "Evidence: generated-artifacts/dated-cash/terminal-viewer-final-full.receipt.json; terminal-final-pg.log; terminal-viewer-browser.json; terminal-fourth-amendment.json. No real approvals or principal fabricated. Inputs are synthetic PG fixtures only. Source fourth amendment accession0001603145-26-000039/ex10.2(d), publishedNov3/effectiveAug28, Sept30contribution deadline/$13,578,528asset value/150MWac/expectedNov2027COD; NOT actual cash or Oct40m link.\n\n"+
 "Runtime modules: server/calculation/terminalSettlement.ts; companyCohortProjection.ts; snapshots/companyOperatingReview.ts. Local reader: client/src/pages/private-finite-viewer.tsx and lib/private-finite-reader.ts. Financial settlement conserves balances and includes dated subsequent accrual/funding/common cash once; no physical asset liquidation/whole equity/periodic claim. No callback sent until terminal wrapper actually runs. Do not resend old matched checkpoints.\n")
