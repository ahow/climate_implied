import {contentHash} from "./analysisManifest";
import {calculateCompanyFullCashflowCase} from "./companyFullCashflowCase";

/** Explicit annual cohort accounting. No shipment -> commissioned stock inference,
 * no inferred revenue/avoided emissions and no automatic perpetual stock. */
export interface ServiceCohort {
 id:string; commissionedYear:number; retiredYear:number;
 installedUnits:number; annualDegradation:number;
 capacityUnit:"MW"|"vehicle"|"kWh-storage";
 serviceUnit:"MWh"|"vehicle-km"|"kWh-delivered";
 servicePerInstalledUnitPerYear:number;
 evidenceIds:string[];
}
export interface CohortYear {
 year:number; utilization:number;
 pricePerServiceUsd:number; variableCostPerServiceUsd:number;
 fixedCashCostUsd:number; constructionCashUsd:number; maintenanceCashUsd:number;
 replacementCashUsd:number; decommissioningCashUsd:number;
 cashTaxUsd:number; increaseOperatingWorkingCapitalUsd:number;
 interestCashUsd:number; debtRaisedUsd:number; debtRepaidUsd:number;
 nonCommonCashUsd:number;
}
export interface CohortSpecification {
 years:CohortYear[]; cohorts:ServiceCohort[];
 evidenceIds:string[];
 boundary:"conditional-project-FCFE-not-whole-equity";
 currency:"USD";
 timing:"commission-at-year-start-retire-before-year-service";
}
export function calculateOperatingCohorts(input:CohortSpecification){
 const x: CohortSpecification=JSON.parse(JSON.stringify(input));
 if(x.boundary!=="conditional-project-FCFE-not-whole-equity"||x.currency!=="USD"||
    x.timing!=="commission-at-year-start-retire-before-year-service"||!x.years.length||!x.cohorts.length)
   throw Error("Explicit project cash/stock boundary required");
 if(new Set(x.evidenceIds).size!==x.evidenceIds.length||!x.evidenceIds.length||
    new Set(x.cohorts.map(c=>c.id)).size!==x.cohorts.length)throw Error("Duplicate/missing identities");
 const units=new Set(x.cohorts.map(c=>`${c.capacityUnit}/${c.serviceUnit}`));
 if(units.size!==1)throw Error("Do not aggregate different stocks/services");
 for(const c of x.cohorts){
   if(!c.id||!Number.isInteger(c.commissionedYear)||!Number.isInteger(c.retiredYear)||
      c.retiredYear<=c.commissionedYear||!Number.isFinite(c.installedUnits)||c.installedUnits<=0||
      !Number.isFinite(c.annualDegradation)||c.annualDegradation<0||c.annualDegradation>=1||
      !Number.isFinite(c.servicePerInstalledUnitPerYear)||c.servicePerInstalledUnitPerYear<0||
      !c.evidenceIds.length||c.evidenceIds.some(id=>!x.evidenceIds.includes(id)))
     throw Error("Invalid cohort or missing declared evidence");
   if(!["MW/MWh","vehicle/vehicle-km","kWh-storage/kWh-delivered"].includes(`${c.capacityUnit}/${c.serviceUnit}`))
     throw Error("Incompatible stock/service units");
   if(c.capacityUnit==="MW"&&c.servicePerInstalledUnitPerYear>8760)
     throw Error("Annual equivalent-full-load convention exceeds8760 hours");
 }
 const rows=x.years.map((y,i)=>{
   if(!Number.isInteger(y.year)||(i&&y.year!==x.years[i-1].year+1))
     throw Error("Complete ordered annual window required");
   for(const [k,v] of Object.entries(y)){
     if(!Number.isFinite(v)||(k!=="increaseOperatingWorkingCapitalUsd"&&v<0))
       throw Error(`Missing/invalid explicit annual input ${k}`);
   }
   const required=["utilization","pricePerServiceUsd","variableCostPerServiceUsd","fixedCashCostUsd",
    "constructionCashUsd","maintenanceCashUsd","replacementCashUsd","decommissioningCashUsd",
    "cashTaxUsd","increaseOperatingWorkingCapitalUsd","interestCashUsd","debtRaisedUsd","debtRepaidUsd","nonCommonCashUsd"];
   if(required.some(k=>!Object.hasOwn(y,k))||y.utilization>1)throw Error("No inferred zero cash or utilization");
   const opening=x.cohorts.filter(c=>c.commissionedYear<y.year&&c.retiredYear>=y.year)
     .reduce((s,c)=>s+c.installedUnits,0);
   const added=x.cohorts.filter(c=>c.commissionedYear===y.year).reduce((s,c)=>s+c.installedUnits,0);
   const retired=x.cohorts.filter(c=>c.retiredYear===y.year).reduce((s,c)=>s+c.installedUnits,0);
   const contributions=x.cohorts.filter(c=>c.commissionedYear<=y.year&&c.retiredYear>y.year)
     .map(c=>({id:c.id,stock:c.installedUnits,
       service:c.installedUnits*c.servicePerInstalledUnitPerYear*y.utilization*
         (1-c.annualDegradation)**(y.year-c.commissionedYear),evidenceIds:c.evidenceIds}));
   const closing=contributions.reduce((s,c)=>s+c.stock,0);
   if(Math.abs(opening+added-retired-closing)>Number.EPSILON*Math.max(1,opening+added)*8)
     throw Error("Stock reconciliation failed");
   const service=contributions.reduce((s,c)=>s+c.service,0);
   const revenue=service*y.pricePerServiceUsd,variableCost=service*y.variableCostPerServiceUsd;
   const operatingCashBeforeTax=revenue-variableCost-y.fixedCashCostUsd;
   const capital=y.constructionCashUsd+y.maintenanceCashUsd+y.replacementCashUsd;
   const fcfe=operatingCashBeforeTax-y.cashTaxUsd-y.increaseOperatingWorkingCapitalUsd-
     y.interestCashUsd-capital-y.decommissioningCashUsd+y.debtRaisedUsd-y.debtRepaidUsd-y.nonCommonCashUsd;
   if([service,revenue,variableCost,fcfe].some(v=>!Number.isFinite(v)))throw Error("Nonfinite cohort calculation");
   return {year:y.year,opening,added,retired,closing,service,contributions,revenue,variableCost,
     operatingCashBeforeTax,capital,fcfe,inputs:y};
 });
 return {version:"operating-cohorts-1",inputHash:contentHash(x),rows,
   serviceUnit:x.cohorts[0].serviceUnit,capacityUnit:x.cohorts[0].capacityUnit,
   terminal:{value:null,remainingStock:rows.at(-1)!.closing,
     reason:"Finite cohort cash schedule only; continuing replacement/stock/cash policy and compatible claim required"},
   marketImplied:false,sourceAuthenticated:false,scientificAcceptance:false};
}

/** Reuse the existing fiscal/source/accounting validator. This adapter deliberately
 * stops before valuation: a finite stock schedule does not certify perpetuity. */
export function reconcileCohortIssuerCash(spec:CohortSpecification,accounting:unknown){
 calculateCompanyFullCashflowCase(accounting);
 const x=JSON.parse(JSON.stringify(accounting));
 const physical=calculateOperatingCohorts(spec);
 const financial=[...x.years,...(x.continuation?[...x.continuation.years,x.continuation.terminalYear]:[])];
 if(financial.length!==physical.rows.length)throw Error("Every financial year including continuation/terminal needs physical service");
 const validIds=new Set(x.evidence.map((e:{id:string})=>e.id));
 if(spec.evidenceIds.some(id=>!validIds.has(id)))throw Error("Cohort evidence absent from dated accounting register");
 const rows=financial.map((f:any,i:number)=>{
  const p=physical.rows[i],y=p.inputs;
  if(f.year!==p.year||f.nonClimateRevenue!==0||p.revenue<=0)
   throw Error("Full pure-play fiscal boundary and positive revenue required; idle branches unresolved");
  for(const k of ["recognizedPolicyCredit","cashPolicyCredit","climateOperatingCost",
    "otherNonCash","otherOperatingCash","openingReceivables","closingReceivables"])
   if(f[k]!==0)throw Error(`Separate ${k} reconciliation required; no double cash accounting`);
  return {...f,climateRevenue:p.revenue/1e6,
   operatingMarginBeforeClimateCostsAndCredits:(p.operatingCashBeforeTax/1e6-f.depreciation)/(p.revenue/1e6),
   cashTax:y.cashTaxUsd/1e6,increaseOtherOperatingWorkingCapital:y.increaseOperatingWorkingCapitalUsd/1e6,
   interestPaid:y.interestCashUsd/1e6,capitalSpend:p.capital/1e6,
   otherOperatingCash:-y.decommissioningCashUsd/1e6,debtProceeds:y.debtRaisedUsd/1e6,
   debtRepayments:y.debtRepaidUsd/1e6,nonCommonCashClaims:y.nonCommonCashUsd/1e6,
   evidenceIds:Array.from(new Set([...f.evidenceIds,...spec.evidenceIds]))};
 });
 x.years=rows.slice(0,5);
 if(x.continuation){x.continuation.years=rows.slice(5,15);x.continuation.terminalYear=rows[15];}
 return {physical,accounting:x,cash:calculateCompanyFullCashflowCase(x),valuation:null,
  reason:"Cash-on-service, no separate credits/noncash items; finite physical cash reconciliation only, perpetual stock/reinvestment and claim admission unresolved"};
}
