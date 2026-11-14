import json,hashlib,datetime,subprocess,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text());b=Path("generated-artifacts/gregorian-renewal")
g=json.loads((b/"final-full.receipt.json").read_text());assert g["exit_code"]==0
files=["server/calculation/gregorianRenewal.ts","server/calculation/gregorianInverse.ts","server/calculation/cohortRenewal.ts","server/calculation/companyCohortProjection.ts","script/gregorian-renewal.test.ts"]
e={"kind":"conditional-gregorian-renewal-and-affine-inverse","at":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "files":{f:hashlib.sha256(Path(f).read_bytes()).hexdigest() for f in files},
 "functions":["evaluateGregorianRenewal","invertGregorianRenewal","evaluatePeriodicRenewal","projectCompanyCohorts"],
 "scope":"NEW conditional engineering, no issuer/owner/auth/scientific acceptance. Existing annual/finite branches unchanged.",
 "law":"Explicit prospective stationary Gregorian400-year repeat law, checked across800 supplied conditional years.146097days repeats leap/calendar structure. It is NOT a fitted horizon, shortened empirical holdout or independently authenticated future source. Full profiles/accrual/cash/common-capital repeat; positive replacement capital tied to each commissioning; explicit conditional complete removal/zero salvage/no unmodelled liabilities. No such facts asserted for an actual issuer.",
 "formulas":"PV=dated first-period net common cash PV / (1-(1+r)^(-146097/365.25)); opening state already funded. No extra opening cash/debt deduction. Stationary nominalUSD, not replacement for original2.5–4% whole-equity terminal.",
 "oracles":json.loads((b/"oracle.json").read_text()),
 "results":"July replacement/retirement, leap years, storageRTE0.8 and0/1% annual degradation; annual base service10, charge12.5, loss2.5, revenue100, replacement10, common77.5. Reference PV775.231323361313 matched within1e-8. Same-claim additive price inverse root0.5 within1e-10; residual tolerance1e-7. No-root, funding-domain/borrowed-parent/overflow refusal; financial drift and missing replacement capital refuse. Fixtures are synthetic.",
 "inverse":"Pre-execution definition hash, declared domain, fixed physical/nonprice inputs, explicit zero tax, coincident year-end revenue/collections/distributions and no capital returns. Constant positive slope proves only this affine domain; endpoint execution checks arithmetic/constraints. No general nonlinear/tangency/discontinuity or market-identification certificate; owner width/dual-threshold gates unchanged.",
 "focused":"23pass0fail0skip before overflow protection;3pass0fail0skip after domain correction. Full final gate below is authoritative.",
 "gates":g,"logs":{str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in b.glob("*.log")},
 "adverse":"Initial2tests:1pass1fail because unfunded case correctly refused funding shortfall before expected payable-date refusal; assertion corrected to exact actual guard. Pre-domain full gate retained separately; source/domain guard changed afterward, so it is NOT the final release gate.",
 "remaining":["Actual source-qualified issuer/future law, operator principal, scientific/owner acceptance and3worked cases remain absent",
 "New renewal/inverse changed retained producer/reader/privatePG/document/XLSX/viewer journey still needs integration/evidence; prior finitePG/SSR is NOT reused as proof",
 "Partial ownership, nonstationary exogenous law, general interest/recovery eligibility, transition into this400-year law and nonzero-tax/nonlinear inverse remain unsupported",
 "General full-domain/width/control-family identification and original terminal/reinvestment issuer requirements remain partial; no whole-equity/market inference"],
 "source":"This turn's SECI source findings retained in preceding increment:1700MW eligible capacity, not produced watts or cash; no new duplicate fetch."}
x["prior_increment"]=x.get("latest_increment");x["latest_increment"]=e;x["local_continuation"]=e
x["current_release"]={"runtime":"b8774031425d61fc16ad44ff04ef3e37d766d232","ci":43545983675,"conclusion":"success",
 "readback":json.loads(Path("generated-artifacts/dated-cash/gregorian-base.json").read_text()),
 "scope":"Prior necessary-boundary implementation. Observed2023/public403 only, not current Gregorian future execution"}
x["next_action"]="Continue ALL original0–17. New Gregorian conditional forward/affine inverse passed final local gate; verify any new code/CI/runtime separately. Finish changed retained producer/reader/CLI/literalXLSX/localviewer for NEW renewal result, then supported transition/interest/recovery and original source/issuer work. Do not rerun unchanged finitePG/SSR. No genuine principal/owner/source/science acceptance.65verified233partial2blocked/all300/0of3 unchanged."
x["restart"]["instruction"]=x["next_action"]
for stage in x["stages"]:
 for r in stage["requirements"]:
  if r["id"] in ["S13-004","S13-007","S13-017"]:
   r["gregorian_increment"]=e
   if r["id"]=="S13-004":
    r["remaining_gaps"]=e["remaining"];r["next_action"]=x["next_action"];r["files_functions_changed"]=files;r["numerical_results"]=e["results"]
   r.setdefault("executions",[]).append(g)
p.write_text(json.dumps(x,indent=2)+"\n")
r=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");r.write_text("# Latest conditional Gregorian renewal/inverse implementation\n\n"+json.dumps(e,indent=2)+"\n\n"+x["next_action"]+"\n\n"+r.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
s=importlib.util.spec_from_file_location("m","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Compact Gregorian renewal continuation\n\n"+x["next_action"]+"\n\n"+json.dumps(e,indent=2)+"\n")
