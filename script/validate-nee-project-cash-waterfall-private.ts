import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractNeeWaterfallFacts, neeHistoricalWaterfall, neeCashReturnAnchors,
  buildNeeWaterfall } from "../server/calculation/neeProjectCashWaterfall";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production")
  throw new Error("Mandatory private validation requires --private-primary outside production");
const root = "generated-artifacts/company-operating-corpus/nee-project-cash-waterfall-v1";
const read = (p: string) => JSON.parse(readFileSync(p,"utf8"));
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const close = (a: number, b: number, label: string) => {
  assert.ok(Number.isFinite(a) && Number.isFinite(b), `Nonfinite ${label}`);
  assert.ok(Math.abs(a-b) < Math.max(.001, Math.abs(b) * 1e-11), `${label}: ${a} versus ${b}`);
};
const latest = read(`${root}/latest.json`), f = read(latest.freezePath), report = read(latest.reportPath);
assert.equal(sha(latest.freezePath), report.freezeHash);
assert.ok(Date.parse(f.frozenAt) <= Date.parse(report.calculatedAt));
assert.equal(f.primary.identity.cik, "0000753308");
for (const p of [...f.code,...f.preserve,f.primary]) assert.equal(sha(p.path), p.sha256, `Changed ${p.path}`);
const facts = extractNeeWaterfallFacts(readFileSync(f.primary.path, "utf8"));
assert.deepEqual(facts,f.facts);
const actual = neeHistoricalWaterfall(facts);
assert.deepEqual(actual,report.historical);
for (const key of ["neeFinancingResidual","fplFinancingResidual","neeCashResidual","fplCashResidual"])
  close((actual as any)[key],0,key);
close(actual.knownDmiGrossInflow,2257e6,"actual DMI gross funding");
close(actual.knownDmiGrossPayment,740e6,"actual DMI gross payment");
close(actual.netParentCash,300e6,"actual FPL dividend LESS contribution");
close(actual.fplCashBeforeParent,361e6,"FPL parent-waterfall cash");
close(actual.consolidatedBeforeCommon,2183e6,"actual whole financing waterfall before common flows");
close(actual.dmiBookResidualNotCash,17e6,"book residual is not invented cash");
const anchors = neeCashReturnAnchors(facts);
close(anchors.fpl,9912e6,"source normalized pre-interest/tax FPL cash");
close(anchors.other,4014e6,"source residual cash, not NEER project IRR");
assert.equal(actual.unknownOtherGrossOutflow,null);
let checkedCashRows = 0, checkedCapitalComponentRows = 0, negativeCommonRows = 0;
for (const c of report.cases) {
  assert.equal(sha(c.path), c.sha256);
  const result = read(c.path).result, base = f.baselines.find((b: any) => b.id === c.baselineId);
  const replay = buildNeeWaterfall(facts,f.input,{terminalGrowth:c.terminalGrowth,
    operatingMode:c.operatingMode,policyMode:c.policyMode},base.original);
  assert.deepEqual(replay,result);
  assert.deepEqual(result.originalStubUnchanged,base.original.stub);
  close(result.opening2025Bridge.closingPpe.reduce((s:number,v:number)=>s+v,0),
    base.expectedOpening2026Ppe+result.opening2025Bridge.fuelAmortizationBookCorrectionToOldFixedOnlyProxy,"2025 book-only correction");
  close(result.opening2025Bridge.closingDebt,base.expectedOpening2026Debt,"unchanged stub financing");
  close(result.rows[0].openingWc,base.original.opening2026WorkingFunding,"unchanged stub working funding");
  close(result.rows[0].afudcCashClassificationReserve,205e6*1.0325+260e6,"all AFUDC cash classification provision");
  let afudcReserve = 205e6;
  for (const r of result.rows) {
    afudcReserve *= 1+r.nominalGrowth;
    if (r.year<=2029) afudcReserve += [260e6,275e6,295e6,310e6][r.year-2026];
    close(r.afudcCashClassificationReserve,afudcReserve,"source AFUDC upper cash reserve, no release");
    close(r.closingWc,(3336e6+2214e6+1186e6+1487e6-6982e6)*
      (r.closingPpe[0]+r.closingPpe[1])/138852e6+afudcReserve,"independent all working-funding targets");
    // Independent plain-number accounting; do not call the cash builder to check its own row algebra.
    const gross = r.earningPpe[0] * 9912e6 / 76166e6 + r.earningPpe[1] * 4014e6 / 62686e6;
    const interest = r.openingDebt * 2737e6 / 82333e6;
    const tax = .21 * Math.max(0,gross + 811e6*r.priceIndex - r.fixedDa[0] - r.fixedDa[1] -
      299e6*r.priceIndex - interest);
    const spend = r.capitalPpe[0]+r.capitalPpe[1]+399e6*r.priceIndex+194e6*r.priceIndex;
    const cash = gross + 811e6*r.priceIndex - interest - tax + r.policyCash -
      (r.closingWc-r.openingWc) - spend + r.debtProceeds-r.debtRepayments -
      (740e6+653e6)*r.priceIndex;
    close(r.fcfe,cash,`${c.id}/${r.year}/independent common cash`);
    close(r.cashTax,tax,"cash tax, no historical credit double count");
    close(r.capitalSpend,spend,"all capital/fuel/funds");
    close(r.debtProceeds-r.debtRepayments,r.closingDebt-r.openingDebt,"gross debt net");
    close(r.closingDebt,82333e6/138852e6*(r.closingPpe[0]+r.closingPpe[1]),"funded carrying leverage");
    assert.ok(r.debtProceeds >= 0 && r.debtRepayments >= 0);
    close(r.commonCall,Math.max(0,-cash),"signed common call");
    for (let i=0;i<2;i++) {
      close(r.closingPpe[i],r.openingPpe[i]+r.capitalPpe[i]+r.componentFuel[i]-
        r.fixedDa[i]-r.componentNuclearAndOtherAmortization[i],"paid capital incl fuel");
      assert.ok(r.capitalPpe[i]+r.componentFuel[i]+.001 >= r.fixedDa[i]+
        r.componentNuclearAndOtherAmortization[i]+r.nominalGrowth*r.openingPpe[i]);
      checkedCapitalComponentRows++;
    }
    assert.equal(r.unknownExtraGrossNoncommonClaim,null);
    if (r.year>=2039 || c.policyMode==="zero-future-policy-cash") close(r.policyCash,0,"no future policy cash");
    if (r.fcfe<0) negativeCommonRows++;
    checkedCashRows++;
  }
  close(result.rows[15].fcfe,result.rows[14].fcfe*(1+c.terminalGrowth),"sustainable exact funded terminal growth");
  const discount=(year:number)=>(1.1)**(-(Date.parse(`${year}-12-31`)-Date.parse("2025-01-31"))/31557600000);
  const stub=base.original.stub.cashFlows.reduce((s:number,x:any)=>s+x.fcfe*discount(2025),0);
  const explicit=result.rows.slice(0,15).reduce((s:number,x:any)=>s+x.fcfe*discount(x.year),0);
  const tail=result.rows[15].fcfe/(.1-c.terminalGrowth)*discount(2040);
  close(result.formalSignedPlanPv,stub+explicit+tail,"independent stub/terminal PV");
  const j=result.fundedPlanExtraGrossClaimHeadroom2024Usd;
  const delta=result.rows.slice(0,15).reduce((s:number,x:any)=>s+j*x.priceIndex*discount(x.year),0)+
    j*result.rows[15].priceIndex/(.1-c.terminalGrowth)*discount(2040);
  close(delta,result.formalSignedPlanPv,"analytical extra gross claim headroom");
  if(result.rows[4].fcfe>0) close(result.actualFcfe5YearGrowth,
    (result.rows[4].fcfe/169e6)**.2-1,"actual positive-base FCFE CAGR, not operating activity growth");
  else assert.equal(result.actualFcfe5YearGrowth,null);
  assert.equal(result.qualifiedOriginalIssuers,0);
}
assert.equal(report.cases.length,24);
assert.equal(checkedCashRows,384);
assert.equal(checkedCapitalComponentRows,768);
console.log(JSON.stringify({status:"passed",cases:report.cases.length,checkedCashRows,checkedCapitalComponentRows,
  terminalRows:24,negativeCommonRows,primaryBindings: facts.claims.length,
  historicalGrossCashBridgeResiduals:0,qualifiedOriginalIssuers:0,oldKernelsReexecuted:false,
  freezeHash:sha(latest.freezePath),reportHash:sha(latest.reportPath)},null,2));
