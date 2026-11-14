import {contentHash} from "./analysisManifest";
import {settleTerminal,type TerminalSettlement,type TerminalBalances} from "./terminalSettlement";
import {compileDispositionSettlement,type CohortDisposition} from "./cohortDisposition";
import {calculatePostCutoff,ownedFinancialSpecification,type PostCutoffInterval} from "./cohortPostCutoff";
import {invertGregorianRenewal,type GregorianInverseProtocol} from "./gregorianInverse";
import {reconcileRenewalFamily,type RenewalFamily} from "./renewalFamily";
import {freezeFundedDeploymentTransition,evaluateFundedDeploymentTransition,type FundedDeploymentTransition} from "./fundedDeploymentTransition";
import {compileDeploymentGrowth,freezeDeploymentGrowth} from "./deploymentGrowth";
import {assessCohortRecognition} from "./cohortRecognition";
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
   fundedTransition?:FundedDeploymentTransition;
   finiteAccounting?:{ledger:CohortCashLedger;declaration:Omit<DatedProjectCash,"events">;timing:CashTiming[];accrual:AccrualSchedule;
    recognitionLaw?:"earned-service-prefix-1";terminal?:TerminalSettlement;assetDisposition?:CohortDisposition;postCutoff?:PostCutoffInterval};
   physical:(Omit<PhysicalCell,"activity"|"activityUnit"|"parentResultHash"|"parentActivityPointer"|"parentYearPointer"|"parentUnitPointer"> & {cohortId:string;activityChannel:"service"|"charge-energy"})[]}[];
}
/** Query a prefix of the SAME physical law. Capped retirement is an integration
 * bound only, never a replacement source fact or a reported retirement date. */
function assessRecognition(s:CompanyCohortInput["scenarios"][number]){
 return assessCohortRecognition(s.specification,s.finiteAccounting!.accrual,s.finiteAccounting!.recognitionLaw);
}
/** Executed by the existing operating review lifecycle. Calling this calculation
 * directly is NOT approval or trusted producer admission. */
export function projectCompanyCohorts(input:CompanyCohortInput){
 if(input.version!=="company-cohort-input-1"||!input.companyId||!input.scenarios.length||
    input.cells.some(c=>c.issuer!==input.companyId))throw Error("Explicit issuer/domain required");
 const parents:CoveredPathInput["parents"]=[],members:any[]=[];
 const scenarios=input.scenarios.map(s=>{
  if([s.renewal,s.finiteAccounting,s.fundedTransition].filter(Boolean).length>1)throw Error("Choose one cash inclusion: finite accounting, renewal or funded transition");
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
  let fundedTransition;
  if(s.fundedTransition){
   const x=s.fundedTransition;
   if(x.deployment.baselineBinding.cutoff!==input.cutoff.slice(0,10)||
    contentHash(compileDeploymentGrowth(freezeDeploymentGrowth(x.deployment),x.growth).specification)!==contentHash(s.specification))
    throw Error("Swapped funded transition/producer source cutoff or physical boundary");
   fundedTransition=evaluateFundedDeploymentTransition(freezeFundedDeploymentTransition(x));
  }
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
    if(terminal.version==="terminal-settlement-3-recovery")finiteAccounting.version="finite-cohort-accrual-8-recovery";
    }
    }
   }
  }
  members.push({id:s.id,physical,parentResultHash:id,...(fundedTransition?{fundedTransition}:{}),...(renewal?{renewal}:{}),...(renewalInverse?{renewalInverse}:{}),...(finiteAccounting?{finiteAccounting}:{})});
  return {id:s.id,assumptions:{specification:s.specification,physical:s.physical,...(s.renewal?{renewal:s.renewal}:{}),
   ...(s.fundedTransition?{fundedTransition:s.fundedTransition}:{}),...(f?{finiteAccounting:f}:{}),...(s.renewalInverse?{renewalInverse:s.renewalInverse}:{})},cells};
 });
 const covered=calculateCoveredPhysicalPaths({cutoff:input.cutoff,population:[input.companyId],
  years:input.years,cells:input.cells,parents,scenarios});
 return {version:"company-cohort-projection-2",status:"conditional-cohort-projection",members,covered,inputHash:contentHash(input),
  assumptionHash:contentHash(input.scenarios),
  modelVersions:members.map(m=>({scenarioId:m.id,cohort:m.physical.version,liquidation:m.physical.liquidation?.version??null,...(m.renewal?{renewal:m.renewal.version}:{}),
   ...(m.renewalInverse?{renewalInverse:m.renewalInverse.version}:{}),
   ...(m.fundedTransition?{fundedTransition:m.fundedTransition.version,domainHash:m.fundedTransition.definitionHash}:{}),
   ...(m.finiteAccounting?{finiteAccounting:m.finiteAccounting.version,accrual:m.finiteAccounting.accrualVersion}:{})})),
  ...(members.some(m=>m.renewal)||("renewalFamily" in input)?{renewalFamilyCoverage:reconcileRenewalFamily(input,members)}:{}),
  scientificAcceptance:false,marketIdentified:false};
}
