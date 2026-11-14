import {contentHash} from "./analysisManifest";
import {settleTerminal,type TerminalSettlement,type TerminalBalances} from "./terminalSettlement";
import {compileDispositionSettlement,type CohortDisposition} from "./cohortDisposition";
import {calculatePostCutoff,ownedFinancialSpecification,type PostCutoffInterval} from "./cohortPostCutoff";
import {invertGregorianRenewal,type GregorianInverseProtocol} from "./gregorianInverse";
import {reconcileRenewalFamily,type RenewalFamily} from "./renewalFamily";
import {calculateOperatingCohorts,type CohortSpecification} from "./operatingCohorts";
import {calculateCoveredPhysicalPaths,type PhysicalCell,type CoveredPathInput} from "./coveredPhysicalPaths";
import {evaluatePeriodicRenewal,type RenewalDeclaration,type GregorianRenewalDeclaration} from "./cohortRenewal";
import {reconcileDatedAccruals,type CohortCashLedger,type DatedProjectCash,type CashTiming,type AccrualSchedule} from "./cohortCashLedger";
export interface CompanyCohortInput {
 renewalFamily?:RenewalFamily;
 version:"company-cohort-input-1";companyId:string;cutoff:string;
 years:number[];cells:CoveredPathInput["cells"];
 scenarios:{id:string;specification:CohortSpecification;
   renewal?:RenewalDeclaration|GregorianRenewalDeclaration;
   renewalInverse?:GregorianInverseProtocol;
   finiteAccounting?:{ledger:CohortCashLedger;declaration:Omit<DatedProjectCash,"events">;timing:CashTiming[];accrual:AccrualSchedule;
    recognitionLaw?:"earned-service-prefix-1";terminal?:TerminalSettlement;assetDisposition?:CohortDisposition;postCutoff?:PostCutoffInterval};
   physical:(Omit<PhysicalCell,"activity"|"activityUnit"|"parentResultHash"|"parentActivityPointer"|"parentYearPointer"|"parentUnitPointer"> & {cohortId:string;activityChannel:"service"|"charge-energy"})[]}[];
}
/** Query a prefix of the SAME physical law. Capped retirement is an integration
 * bound only, never a replacement source fact or a reported retirement date. */
function assessRecognition(s:CompanyCohortInput["scenarios"][number]){
 const f=s.finiteAccounting!;
 if(f.recognitionLaw===undefined)return null;
 if(f.recognitionLaw!=="earned-service-prefix-1"||s.specification.timing!=="utc-civil-day-service"||
  f.accrual.version!=="dated-accrual-2")throw Error("Explicit supported daily recognition law required");
 if(f.accrual.entries.some(e=>e.kind==="payable"&&!e.component))
  throw Error("Classify payable components before physical recognition assessment");
 const checks=[];
 for(const on of Array.from(new Set(f.accrual.entries.map(e=>e.on))).sort()){
  const year=Number(on.slice(0,4)),yearStart=`${year}-01-01`;
  const cap=new Date(Date.parse(on)+86400000).toISOString().slice(0,10);
  const cohorts=s.specification.cohorts.filter(c=>c.dated!.commissionedOn<cap&&c.dated!.retiredOn>yearStart)
   .map(c=>{const retiredOn=c.dated!.retiredOn<cap?c.dated!.retiredOn:cap;
    return {...c,retiredYear:Number(retiredOn.slice(0,4)),dated:{...c.dated!,retiredOn}};});
  const annual=s.specification.years.find(y=>y.year===year)!;
  const prefix=cohorts.length?calculateOperatingCohorts({...s.specification,liquidation:undefined,years:[annual],cohorts}).rows[0]:null;
  for(const component of ["revenue","variableCost","energyCost"] as const){
   const recognized=f.accrual.entries.filter(e=>e.on.startsWith(`${year}-`)&&e.on<=on&&
    (component==="revenue"?e.kind==="revenue":e.kind==="payable"&&e.component===component)).reduce((v,e)=>v+e.usd,0);
   const earned=prefix?.[component]??0;
   if(recognized-earned>1e-9*Math.max(1,Math.abs(earned),Math.abs(recognized)))
    throw Error(`Recognition precedes modeled physical service: ${on}/${component}`);
   checks.push({on,component,recognizedUsd:recognized,earnedThroughDayUsd:earned,unrecognizedUsd:earned-recognized});
  }
 }
 return {version:f.recognitionLaw,checks,
  boundary:"End-of-UTC-day service prefix; delayed recognition allowed. Not legal/GAAP acceptance, intraday proof or complete balance-sheet accounting."};
}
/** Executed by the existing operating review lifecycle. Calling this calculation
 * directly is NOT approval or trusted producer admission. */
export function projectCompanyCohorts(input:CompanyCohortInput){
 if(input.version!=="company-cohort-input-1"||!input.companyId||!input.scenarios.length||
    input.cells.some(c=>c.issuer!==input.companyId))throw Error("Explicit issuer/domain required");
 const parents:CoveredPathInput["parents"]=[],members:any[]=[];
 const scenarios=input.scenarios.map(s=>{
  if(s.renewal&&s.finiteAccounting)throw Error("Choose one cash inclusion: finite accounting or renewal");
  const physical=calculateOperatingCohorts(s.specification);
  if(physical.rows.map(r=>r.year).join(",")!==input.years.join(","))throw Error("Complete declared cohort years required");
  const activity=physical.rows.flatMap(row=>s.specification.cohorts.flatMap(c=>[{
   year:row.year,cohortId:c.id,unit:physical.serviceUnit,
   channel:"service",activity:row.contributions.find(v=>v.id===c.id)?.service??0
  },...(c.dated&&c.capacityUnit==="kWh-storage"?[{
    year:row.year,cohortId:c.id,unit:"kWh-charged" as const,channel:"charge-energy",
    activity:row.contributions.find(v=>v.id===c.id)?.chargeKwh??0
  }]:[])]));
  const payload={version:"company-cohort-activity-1",inputHash:contentHash(s.specification),activity};
  const id=contentHash(payload);if(!parents.some(p=>p.hash===id))parents.push({hash:id,payload});
  const coordinates=new Set<string>();
  const cells=s.physical.map(c=>{
   if(c.issuer!==input.companyId)throw Error("Swapped issuer");
   const coordinate=JSON.stringify([c.cohortId,c.year,c.scope,c.gas]);
   if(coordinates.has(coordinate))throw Error("Duplicated cohort ownership/channel");
   coordinates.add(coordinate);
   const i=activity.findIndex(a=>a.cohortId===c.cohortId&&a.year===c.year&&a.channel===c.activityChannel);
   if(i<0)throw Error("Missing genuine producer activity; no caller activity fallback");
   const {cohortId,activityChannel,...cell}=c;
   return {...cell,activity:activity[i].activity,activityUnit:activity[i].unit,
    parentResultHash:id,parentActivityPointer:`/activity/${i}/activity`,
    parentYearPointer:`/activity/${i}/year`,parentUnitPointer:`/activity/${i}/unit`};
  });
  let renewal;
  let renewalInverse;
  if(s.renewal){
   const boundary=s.renewal.transition?.specification??s.renewal.specification;
   if(contentHash(boundary)!==contentHash(s.specification))throw Error("Swapped renewal/producer physical boundary");
   renewal=evaluatePeriodicRenewal(s.renewal);
   if(s.renewalInverse){
    if(s.renewal.version!=="gregorian-renewal-1")throw Error("Inverse requires the matching Gregorian cash branch");
    renewalInverse=invertGregorianRenewal(s.renewal,s.renewalInverse);
   }
  }
  else if(s.renewalInverse)throw Error("Inverse without its executable renewal parent");
  const f=s.finiteAccounting;
  if(f?.postCutoff&&(!f.assetDisposition||!f.terminal||f.recognitionLaw!=="earned-service-prefix-1"))
   throw Error("Delayed operations require explicit asset/terminal/daily recognition contracts");
  if(f?.assetDisposition&&!f.terminal)throw Error("Asset disposition requires explicit terminal funding/claim settlement");
  for(const asset of f?.assetDisposition?.assets??[]){
   const sourceCells=s.physical.filter(c=>c.cohortId===asset.cohortId);
   if(sourceCells.some(c=>c.basis!==f!.assetDisposition!.stockBasis||c.ownership!==asset.ownedFraction))
    throw Error("Asset rights/ownership contradict declared physical source cells");
  }
  const financialSpec=f?.postCutoff?ownedFinancialSpecification(s.specification,f.assetDisposition!,false,f.postCutoff.priorRetiredOwnership):s.specification;
  const financialPhysical=f?.postCutoff?calculateOperatingCohorts(financialSpec):physical;
  const finiteAccounting=f?{
   physicalParentHash:id,
   physicalCashBasis:"Model cost basis before explicit settlement bridge; not whole-equity FCFE",
   ...reconcileDatedAccruals(financialPhysical,f.ledger,f.declaration,f.timing,f.accrual,s.specification.evidenceIds),
   ...(f.postCutoff?{financialExposureInputHash:contentHash(financialSpec),financialExposureBasis:f.postCutoff.cashBasis}:{}),
   version:"finite-cohort-accrual-1",
   periodicValueUsd:null
  }:null;
  if(finiteAccounting){
   const recognition=assessRecognition({...s,specification:financialSpec});
   Object.assign(finiteAccounting,{recognitionAssessment:recognition});
   if(recognition)finiteAccounting.version="finite-cohort-accrual-2-daily-bound";
   if(f?.terminal){
    if(s.specification.liquidation)throw Error("Choose one terminal cash inclusion; legacy liquidation cannot be added twice");
    const last=finiteAccounting.accrualDays.at(-1);
    if(!last)throw Error("Terminal settlement requires dated closing balances");
    const closing={} as TerminalBalances;
    for(const k of ["cash","receivables","payables","tax","otherWC","debt","nonCommon"] as const)closing[k]=last[k];
    if(f.postCutoff){
     const delayed=calculatePostCutoff(s.specification,f.assetDisposition!,f.postCutoff,f.terminal,closing,id,f.declaration.valuationOn,f.declaration.discountRate);
     Object.assign(finiteAccounting,{postCutoffInterval:delayed,terminal:delayed.cash,
      combinedFiniteProjectPresentValueUsd:finiteAccounting.finiteCommonCashPvUsd+delayed.cash.presentCommonCashUsd,
      combinedValueClaim:"Finite owned-project common cash, not whole equity"});
     finiteAccounting.version="finite-cohort-accrual-7-delayed";
    }else{
    const disposition=f.assetDisposition?compileDispositionSettlement(s.specification,f.assetDisposition,f.terminal,closing):undefined;
    if(disposition&&!disposition.compiled){
     Object.assign(finiteAccounting,{assetDisposition:disposition,terminal:null,combinedFiniteProjectPresentValueUsd:null,
      terminalUnavailableReasons:disposition.assessment.missing});
     finiteAccounting.version=f.assetDisposition?.version==="cohort-disposition-2-rights"?"finite-cohort-accrual-5-rights":"finite-cohort-accrual-4-disposition";
    }else{
    const terminal=settleTerminal(disposition?.compiled??f.terminal,disposition?.closing??closing,id,f.ledger.claimantId,
     `${Math.max(...input.years)+1}-01-01`,f.declaration.valuationOn,f.declaration.discountRate,s.specification.evidenceIds);
    Object.assign(finiteAccounting,{terminal,combinedFiniteProjectPresentValueUsd:
     finiteAccounting.finiteCommonCashPvUsd+terminal.presentCommonCashUsd,
     combinedValueClaim:"Finite declared project common cash only; not whole equity"});
    finiteAccounting.version="finite-cohort-accrual-3-terminal";
    if(disposition){Object.assign(finiteAccounting,{assetDisposition:disposition});finiteAccounting.version=f.assetDisposition?.version==="cohort-disposition-2-rights"?"finite-cohort-accrual-5-rights":"finite-cohort-accrual-4-disposition";}
    if(terminal.openingObligations)finiteAccounting.version="finite-cohort-accrual-6-opening-obligations";
    }
    }
   }
  }
  members.push({id:s.id,physical,parentResultHash:id,...(renewal?{renewal}:{}),...(renewalInverse?{renewalInverse}:{}),...(finiteAccounting?{finiteAccounting}:{})});
  return {id:s.id,assumptions:{specification:s.specification,physical:s.physical,...(s.renewal?{renewal:s.renewal}:{}),
   ...(f?{finiteAccounting:f}:{}),...(s.renewalInverse?{renewalInverse:s.renewalInverse}:{})},cells};
 });
 const covered=calculateCoveredPhysicalPaths({cutoff:input.cutoff,population:[input.companyId],
  years:input.years,cells:input.cells,parents,scenarios});
 return {version:"company-cohort-projection-2",status:"conditional-cohort-projection",members,covered,inputHash:contentHash(input),
  assumptionHash:contentHash(input.scenarios),
  modelVersions:members.map(m=>({scenarioId:m.id,cohort:m.physical.version,liquidation:m.physical.liquidation?.version??null,...(m.renewal?{renewal:m.renewal.version}:{}),
   ...(m.renewalInverse?{renewalInverse:m.renewalInverse.version}:{}),
   ...(m.finiteAccounting?{finiteAccounting:m.finiteAccounting.version,accrual:m.finiteAccounting.accrualVersion}:{})})),
  ...(members.some(m=>m.renewal)||("renewalFamily" in input)?{renewalFamilyCoverage:reconcileRenewalFamily(input,members)}:{}),
  scientificAcceptance:false,marketIdentified:false};
}
