import json,hashlib,datetime,subprocess,importlib.util
from pathlib import Path
root=Path("generated-artifacts/obligation-recovery")
x=json.loads(Path("docs/workplan_completion_ledger.json").read_text())
e={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "scope":"S13-004 conditional opening-liability reimbursement, not partial ownership/whole-equity/science acceptance",
 "versions":["opening-obligations-2-recovery","terminal-settlement-3-recovery","finite-cohort-accrual-8-recovery"],
 "files":["server/calculation/terminalObligations.ts","server/calculation/terminalSettlement.ts","server/calculation/companyCohortProjection.ts","script/terminal-recovery.test.ts","script/finiteCohortTransport.ts","script/futureCohortPostgres.ts","script/render-recovery-evidence.ts"],
 "functions":["freezeOpeningObligations","reconcileOpeningObligations","settleTerminal","projectCompanyCohorts"],
 "implementation":"Versioned frozen register binds opening account items, creditor/source/entity/currency/date/priority and separately unique recovery entitlement/recipient/cap/recognition/collection. Cash pays opening liability without expense; recovery accrues a distinct receivable, not operating revenue, and settles once. Existing retained producer/CLI/JSON/XLSX paths pin changed executable files. Original versions remain separate.",
 "equations":["closing liability=opening−allocated payment","recovery<=actually settled eligible obligation and explicit cap","opening net balances+recovery−defaults−new costs=distributions−contributions"],
 "oracles":"Synthetic USD20 cash/AP opening; USD20 paid2028-02-29, USD5 recovery recognized same day, collected/distributed2028-03-01: common cash5, new expense0, PV5/1.1^(60/365.25) within1e-10. Exact dates, cap, recipient, definition mutation and duplicates refuse.",
 "focused":"5passed0failed0skipped; corrected typecheck passed",
 "adverse":"First changed PG witness failed an obsolete terminal-net-cash expectation that omitted the new USD5 recovery. Corrected only the changed-branch expectation (+5) and zero-new-expense assertion; original branches retain original expectations.",
 "pg":json.loads(Path("generated-artifacts/renewal-cash/recovery-postgres-1794635390471.json").read_text()),
 "consumer":"Actual changed PG documents:1223 ordered rows/2446 literal XLSX cells;17 transport checks. Local parser+SSR A/B/A matched distinct stored IDs and recovery/expense labels. NOT interactive browser/genuine principal/production private execution.",
 "source":{"entity":"Nucor Corporation, Convent Louisiana DRI CCS context",
  "accession":"0000950170-24-021195","publication":"2024-02-27","fiscal_period":"2023-12-31",
  "url":"https://www.sec.gov/Archives/edgar/data/73309/000095017024021195/nue-20231231.htm",
  "locator":"Carbon Capture and Sequestration (CCS) Activity; extracted chunk50000; filing index and attached Exhibit10(v)",
  "finding":"Agreement narrative: XOM receives related tax credits and PAYS Nucor per supplied tonne. Forecast600000–800000metric tonnes/year and expected2026 startup are not actual billings. This corroborates already-known direction; no price qualified.",
  "negative":"Fee amount/billing/opex/funding/legal-party instrument not established in examined section. The only attached10(v) is an incentive compensation amendment, not CCS. Incorporated exhibits/full remaining filing not exhausted; no global nondisclosure claim.",
  "rights":"Public SEC source, captures retained locally; no private provider bytes exported"},
 "remaining":"S13-004: integrate source-qualified recovery into physical operating interval/funded periodic closure; partial ownership/beneficial cash/NCI priority and cross-year earned interest still unsupported. Certified physical-growth inverse remains null. S13-017: all-map predeclared assumption-family accounting, not renewal subgroup only. Continue actual issuer/full-window/dated corpus sourcing; no original study accepted.",
 "counts":"All300:65verified233partial2blocked;0/3issuer cases;original1000/1001 unchanged",
 "full_gate":json.loads((root/"full-gate.json").read_text()),
 "release":"Last verified public/runtime e97b8796133e0b30d253b8036e786b7bf6e10e80, CI43561156132 success. This new increment local only until new gated promotion/readback."}
e["log_hashes"]={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob("*") if p.is_file()}
x["latest_increment"]["opening_recovery"]=e;x["next_action"]=e["remaining"];x["restart"]["instruction"]=e["remaining"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":r["latest_recovery"]=e;r["remaining_gaps"]=[e["remaining"]];r["next_action"]=e["remaining"]
  if r["id"]=="S12-017":r["latest_bounded_source_attempt"]=e["source"]
Path("docs/workplan_completion_ledger.json").write_text(json.dumps(x,indent=2)+"\n")
q=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");q.write_text("# Current opening-obligation recovery increment\n\n"+json.dumps(e,indent=2)+"\n\n"+q.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
spec=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Recovery continuation\n\n"+e["implementation"]+"\n\n"+e["remaining"]+"\n\n"+e["consumer"]+"\n\n"+e["release"]+"\n\nReceipts: generated-artifacts/obligation-recovery/full-gate.json; pg.log(initial failure), pg-corrected.log; ssr.log. Do not repeat old funded transport/browser/gates. New primary capture: accession0000950170-24-021195 published2024-02-27, CCS section and non-CCS Exhibit10(v); no priced fee qualified. No terminal callback sent this turn yet.")
