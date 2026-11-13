"""Current, bounded evidence update; no scientific or owner promotion."""
import json,hashlib,datetime,subprocess,importlib.util,sys
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
base=Path("generated-artifacts/dated-cash")
stored="--stored" in sys.argv
gate=json.loads((base/("stored-full.receipt.json" if stored else "retained-final-full.receipt.json")).read_text())
assert gate["exit_code"]==0
files=["server/snapshots/companyOperatingReview.ts","server/finiteCompanyDocument.ts",
 "server/finiteCompanyPrivacy.ts","server/index.ts","script/company-operating-review.ts",
 "script/finiteCohortTransport.ts","script/futureCohortPostgres.ts","script/finite-private-reader.test.ts",
 "docs/field_semantics_census.json"]
logs=["retained-final-full.log","retained-final-focused.log","retained-cli-pg.log",
 "retained-finite-full.log","retained-finite-final-focused.log","xplr-new-agreements.json",
 "xplr-agreement-tail.json","xplr-filing-indexes.json","xplr-earlier-amendments.json"]
if stored:logs+=["stored-full.log","stored-focused.log","stored-final-pg.log","stored-corrected-pg.log"]
e={"kind":"retained-finite-reader","at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "files":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},
 "functions":["finiteProducerBinding","readRetainedFiniteInTransaction","finiteCompanyDocument","finiteCompanyWorkbook","finiteCompanyPrivacy"],
 "new_behavior":"Actual retained finite input/result/review/source/code/member/rule binding, private CLI JSON/XLSX, immutable/idempotent transport and tamper refusal. Public retained-reader operations now403, not authenticated by diagnostic allowlisting.",
 "unchanged":"No new owner/scientific acceptance; original1000/1001,300clauses,65/233/2,0/3issuers,14FaIRpins and closed finite export criteria retained.",
 "full_gate":gate,"focused":{"tests":18,"pass":18,"fail":0,"skip":0,
 "command":"npx tsx --test script/finite-private-reader.test.ts script/companyCohortProjection.test.ts script/status-choice-width-increment.test.ts"},
 "postgres":json.loads(Path("generated-artifacts/renewal-cash/finite-postgres.json").read_text()),
 "postgres_command":"npx tsx script/futureCohortPostgres.ts --local-disposable --finite-branch",
 "adverse":["Initial focused18:17pass/1fail pinned prospective module; restored original bytes, separate privacy module, no refreeze",
 "Initial full1357:1354pass/2fail/1optionalPGskip; stale census. Added actual private Finite accounting sheet inventory only; no original closure"],
 "inventory":"One additional private worksheet inventory; original1001 denominator and opaque historical slot unchanged",
 "scope":"Actual local PostgreSQL and fresh CLI processes, synthetic reviews only. Four public HTTP JSON/XLSX combinations refuse403. No genuine HTTP principal, actual issuer, rendered screen, compiled-binary attestation or scientific acceptance.",
 "log_hashes":{str(base/f):hashlib.sha256((base/f).read_bytes()).hexdigest() for f in logs},
 "remaining":["Private rendered viewer and genuine authenticated HTTP reader are not complete; CLI access is not HTTP authentication",
 "Dated terminal AR/AP/tax/otherWC/debt/noncommon settlement and sustainable funded renewal/inversion remain partial",
 "Actual eligible issuer/driver/historical corpus inputs remain incomplete"]}
if stored:
 e["new_behavior"]+=" Exact stored retrieval validates immutable dependencies without executing current model; explicit recalculation requires current matching source. Strict UTC/calendar cutoff validation."
 e["adverse"].append("Stored-reader PG harness initially invoked wrong injected function name; failed before cutoff assertion. Corrected to existing api.read; no assertion weakening.")
 e["recovery_scope"]="Fresh CLI process outside source checkout succeeded for exact stored JSON; recalculation refused missing source. Reader executable/dependencies and isolated DB remain required; not full clean-install/offline recovery."
source={"original":"https://www.sec.gov/Archives/edgar/data/1603145/000160314526000007/xplr-q42025xex1019.htm",
 "amendments":["https://www.sec.gov/Archives/edgar/data/1603145/000160314526000032/xplr-q22026xex102a.htm",
 "https://www.sec.gov/Archives/edgar/data/1603145/000160314526000032/xplr-q22026xex102b.htm",
 "https://www.sec.gov/Archives/edgar/data/1603145/000160314526000032/xplr-q22026xex102c.htm"],
 "filing_dates":["2026-02-17","2026-07-28"],"effective_dates":["2026-02-10","2026-05-29","2026-06-22","2026-07-27"],
 "parties":["NextEra Energy Resources Development, LLC","XPLR Infrastructure Operating Partners, LP"],
 "locators":["3.2 election25–49%, not actual elected/final ownership","3.4 cash contribution/interconnection purchase and subsequent in-kind development assets",
 "3.5 JV costs and consent-cost caps","Schedule1 capital calls/fees and explicit under-review fee footnote","Schedule1 ExhibitA"],
 "fee_table":{"Carousel BESS":9724000,"Mammoth Plains BESS":9750000,"Roswell BESS":3250000,"Chaves BESS":3250000},
 "unit":"$ as printed; no inferred FX conversion or independently established currency code",
 "decision":"Current primary contractual scope only. Printed managing-member fees remain qualified by under-review mechanics/amount/payor footnote. No actual receipt, October40m linkage, final member election/LLCA, budget or NEE common FCFE established. No backdating to2025origin.",
 "next":"Follow exact elected project/member notices, final LLCA/fee resolution and dated settlement/cost/common-claim evidence, not old presentation/payables or assumed dollar distributions."}
e["source_qualification"]=source
x["prior_increment"]=x.get("latest_increment");x["latest_increment"]=e
x["latest_changed_paths"]=files;x["updated_at"]=e["at"]
live=json.loads((base/("bcf-live.json" if (base/"bcf-live.json").exists() else "f29-live.json")).read_text())
x.setdefault("release_history",[]).append(x.get("current_release"))
x["current_release"]={"runtime":live["source"],"ci":43346352297 if live["source"].startswith("bcf875") else 43341135045,"conclusion":"success","readback":live,
 "scope":"Observed2023 only; not retained future execution"}
x.pop("pending_release",None)
x["next_action"]="Preserve retained-finite-producer-1 private binding/CLI writer and real disposablePG14checks,18focused/latest fullgate; old eight-fault witness was not rerun. Public diagnostic routes are NOT operator auth: separate finiteCompanyPrivacy403 guard protects both retained operations. Original prospective module restored, pins unchanged. Existing f29/CI43341135045/runtime/1054rows2108cells verified. Reconcile subsequent publication without restarting/superseding. Next: private rendered consumer/genuine HTTP principal boundary, dated terminal liability/common-claim waterfall, funded continuation and compatible inverse; no issuer/science acceptance. New SEC2026 interconnection agreement+3amendments qualify legal parties/funding terms, NOT October40m recipient/cash or printed fee revenue; use exact final LLCA/election/settlement evidence. Continue all original0–17 source/calibration/dated corpus work."
if stored:x["next_action"]=x["next_action"].replace("PG14checks","PG17checks")+" Preserve stored-exact versus explicit-recalculation modes and outside-checkout CLI witness; this is NOT clean-install/DB-free/genuine-principal recovery."
x["next_action"]=f"Latest observed runtime {live['source']}, CI{x['current_release']['ci']} success, {live['rows']} literal rows/{live['cells']} cells at {live['at']}; observed accounting only. Stored-mode changes are local until separately promoted and measured. "+x["next_action"]
if "--terminal" in sys.argv:
 ci=json.loads((base/"stored-ci.json").read_text())["workflow_runs"][0]
 x["pending_release"]={k:ci[k] for k in ["id","head_sha","status","conclusion","updated_at"]}
 x["publication_receipt"]={"workspace_code":"a4f5114e045109d8d7779bb890e3183492ea1899",
  "public_source":ci["head_sha"],"ci":x["pending_release"],"runtime":live["source"],
  "scope":"New stored-mode code published for existing validation; not yet observed deployed. This terminal documentation is local only."}
 x["next_action"]=f"First reconcile existing CI{ci['id']} for {ci['head_sha']} ({ci['status']}/{ci['conclusion']}); no restart/cancel/supersede or receipt-only push. Then verify exact runtime and safe affected routes. "+x["next_action"]
 e["publication"]=x["publication_receipt"]
x.setdefault("restart",{})["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":
   r["retained_finite"]=e;r["remaining_gaps"]=e["remaining"];r["next_action"]=x["next_action"]
  elif r["id"]=="S12-017":
   r["interconnection_source_qualification"]=source;r["next_action"]=source["next"]
  elif r["id"]=="S16-007":
   r["additional_private_writer"]="Original finite criterion unchanged. New private CLI-only sheet has literal readback; it is additional inventory, not original closure or genuine HTTP/UI acceptance."
  elif r["id"]=="S00-004":
   r["retained_reader_privacy"]=e["scope"]
p.write_text(json.dumps(x,indent=2)+"\n")
report=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");marker="<!-- retained-finite-history -->\n";history=report.read_text()
if marker in history:history=history.split(marker,1)[1]
report.write_text("# Latest retained finite reader and source qualification\n\n"+json.dumps({"current_release":x["current_release"],"increment":e},indent=2)+"\n\n"+marker+history)
subprocess.run(["python","script/completion-ledger.py"],check=True)
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
