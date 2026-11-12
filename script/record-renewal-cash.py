import json,hashlib,subprocess,importlib.util
from pathlib import Path
from datetime import datetime,timezone
root=Path("generated-artifacts/renewal-cash");now=datetime.now(timezone.utc).isoformat()
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
files=["server/calculation/cohortCashLedger.ts","server/calculation/cohortRenewal.ts","script/cohortRenewal.test.ts","script/futureCohortPostgres.ts"]
e={"at":now,"files":{p:sha(p) for p in files},
"functions":["reconcileCohortCash","evaluatePeriodicRenewal"],
"engineering":"Revenue/AR/collections, total WC once, tax/debt/non-common liability rollforwards, fixed/holding/transaction costs, explicit equity funding and common distributions. Transition and renewal must share claim and balance boundary. Calendar-year zero-degradation dated storage includes charging losses; other dated periodicity refuses.",
"numerics":{"engineering_only":True,"common_periodic_value":900,"negative_funded_value":-1000,"AR_cash":[85,95],"storage_delivered_kWh":10,"charged_kWh":12.5,"loss_kWh":2.5,"storage_periodic_value":650,"tolerance":1e-9},
"focused":{"command":"npx tsx --test script/cohortRenewal.test.ts script/companyCohortProjection.test.ts","pass":11,"fail":0,"skip":0,"log":str(root/"focused.log")},"typecheck":"passed",
"source":{"url":"https://www.investor.xplrinfrastructure.com/~/media/Files/X/xplr-infrastructure-ir/events%20and%20presentation/Q3%202026%20XPLR%20Earnings%20Presentation_vF.pdf",
"as_of":"2026-11-03","publication_timestamp":None,"capture":datetime.fromtimestamp((root/"xplr-q3-presentation.md").stat().st_mtime,timezone.utc).isoformat(),
"extracted_markdown_sha256":sha(root/"xplr-q3-presentation.md"),
"locators":["Business Highlights, footnotes1/2","2026 and2027 financial expectations, debt service footnote2"],
"facts":"Approximately85% of planned~180MW2026 repowerings completed as ofNovember3; debt service includes interest, tax-equity distributions and expected CEPF distributable-cash share, excludes principal.",
"unresolved":"No October40m named project/recipient allocation, settlement day, marginal cash costs or NEE common claim. Aggregate progress/FCFBG not substituted for these. No issuer model rerun."},
"dependency_review":{"version":"proxy-addr2.0.8","original_lock":"unchanged2.0.7","download":"accepted by normal registry; no firewall bypass",
"diff":"IPv4-mapped candidate canonicalization and cross-family subnet guard; same forwarded0.2.0/ipaddr.js1.9.1 dependencies",
"tests":"Six trust-range cases and isolated Express comparison passed on Node22.23.4; shared existing dependencies, NOT clean install",
"failure":"Initial comparison used unsupported ::/0 and threw before assertions; corrected fixture uses supported ::/1. No application/security guard weakened.",
"finding":"Under isolated IPv6-only CIDR trust, old package accepted spoofed forwarded IPv4; candidate retains socket address. Not an exploit test of production configuration.",
"log":str(root/"proxy-review/comparison.log"),"next":"Separately versioned lock upgrade with full compatibility/security/private gates and protected bundle policy; not installed or accepted yet."},
"remaining":["Partial-calendar/degrading dated renewal and full cash event timing","Certified bounded growth inversion and genuine common-claim/source qualification","Actual future-review PostgreSQL and admitted UI/API/XLSX coverage","Actual issuer and driver/historical empirical work; no new efficacy"] }
gate=root/"full.receipt.json"
e["gate"]=json.loads(gate.read_text()) if gate.exists() else {"status":"running"}
pg=root/"future-postgres.json"
if pg.exists():e["additional_postgresql_transport"]=json.loads(pg.read_text())
e["postledger"]={"command":"npx tsx --test script/reconciliation-stages-14-17.test.ts script/workplan-corrections.test.ts","pass":7,"fail":0,"skip":0,"log":str(root/"postledger.log")}
e["development_runtime"]={"health":"ok","port":5000,"scheduler":"Disabled for this instance; unchanged","scope":"Health only, not UI/issuer acceptance"}
e["remaining"][2]="Extend actual PostgreSQL transaction witness to corrupt/swapped dependencies and concurrent/committed isolation; genuine operator reader authentication and admitted UI/API/XLSX remain separate"
e["logs"]={str(p):sha(p) for p in root.glob("*.log")}
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
x["prior_renewal_integration"]=x.get("latest_increment");x["latest_increment"]=e
if (root/"runtime.json").exists():
 x.setdefault("release_history",[]).append(x.get("current_release"))
 x["current_release"]={"runtime":json.loads((root/"runtime.json").read_text())["sourceCommit"],
 "ci":43317365497,"ci_conclusion":"success","health":json.loads((root/"health.json").read_text()),
 "readback":json.loads((root/"live-readback.json").read_text()),"boundary":"Observed accounting only; new local cash changes not deployed"}
 x.pop("pending_release",None)
x["next_action"]="Reconcile existing promotion for this renewal cash source. Continue partial-calendar/degrading storage and exact cash timing/claim/inversion; extend the passed actual PostgreSQL renewal-review transaction to corruption/concurrent/committed isolation and genuine operator reader. Complete admitted result consumers and qualified issuer/calibration inputs. Candidate proxy2.0.8 passed bounded compatibility checks but remains uninstalled; original-lock clean install remains failed."
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S13-004","S12-017","S17-002"]:
   r["renewal_cash_evidence"]=e
   r["next_action"]={"S13-004":e["remaining"][0]+"; "+e["remaining"][1],
    "S12-017":e["source"]["unresolved"],"S17-002":e["dependency_review"]["next"]}[r["id"]]
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");marker="<!-- renewal-cash-history -->\n";text=r.read_text()
if marker in text:text=text.split(marker,1)[1]
r.write_text("# Latest renewal cash/source increment\n\n"+json.dumps({"current_release":x.get("current_release"),"increment":e},indent=2)+"\n\n"+marker+text)
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
subprocess.run(["python","script/completion-ledger.py"],check=True)
