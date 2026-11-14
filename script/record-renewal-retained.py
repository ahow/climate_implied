"""Record this bounded retained-renewal increment without rewriting historical receipts."""
import json,hashlib,datetime,subprocess,importlib.util
from pathlib import Path
b=Path("generated-artifacts/renewal-retained")
g=json.loads((b/"final-full.receipt.json").read_text());assert g["exit_code"]==0
pg=json.loads((b/"recovery.json").read_text());assert pg["passed"]
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
files=["server/calculation/renewalProducer.ts","server/calculation/renewalFamily.ts",
"server/calculation/companySourceArchive.ts","server/calculation/coveredPhysicalPaths.ts",
"server/calculation/companyCohortProjection.ts","server/snapshots/companyOperatingReview.ts",
"server/finiteCompanyDocument.ts","server/finiteCompanyPrivacy.ts","script/company-operating-review.ts",
"script/renewalTransportFixture.ts","script/finiteCohortTransport.ts","script/renewalTransportRecovery.ts",
"client/src/lib/private-finite-reader.ts","client/src/pages/private-finite-viewer.tsx"]
remaining=[
"Original S13-004 implied DEPLOYMENT growth is not the stationary price-shift inverse. Next: predeclare a compatible physical deployment parameterization/claim/domain and supported finite-to-renewal transition, interest and eligible recovery; do not widen the frozen affine law.",
"S13-017 now retains every declared renewal set, including missing/finite/no-root/unsupported. Numeric groups describe available comparable forward values, not a complete missing-family bound or all other Tier1 producer maps.",
"Genuine HTTP principal/issuer/source review and production provisioning remain unavailable; public403 unchanged. Synthetic local PostgreSQL decisions are not real approvals.",
"No original issuer case qualified. AU684 supplies aggregate PLI disbursement/investment context, not First Solar collections, eligible watts, FX or classification.",
"Continue original22driver/full-window/joint inputs and authentic dated11–15 corpus; all original scientific/owner/domain gates and negative studies preserved."]
e={"kind":"private-retained-gregorian-renewal-consumers","at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
"local_source":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"files_functions":files,
"implementation":["renewalProducerBinding captures law/domain/certificate, physical/specification/ownership/claim and archived executable modules; stored retrieval validates immutable dependencies without execution; explicit recalculation still requires matching source.",
"reconcileRenewalFamily rejects duplicate/undeclared/conflicting sets and preserves missing/refusal rows, grouped by compatible claim/date/currency/unit/law.",
"Private renewal CLI JSON/XLSX uses0600/exclusive writes. New document version, public403 and browser-local integrity-only reader. Pagination500 retains all rows, selection resets, no upload/storage.",
"Validated source and physical parents indexed once after full duplicate/hash validation; no evidence or scientific gates removed."],
"formulas":"Existing Gregorian stationary nominal400-year/146097day law and affine price inverse unchanged; no deployment-growth or whole-equity inference. Document IDs=canonical SHA256; literal cells=ordered economicBridgeCells. No roots or study refits performed on actual issuer data.",
"gate":g,"pg_focused_recovery":pg,
"pg_scope":"Initial actual-PG run reached concurrent staging, stored reads, privateCLI, all literal XLSX, A/B/C/A and reconnect; failed final regex expecting finite rather than renewal refusal. Focused recovery checks altered physical/law/certificate and atomic rollback separately. Not a clean single17-pass run.",
"consumer_results":{"A_rows":659286,"A_literal_cells":1318572,"B_rows":659281,"C_rows":659278,"A_workbook_bytes":121433406,
"browser":"Interactive synthetic A/B/A/corrupt/reset/C. Page2,last,page621 literal comparisons;0mismatches. Initial navigation timeout retried. C arrived later, so not exact A/B/C/A order. No nonstatic requests or data storage during interaction. Not genuine operator authentication."},
"source":{"url":"https://sansad.in/getFile/annex/271/AU684_PN7hbh.pdf?source=pqars","publication":"2026-07-24",
"period":"through2026-03-31","facts":"INR35354crore total PLI disbursement across14sectors; solar64873crore investment and14794employment.",
"finding":"No First Solar/FSIndia mention; aggregate amounts are NOT issuer grant receipt/eligible watts/paymentday/FX. No2025 backdating."},
"failures":["Interrupted CPU-heavy attempts pg.log/pg-indexed.log; scope2 invalid versus2-location; foreground timeout pg-location.log; pg-phases.log incorrect finite-error regex.",
"First full gate1378TS=1375pass/2fail/1skip: stale generated field census. Regenerated actual descriptors; original1000/1001 and unresolved1 unchanged.",
"Recovery attempts: missing socket startup options, omitted explicit cutoff, then current-source code refusal during approval. Stored-only corruption tests use original synthetic decision copies in rolled-back disposable transactions; no real approval."],
"remaining":remaining,"scientific_acceptance":False,
"logs_sha256":{f.name:hashlib.sha256(f.read_bytes()).hexdigest() for f in b.iterdir() if f.suffix in [".log",".json"]}}
x["latest_increment"]=e
x.setdefault("release_history",[]).append(x["current_release"])
x["current_release"]={"runtime":"59c0fb8a60034313f254624c77c1c770a228b4be","ci":43548780317,"conclusion":"success","readback":json.loads(Path("generated-artifacts/dated-cash/renewal-retained-base.json").read_text()),"scope":"Prior Gregorian release, observed2023/public403 only; not NEW private consumers"}
x["next_action"]="Continue ALL original0–17. New private renewal consumers locally validated; reconcile next Git/CI/runtime separately. "+ " ".join(remaining)
x["restart"]["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"] in ["S13-004","S13-007","S13-017"]:
   r["retained_renewal_increment"]=e
   r.setdefault("executions",[]).append(g)
   r["remaining_gaps"]=remaining if r["id"]=="S13-004" else [remaining[1] if r["id"]=="S13-017" else remaining[0]]
   r["next_action"]=r["remaining_gaps"][0]
p.write_text(json.dumps(x,indent=2)+"\n")
q=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");q.write_text("# Latest private retained renewal integration — local gates, prior runtime distinguished\n\n"+json.dumps(e,indent=2)+"\n\n"+x["next_action"]+"\n\n"+q.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
spec=importlib.util.spec_from_file_location("matrix","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact retained renewal continuation\n\n"+x["next_action"]+"\n\n"+json.dumps(e,indent=2)+"\n")
