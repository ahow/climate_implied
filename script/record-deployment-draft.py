import json,subprocess,datetime,importlib.util
from pathlib import Path
p=Path("docs/workplan_completion_ledger.json");x=json.loads(p.read_text())
e={"at":datetime.datetime.now(datetime.timezone.utc).isoformat(),"scope":"LOCAL unintegrated finite-owned-deployment-1 draft only",
"files":["server/calculation/deploymentGrowth.ts","script/deployment-growth.test.ts"],
"functions":["freezeDeploymentGrowth","compileDeploymentGrowth","executeDeploymentCash"],
"formula":"commissioned quantity(k)=baseline*(1+g)^k; dated capital requirement=quantity*USD/unit",
"evidence":"generated-artifacts/deployment-growth: cash-corrected4pass0fail0skip; cash-types typecheck passed. Earlier2 focused tests remain separate. cash-focused initially3pass1fail: exact cash-paid equality rejected floating annual-service rounding. Corrected fixture explicitly accrues variable cost into AP and settles same-day, preserving original exact cash-paid guard. Prior iterator/type and annual-versus-daily oracle failures retained.",
"numerics":"10→11 units at10% growth; capital20→22USD; fixed price2; annual service3652.5/7305/7670.25 within1e-8. Annual civil-day proration, not daily-rate ACT365.25.",
"not_done":"Executed finite cash helper now exists, but no full-state cycle join, inversion, retained/UI integration, new primary-source attempt, full gate or release. Old Gregorian law unchanged.",
"remaining":"Resume executeDeploymentCash and source-bound baseline/horizon compiler. New baseline rejects undeclared construction costs, existing stock, wrong units, incomplete horizon and future evidence. Finite cash executes collections/AP/capital/common claims with explicit dates and opening/closing balances; funded oracles yield3632.5/7648.25 net common cash. Interest, recovery and partial claims explicitly unsupported; no periodic/inverse result. NEXT implement full-state join and proper funding/interest/eligible recovery/ownership contracts, compatible physical growth inverse, retained consumers, all-map family accounting and one NEW source attempt. No complete branch/full gate/release yet."}
e.update(scope="LOCAL finite-gregorian-join-1 prototype, not retained/API integrated",
 files=e["files"]+["server/calculation/deploymentTransition.ts","script/deployment-transition.test.ts"],
 functions=e["functions"]+["freezeDeploymentTransition","evaluateDeploymentTransition"],
 evidence="generated-artifacts/deployment-growth/join-final.log:1 test passed,0failed,0skipped with success and refusal oracles; join-types-final.log typecheck passed. Initial fixture aliased finite and periodic rights and failed expected-error assertion; corrected independent fixture copy. Prior4 finite-cash tests and all adverse receipts retained, not rerun as new evidence.",
 numerics="Independent finite PV=(10*184/365*8.75)/1.1^(183/365.25)-10, tolerance1e-8; funded paid capital10; continuation discounted184/365.25 years. Exact physical lineage/age/degradation/rights comparison, financial equality tolerance1e-9. Wrong owner, nonstationary utilization, funding gap, unpaid costs, late collection and unsupported obligation policy refuse.",
 not_done="Only zero-initial-account/full-common-right/no-open-obligation/no-sales branch. No interest/recovery/partial-claim support, inverse, retained/API/UI integration, new source attempt, full gate or release.",
 remaining="Resume deploymentTransition.ts supported narrow join. Finish general item-level obligations, debt/interest/recovery/partial ownership only with evidenced dated claims; inverse must use executable physical growth and compatible target, not price shift. Current one-year synthetic transition is not deployment-growth identification. Wire new branch into retained producer/CLI/exports/viewer, complete cross-map family accounting, pursue NEW primary source, then full mandatory gates and existing promotion. Do not rerun old massive transport/frozen studies.")
e.update(scope="LOCAL dated-deployment-debt-1; not integrated into periodic join/retained consumers",
 files=e["files"]+["server/calculation/deploymentDebt.ts","script/deployment-debt.test.ts"],
 functions=e["functions"]+["freezeDeploymentDebt","executeDeploymentDebt"],
 evidence="generated-artifacts/deployment-growth/debt-final.log:1 focused test passed0failed0skipped, independent funded capital/interest/PV and refusal assertions. debt-types-final.log: typecheck passed. Test SHA2568c43a0907d6f8cab2e35a9c2397cc738076b4309b53ecb4d62994a9ef65ee263. Previous failures/scoped checks retained separately, not rerun.",
 numerics="USD10 fixed10% loan drawn2024-01-01 repaid2024-12-31:365 interest days in leap year, interest365/365.25USD. Common distribution90-interest; PV=(90-365/365.25)/1.1^(365/365.25), tolerance1e-8. Capital funded once. Early full-year recognition, over-repayment, late funding, altered domain, unsupported recovery/ownership/opening obligations refuse.",
 not_done="Debt engine executes finite cash only; no funded periodic-debt join, cross-year unpaid interest, eligible recoveries, partial ownership, inversion, retained consumers, fullgate or release.",
 remaining="Resume deploymentDebt.ts and existing deploymentTransition.ts; integrate actual debt result into versioned full-state join without claiming unsupported item recovery/ownership. Implement item-level opening obligations/recovery eligibility, supported physical-growth inverse, retained reader/CLI/XLSX/viewer, cross-map ranges, then full mandatory gates. Existing join's zero-obligation/full-claim version and old Gregorian law remain unchanged.")
e["source_qualification"]={
 "original_id":"S12-017","entity":"First Solar, Inc.; Gaffney South Carolina final-production facility",
 "url":"https://investor.firstsolar.com/news/news-details/2026/First-Solar-Inaugurates-First-Phase-of-South-Carolina-Production-Facility/default.aspx",
 "publication":"2026-10-28","locator":"Opening paragraph and forward-looking statement",
 "finding":"Final production processes on Series6Plus modules initiated internationally. Second phase forecast mid2027; approximately330millionUSD facility, expected3.4GW annual nameplate after phase2. These are not eligible produced watts, incurred cost BOM, PFE certification or receipts.",
 "unresolved":["observed eligible US watts","component cost/BOM/PFE eligibility","India grant amount/day/FX/classification"],
 "rights":"Public issuer release; raw capture retained locally only; no images republished",
 "capture":"generated-artifacts/deployment-growth/new-primary-carolina.json",
 "sha256":"71758982f65ab149f8b305ff0322f3f653b1664d5346f322a66e3e5a18b27db2",
 "failed_attempt":"Older2023 award press-release-details URL returned current news index, not the requested article; no field qualified from that page.",
 "decision":"Current source/context only; no backdating to2025 origin, no observed output/credit/cash acceptance"}
e["evidence"]+=" Final inherited-opening-account guard: debt-opening-guard.log1pass0fail0skip SHA256f57914eacd0ea9800949ab12d2997c63df3212c35296c036182bc93b7a570117; debt-opening-types.log typecheck passed."
import hashlib
e.update(scope="Funded finite-to-Gregorian transition and private retained consumers; conditional engineering, not issuer identification",
 files=e["files"]+["server/calculation/fundedDeploymentTransition.ts","server/calculation/fundedProducer.ts","server/calculation/cohortRecognition.ts","server/calculation/companyCohortProjection.ts","server/snapshots/companyOperatingReview.ts","server/finiteCompanyDocument.ts","server/finiteCompanyPrivacy.ts","client/src/lib/private-finite-reader.ts","client/src/pages/private-finite-viewer.tsx","script/company-operating-review.ts","script/fundedTransportFixture.ts","script/finiteCohortTransport.ts","script/futureCohortPostgres.ts","script/funded-earned.test.ts","script/funded-deployment-transition.test.ts"],
 functions=e["functions"]+["freezeFundedDeploymentTransition","evaluateFundedDeploymentTransition","fundedProducerBinding","assessCohortRecognition","readRetainedFunded","fundedCompanyDocument"],
 versions=["dated-deployment-debt-1","dated-deployment-debt-2-earned","funded-finite-gregorian-join-2","funded-finite-gregorian-join-3-earned","retained-funded-producer-1","private-funded-company-document-1"],
 changed="Executed loan cash joins the existing complete physical/financial boundary once; companyProjection binds the compiled source. New earned version reuses the original daily-prefix recognition rule, refusing revenue/operating costs recognized before service. Older versions and source-archived stored reads remain separate. Explicit private reader/CLI/JSON/XLSX/local viewer and403 dispatcher; no genuine HTTP principal granted.",
 not_done="No qualified issuer case, physical-growth inverse, complete cross-map family range, eligible recovery/partial-claim/opening-obligation or cross-year unpaid-interest extension. Conditional project PV is not whole equity/FCFE. No market/scientific identification.",
 remaining="Next S13-004: item-level already-accrued obligations/eligible recovery and partial claims under explicit dated source/priority; compatible physical-growth inverse with mathematically supported full-domain certificate. S13-017: complete cross-map declared-family accounting including failed/missing/incompatible sets. Preserve old stationary law/price inverse. Genuine HTTP principal and real source review remain unavailable; continue independent original clauses.",
 numerics=e["numerics"]+" Financed half-year transition uses interest183/365.25USD; finite PV=(10*184/365*8.75-interest)/1.1^(183/365.25)-10. Periodic continuation discounts184/365.25. Existing join financial tolerance1e-9; exact declared closing liabilities still zero; no rounding away debt.",
 adverse="Retain funded-join strict floating AP failure; fixed only executed-sum comparison to existing1e-9 tolerance while declared closing amount must exactly zero. Initial empty physical-cell company test refused; corrected explicitly synthetic cell. V2 browser had3 locator45s caps; page-evaluate probes worked, not a proven app-performance failure. Existing debt/cash/iterator/type/aliasing failures retained.")
root=Path("generated-artifacts/deployment-growth")
e["failed_final_gate"]=json.loads((root/"final-gate.json").read_text())
e["final_gate"]=json.loads((root/"final-corrected-gate.json").read_text())
e["gate_scope"]="LOCAL final gate, not CI/runtime/science; prior core gate1385TS/264Python remains separate."
e["logs"]={str(root/n):hashlib.sha256((root/n).read_bytes()).hexdigest() for n in ["final-gate.log","final-corrected-gate.log","earned-focused.log","earned-types.log","earned-pg.log","funded-browser-v2.json","funded-browser-v3.json","census-regenerated.log"]}
e["adverse"]+=" First final fullTS1386:1383pass2fail1skip from stale generated field census. Regenerated4-line diff only; original1000/1001 stays incomplete. Subsequent corrected gate is separate, never a clean first attempt."
e["focused"]="earned-focused:14pass0fail0skip; earned-types:typecheck passed. Earlier core gate and loan checks separately retained."
e["pg"]=[json.loads(Path(q).read_text()) for q in ["generated-artifacts/renewal-cash/funded-postgres-1794632128154.json","generated-artifacts/renewal-cash/funded-postgres-1794632982579.json"]]
e["pg_scope"]="V2:17 checks/237126rows474252cells; V3 earned:17 checks/237152rows474304cells. Actual disposable PostgreSQL/committed reconnect/fresh-process CLI/rollback, synthetic reviews only. No genuine principal, production provisioning or issuer acceptance."
e["browser_scope"]="New kind V2 interactive A/B/A/corrupt/reset/reload; exact SHA identity,500-row pagination, zero file uploads. Three locator caps preserved. V3 separate actual browser load matched005b62c989c553c2233d1c6ca3e95ff52e2145e4d2e017881784d437b6f2ced6 and237152 rows; five version/recognition pointers observed, four on unvisited pages not independently located. Two explicit64-byte private guard POSTs both403, no file content. No production/principal/science acceptance."
e["receipts"]={"local_before_commit":subprocess.check_output(["git","rev-parse","HEAD"],text=True).strip(),"published_and_runtime_last_verified":"d4f59575ef31e8bc1ac59bea435fe751858201cc","new_ci":"not started","new_deployment":"not asserted"}
live=Path("generated-artifacts/dated-cash/funded-earned-live-confirmed.json")
if live.exists():
 receipt=json.loads(live.read_text())
 previous=x.get("current_release")
 if previous and previous.get("runtime")!=receipt["source"]:
  x.setdefault("release_observations",[]).append(previous)
 x["current_release"]={"runtime":receipt["source"],"ci":43561156132,"conclusion":"success","readback":receipt,
  "scope":receipt["scope"],"railway_github_deployment":7783163945}
 e["receipts"].update(implementation_local="5300377f1ddd07d6dadadb4b8388e6a357190be4",
  public_source=receipt["source"],new_ci=43561156132,new_ci_conclusion="success",
  new_deployment=receipt,previous_runtime="d4f59575ef31e8bc1ac59bea435fe751858201cc",
  initial_readback="live-readback.log failed exact-SHA assertion while Railway was still serving d4; later success does not erase it",
  railway="GitHub deployment7783163945 in_progress05:27:42Z→success05:32:38Z; no restart/cancellation/superseding")
x["latest_increment"]["local_deployment_draft"]=e
x["next_action"]=e["remaining"]+" Preserve final local gate/private V2 and V3 transport/browser scopes separately from CI/runtime; continue ALL original0–17."
x["restart"]["instruction"]=x["next_action"]
for s in x["stages"]:
 for r in s["requirements"]:
  if r["id"]=="S13-004":r["deployment_draft"]=e;r["next_action"]=x["next_action"];r["remaining_gaps"]=[e["remaining"]]
  if r["id"]=="S12-017":r["latest_bounded_source_attempt"]=e["source_qualification"]
  if r["id"] in ["S13-007","S13-017","S13-020"]:
   r["latest_funded_scope"]={"at":e["at"],"public_source":e["receipts"].get("public_source"),
    "engineering":"Funded finite/periodic join and earned recognition retained/transport/viewer checks passed; synthetic, not actual issuer/ensemble acceptance.",
    "remaining":{"S13-007":"No certified physical-deployment-growth inverse or full-domain identification; inverse remains null.",
     "S13-017":"Renewal-only family accounting is not cross-map coverage. Reconcile all declared reserve/retirement/manufacturing/cohort/renewal sets, including failed/missing/incompatible bases.",
     "S13-020":"Synthetic covered fixture reconciliation is not sourced covered/expanded universe reconciliation; no global scaling inferred."}[r["id"]]}
p.write_text(json.dumps(x,indent=2)+"\n")
q=Path("docs/WORKPLAN_IMPLEMENTATION_REPORT.md");q.write_text("# "+e["scope"]+"\n\n"+json.dumps(e,indent=2)+"\n\n"+q.read_text())
subprocess.run(["python","script/completion-ledger.py"],check=True)
spec=importlib.util.spec_from_file_location("matrix","script/merge-clause-reconciliation.py");m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(m.matrix(x))
Path("docs/TERMINAL_VIEWER_HANDOFF.md").write_text("# Funded transition compact continuation\n\n"+x["next_action"]+
 "\n\nNew source: deploymentDebt debt1/debt2-earned, fundedDeploymentTransition join2/join3-earned, shared cohortRecognition and private fundedProducer/reader/CLI/XLSX/viewer. Old law/versions/stored source preserved. "+
 "Final corrected LOCAL gate1386TS=1385pass0fail1optionalPGskip;264Python/allmandatoryprivate/type/build. First final gate1383pass2stale-censusfail1skip retained. "+
 "Receipts generated-artifacts/deployment-growth/final-corrected-gate.json, earned-pg.log, funded-browser-v2.json, funded-browser-v3.json. V2PG17/237126rows and V3PG17/237152rows separately; synthetic only. "+
 "Browser V2 A/B/A/corrupt/reset/reload with3locator caps; V3 load+five markers+two403, four unvisited-page markers not individually located. "+
 "New issuer source2026-10-28 Gaffney release: international-started modules/forecastnameplate, NOT eligible watts/BOM/PFE/cash. "+
 "Before publication last verified runtime d4f59575; new CI/deploy not yet asserted. No callback sent yet. All300/65verified233partial2blocked/0of3/original1000of1001/14FaIRpins unchanged.")
if live.exists():
 with Path("docs/TERMINAL_VIEWER_HANDOFF.md").open("a") as h:
  h.write("\n\nFINAL supersedes prepublication sentence: implementation5300377; public/runtime e97b8796133e0b30d253b8036e786b7bf6e10e80, CI43561156132 success; Railway deployment7783163945 success05:32:38Z. Fresh05:33:08Z health200, observed2023 API/JSON/XLSX1054rows2108cells, eight403, funded assets. No private future/principal/science acceptance. Initial stale-d4 readback failure retained. Do not repromote/restart this completed release. Final receipt documents remain LOCAL until a future coherent implementation publication; no receipt-only push.\n"+
   "NEXT code: predeclared all-map family accounting across producerReserveModel, utilityRetirement, cleanManufacturingMap, companyCohortProjection and renewalFamily with missing/failed/incompatible sets explicit; existing renewable-only range is not complete Tier1 coverage. Also debt/recovery/partial rights and genuinely physical-growth inverse remain missing; do not relabel loan join/price shift as identification. All prior next_action applies. Preserve V2 browser caps and V3 four-unvisited-marker scope. No background jobs remain from this work.")
