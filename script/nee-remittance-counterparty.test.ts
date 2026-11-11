import {test} from "node:test";
import assert from "node:assert/strict";
import {buildNeeRemittanceCase,remittanceIdentification,publicNeeRemittanceSummary,extractNeeRemittanceFacts,
  type NeeRemittanceFacts,type RemittanceBaseline,type RemittanceRow} from "../server/calculation/neeRemittanceCounterparty";
// Synthetic engineering data ONLY. No source/private data or filesystem/network dependencies.
const facts:NeeRemittanceFacts={bindings:[],consolidatedAffiliateCash:20,reportedCreditSupportExposure:40,
  guaranteeFairValueNotCash:2,thirdPartySweepPayable:3,currentRelatedReceivable:4,noncurrentRelatedReceivable:5,
  serviceFeeIncomeNotCashReceipt:1,financedJointVentureDistribution:26,financedJointVentureNciDerecognitionNotCash:30,
  xplrDistributionSuspendedIndefinitely:true,xplrShareOfConsolidatedAffiliateCash:null,
  financedDistributionOverlapWithCfoAffiliateCash:null};
const reference={referenceDate:"2025-01-31",discountRate:.1,actualBaseFcfe:1};
function baseline(g=.025):RemittanceBaseline{
  let index=1;
  const rows:RemittanceRow[]=[];
  for(let year=2026;year<=2041;year++){
    const growth=.0325+(g-.0325)*Math.max(0,Math.min(10,year-2030))/10;index*=1+growth;
    rows.push({year,priceIndex:index,nominalGrowth:growth,grossOperatingCash:280*index,affiliateCash:20*index,
      interest:10*index,fixedDa:[30*index,20*index],nuclearAmortization:5*index,cashTax:.21*235*index,
      policyCash:0,increaseWorkingFunding:8*index,capitalSpend:140*index,debtProceeds:15*index,
      debtRepayments:10*index,dmiCashClaim:4*index,otherConditionalReserve:3*index,
      taxableCashProfitProxy:235*index,fcfe:90.65*index,commonCall:0,cashReserve:10*index});
  }
  return {options:{terminalGrowth:g},rows,qualifiedOriginalIssuers:0,
    originalStubUnchanged:{cashFlows:[{date:"2025-12-31",fcfe:-2}]}};
}
const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)),`${a} != ${b}`);
const build=(reserve=false,b=baseline(),f=facts)=>buildNeeRemittanceCase(f,b,{reservePolicy:reserve?
  "reported-exposure-scale-cash-provision":"no-extra-guarantee-cash-provision"},reference);
test("Unknown equity/financed-cash intersection stays unknown, never double subtracted",()=>{
  const x=remittanceIdentification(facts);
  assert.equal(x.financedDistributionAmountInConsolidatedCash.upper,20);
  assert.equal(x.unionOfAtRiskHistoricAffiliateCash.upper,20);
  assert.equal(x.suspendedAffiliateAmountInConsolidatedCash.observed,null);
  assert.equal(x.ownershipPercentUsedForCash,false);
});
test("Independent zero-remittance operating/tax/funding rebuild, not FCFE scaling",()=>{
  const b=baseline(),r=build(false,b);
  r.rows.forEach((x,i)=>{
    const p=x.priceIndex,tax=.21*(280-30-20-5-10)*p;
    const cash=(280-10-8-140+15-10-4-3)*p-tax;
    close(x.cashTax,tax);close(x.fcfe,cash);
    close(b.rows[i].fcfe-x.fcfe,20*p*.79);
    close(x.affiliateCash,0);close(x.capitalSpend,b.rows[i].capitalSpend);
  });
  assert.equal(r.actualGuaranteeCallsObserved,null);
  assert.deepEqual(r.originalStubUnchanged,b.originalStubUnchanged);
});
test("Exposure-scale cash provision funded ONCE, held and never paid/writeoff again",()=>{
  const no=build(),held=build(true);
  held.rows.forEach((x,i)=>{
    close(no.rows[i].fcfe-x.fcfe,i===0?40:0);
    close(x.incrementalRestrictedCashHeld,40);
    close(x.totalCashReserveIncludingExtraProvision,x.cashReserve+40);
    close(x.extraGuaranteeExpenseOrCall+x.extraReceivableWriteoffCash+x.cashSweepRelease,0);
  });
  const changed=structuredClone(facts);
  changed.guaranteeFairValueNotCash=1e9;changed.currentRelatedReceivable=1e9;
  assert.deepEqual(build(true,baseline(),changed).rows,held.rows);
});
test("Independent original-range terminal/stub PV, exact growth and refusal of negative plan PV",()=>{
  for(const g of [.025,.0325,.04]){
    const r=build(true,baseline(g));
    const df=(year:number)=>1.1**(-(Date.parse(`${year}-12-31`)-Date.parse("2025-01-31"))/31557600000);
    const pv=-2*df(2025)+r.rows.slice(0,15).reduce((s,x)=>s+x.fcfe*df(x.year),0)+
      r.rows[15].fcfe/(.1-g)*df(2040);
    close(r.signedPlanPv,pv);close(r.rows[15].fcfe,r.rows[14].fcfe*(1+g));
    close(r.actualFcfe5YearGrowth!,r.rows[4].fcfe**.2-1);
  }
  const large=structuredClone(facts);large.reportedCreditSupportExposure=1e6;
  const refused=build(true,baseline(),large);
  assert.ok(refused.terminalFcfe>0);
  assert.equal(refused.forwardWholeEquity,null);
  assert.equal(refused.status,"refused-nonpositive-funded-plan-pv");
});
test("Safe derived projection has explicit allowlist, no raw market/source/path spread",()=>{
  const noisy={...build(),price:99,shares:123,sourceHtml:"PRIVATE",path:"PRIVATE",provider:{token:"PRIVATE"}};
  const summary=publicNeeRemittanceSummary([noisy]);
  assert.equal(summary.calculationCases,1);assert.equal(summary.futureCashRows,16);
  assert.equal(summary.qualifiedOriginalIssuers,0);
  assert.ok(!/PRIVATE|shares|sourceHtml|provider|\"price\"/.test(JSON.stringify(summary)));
  assert.throws(()=>publicNeeRemittanceSummary([]),/nonempty/);
});
test("Missing primary/context and changed baseline are explicit errors",()=>{
  assert.throws(()=>extractNeeRemittanceFacts("<html>No source fixture</html>"),/Missing primary/);
  const changed=baseline();changed.rows[0].affiliateCash=0;
  assert.throws(()=>build(false,changed),/baseline affiliate/);
  assert.throws(()=>buildNeeRemittanceCase(facts,baseline(),{reservePolicy:"no-extra-guarantee-cash-provision"},
    {...reference,actualBaseFcfe:-1}),/timeline/);
});
