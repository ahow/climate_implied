import {contentHash} from "./analysisManifest";
import {calculateOperatingCohorts,type CohortSpecification} from "./operatingCohorts";

/** Exact periodic renewal only. Not a growth perpetuity or issuer valuation.
 * Two explicit adjacent cycles demonstrate the declared stock/energy/cash law;
 * source qualification and legal common-claim admission remain separate. */
export interface RenewalDeclaration {
 version:"periodic-renewal-1";
 claim:"conditional-project-common-residual";
 specification:CohortSpecification;
 cycleYears:number;
 discountRate:number;
 openingAgeStock:number[];
 closingAgeStock:number[];
 openingDebtUsd:number;closingDebtUsd:number;
 openingWorkingCapitalUsd:number;closingWorkingCapitalUsd:number;
 openingUnpaidTaxUsd:number;closingUnpaidTaxUsd:number;
 replacementCostPerUnitUsd:number;
 evidenceIds:string[];
 transition?:{
  specification:CohortSpecification;
  openingDebtUsd:number;openingWorkingCapitalUsd:number;
 };
}
export function evaluatePeriodicRenewal(input:RenewalDeclaration){
 const x:RenewalDeclaration=JSON.parse(JSON.stringify(input));
 const n=x.cycleYears;
 if(x.version!=="periodic-renewal-1"||x.claim!=="conditional-project-common-residual"||
  !Number.isInteger(n)||n<1||n>100||!Number.isFinite(x.discountRate)||x.discountRate<=0||x.discountRate>=1||
  !x.evidenceIds.length||x.evidenceIds.some(id=>!x.specification.evidenceIds.includes(id)))
  throw Error("Explicit bounded periodic project declaration required");
 if(x.specification.liquidation||x.specification.timing!=="commission-at-year-start-retire-before-year-service")
  throw Error("Dated/liquidation continuation requires a separate timing law");
 if(x.specification.cohorts.some(c=>c.capacityUnit==="kWh-storage"))
  throw Error("Storage renewal needs a separately reconciled dated charge/loss continuation");
 const model=calculateOperatingCohorts(x.specification);
 if(model.rows.length!==2*n)throw Error("Two complete explicit cycles required");
 const equal=(a:number,b:number)=>{
  if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))
   throw Error("Periodic stock, energy or cash reconciliation failed");
 };
 if(x.openingAgeStock.length!==n||x.closingAgeStock.length!==n||
  [...x.openingAgeStock,...x.closingAgeStock].some(v=>!Number.isFinite(v)||v<0))
  throw Error("Complete age-stock boundary required");
 const ageVector=(year:number)=>Array.from({length:n},(_,age)=>x.specification.cohorts
  .filter(c=>c.commissionedYear===year-age&&c.retiredYear>year).reduce((s,c)=>s+c.installedUnits,0));
 const firstYear=model.rows[0].year;
 for(const c of x.specification.cohorts)
  if(c.retiredYear-c.commissionedYear!==n)throw Error("Declared common service life must equal renewal cycle");
 const opening=ageVector(firstYear),closing=ageVector(firstYear+n);
 opening.forEach((v,i)=>{equal(v,x.openingAgeStock[i]);equal(closing[i],x.closingAgeStock[i]);equal(v,closing[i]);});
 for(const key of ["DebtUsd","WorkingCapitalUsd","UnpaidTaxUsd"] as const){
  const a=x[`opening${key}`],b=x[`closing${key}`];
  if(a<0||b<0)throw Error("Negative declared liability/asset balance");
  equal(a,b);
 }
 if(!Number.isFinite(x.replacementCostPerUnitUsd)||x.replacementCostPerUnitUsd<=0)
  throw Error("Positive explicit replacement capital required");
 const cycle=model.rows.slice(0,n),repeat=model.rows.slice(n);
 let debt=x.openingDebtUsd,wc=x.openingWorkingCapitalUsd;
 cycle.forEach((r,i)=>{
  const s=repeat[i];
  for(const field of ["closing","service","revenue","variableCost","capital","fcfe","energyCost"] as const)
   equal(r[field],s[field]);
  for(const [key,value] of Object.entries(r.inputs))
   if(key!=="year")equal(value,(s.inputs as unknown as Record<string,number>)[key]);
  equal(r.added,r.retired);
  equal(r.inputs.replacementCashUsd,r.added*x.replacementCostPerUnitUsd);
  if(r.inputs.constructionCashUsd!==0)throw Error("Growth capital is outside stationary renewal");
  debt+=r.inputs.debtRaisedUsd-r.inputs.debtRepaidUsd;
  wc+=r.inputs.increaseOperatingWorkingCapitalUsd;
  if(debt<0||wc<0)throw Error("Negative intermediate debt or working capital");
 });
 equal(debt,x.closingDebtUsd);equal(wc,x.closingWorkingCapitalUsd);
 // All cash is explicit annual end-period cash. No additional WC release,
 // liquidation, terminal sale or debt deduction is added a second time.
 const cyclePv=cycle.reduce((s,r,i)=>s+r.fcfe/(1+x.discountRate)**(i+1),0);
 const value=cyclePv/(1-(1+x.discountRate)**-n);
 if(!Number.isFinite(value))throw Error("Nonfinite periodic value");
 let transition=null;
 if(x.transition){
  const t=x.transition, tm=calculateOperatingCohorts(t.specification);
  if(t.specification.liquidation||t.specification.currency!==x.specification.currency||
   t.specification.timing!==x.specification.timing||
   tm.capacityUnit!==model.capacityUnit||tm.serviceUnit!==model.serviceUnit||
   tm.rows.at(-1)!.year+1!==firstYear)
   throw Error("Contiguous same-unit transition without liquidation required");
  if(!Number.isFinite(t.openingDebtUsd)||t.openingDebtUsd<0||
   !Number.isFinite(t.openingWorkingCapitalUsd)||t.openingWorkingCapitalUsd<0)
   throw Error("Explicit nonnegative transition balances required");
  const survivors=t.specification.cohorts.filter(c=>c.commissionedYear<firstYear&&c.retiredYear>=firstYear);
  const incoming=x.specification.cohorts.filter(c=>c.commissionedYear<firstYear&&c.retiredYear>=firstYear);
  const canonical=(cs:typeof survivors)=>cs.map(c=>[c.id,contentHash(c)]).sort((a,b)=>a[0].localeCompare(b[0]));
  if(contentHash(canonical(survivors))!==contentHash(canonical(incoming)))
   throw Error("Transition surviving cohorts changed at terminal boundary");
  equal(tm.rows.at(-1)!.closing,model.rows[0].opening);
  let td=t.openingDebtUsd,tw=t.openingWorkingCapitalUsd,cumulative=0,minimum=0;
  for(const row of tm.rows){
   td+=row.inputs.debtRaisedUsd-row.inputs.debtRepaidUsd;
   tw+=row.inputs.increaseOperatingWorkingCapitalUsd;
   if(td<0||tw<0)throw Error("Transition balance becomes negative");
   cumulative+=row.fcfe;minimum=Math.min(minimum,cumulative);
  }
  equal(td,x.openingDebtUsd);equal(tw,x.openingWorkingCapitalUsd);
  const pv=tm.rows.reduce((s,r,i)=>s+r.fcfe/(1+x.discountRate)**(i+1),0);
  transition={model:tm,transitionPv:pv,terminalAtBoundary:value,
   discountedTerminal:value/(1+x.discountRate)**tm.rows.length,
   combinedConditionalProjectPv:pv+value/(1+x.discountRate)**tm.rows.length,
   annualNetFundingRequirement:Math.max(0,-minimum),
   fundingQualification:"Annual net balance only; intra-year liquidity/committed funding not established"};
 }
 return {version:x.version,inputHash:contentHash(x),model,cyclePv,
  valuationBoundary:`${firstYear}-01-01 before first-cycle cash`,
  cashCountingRule:"Repeated cycles verify the law; do not add their cash again to the periodic value",
  transition,
  conditionalPeriodicProjectValueUsd:value,
  formulas:{cyclePv:"sum(FCFE_t/(1+r)^t), t=1..L",value:"cyclePv/(1-(1+r)^(-L))"},
  limitations:["Assumed stationary renewal, not observed future economics","No growth inversion or whole-equity claim","Cash tax is an explicit input; accrual-tax identification not established"],
  marketImplied:false,scientificAcceptance:false};
}
