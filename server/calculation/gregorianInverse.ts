import {contentHash} from "./analysisManifest";
import {evaluateGregorianRenewal,type GregorianRenewalDeclaration} from "./gregorianRenewal";
export interface GregorianInverseProtocol{
 version:"gregorian-affine-price-inverse-1";baseInputHash:string;claimantId:string;valuationOn:string;
 targetKind:"conditional-project-common-cash";currency:"USD";targetValueUsd:number;
 priceDeltaDomain:[number,number];residualToleranceUsd:number;
 heldFixed:"all-physical-and-nonprice-inputs";taxBasis:"explicit-zero-tax-only";
}
export function invertGregorianRenewal(x:GregorianRenewalDeclaration,p:GregorianInverseProtocol){
 const definitionHash=contentHash({input:x,protocol:p});
 const common={version:p.version,definitionHash,marketImplied:false,scientificAcceptance:false,
  definitionScope:"Runtime pre-execution inputs, not independently authenticated preregistration or owner acceptance"};
 const unsupported=(reason:string)=>({...common,status:"unsupported" as const,reason,roots:[] as number[]});
 if(p.version!=="gregorian-affine-price-inverse-1"||p.baseInputHash!==contentHash(x)||p.claimantId!==x.cashLedger.claimantId||
  p.valuationOn!==x.datedAccounting.declaration.valuationOn||p.targetKind!=="conditional-project-common-cash"||p.currency!=="USD"||
  p.heldFixed!=="all-physical-and-nonprice-inputs"||p.taxBasis!=="explicit-zero-tax-only"||
  !Number.isFinite(p.targetValueUsd)||!Number.isFinite(p.residualToleranceUsd)||p.residualToleranceUsd<=0||
  p.priceDeltaDomain.length!==2||p.priceDeltaDomain.some(v=>!Number.isFinite(v))||p.priceDeltaDomain[0]>p.priceDeltaDomain[1])
  return unsupported("Explicit matching claim, domain and numerical tolerance required");
 for(const y of x.specification.years){
  const l=x.cashLedger.years.find(l=>l.year===y.year)!;
  if(!l||x.datedAccounting.accrual.entries.filter(e=>e.kind==="revenue"&&e.on===`${y.year}-12-31`).length!==1)
   return unsupported("One explicit annual revenue accrual and cash year required");
  if(y.cashTaxUsd!==0||y.increaseOperatingWorkingCapitalUsd!==0||l.taxAccrual!==0||l.openingReceivables!==0||l.closingReceivables!==0||
   l.commonContribution!==0||y.pricePerServiceUsd+p.priceDeltaDomain[0]<0)
   return unsupported("Domain requires zero explicit tax/AR/working-capital change, no contributions, and nonnegative prices");
  for(const component of ["collections","commonDistribution"]){
   const t=x.datedAccounting.timing.find(t=>t.year===y.year&&t.component===component);
   if(!t||t.allocations.length!==1||t.allocations[0].on!==`${y.year}-12-31`||t.allocations[0].fraction!==1)
    return unsupported("Full-domain affine proof requires coincident year-end collections/distributions");
  }
 }
 if(x.wholeStateCycle.commonCash.some(c=>c.capitalReturnedUsd!==0))return unsupported("Capital returns are outside this affine proof");
 const base=evaluateGregorianRenewal(x),period=146097/365.25,r=x.discountRate;
 let slope=0;
 for(const row of base.model.rows){
  const l=x.cashLedger.years.find(l=>l.year===row.year)!;
  if(l.commonDistribution+p.priceDeltaDomain[0]*row.service<0)return unsupported("Some declared domain points require additional funding; domain not silently shortened");
 }
 for(const row of base.model.rows.slice(0,400)){
  const days=(Date.parse(`${row.year}-12-31`)-Date.parse(p.valuationOn))/86400000;
  slope+=row.service/(1+r)**(days/365.25);
 }
 slope/=-Math.expm1(-Math.log1p(r)*period);
 if(!Number.isFinite(slope))return unsupported("Nonfinite slope");
 const value=base.conditionalPeriodicProjectValueUsd;
 if(slope===0)return {...common,status:Math.abs(value-p.targetValueUsd)<=p.residualToleranceUsd?"nonidentified":"no-root",roots:[],slope};
 const root=(p.targetValueUsd-value)/slope;
 const range=p.priceDeltaDomain.map(v=>value+slope*v);
 if(range.some(v=>!Number.isFinite(v)))return unsupported("Nonfinite declared domain value");
 const candidateFor=(change:number)=>{
 const candidate=structuredClone(x);
 for(const y of candidate.specification.years){
  const row=base.model.rows.find(row=>row.year===y.year)!,delta=change*row.service;
  y.pricePerServiceUsd+=change;
  const ledger=candidate.cashLedger.years.find(l=>l.year===y.year)!;ledger.collections+=delta;ledger.commonDistribution+=delta;
  candidate.datedAccounting.accrual.entries.find(e=>e.kind==="revenue"&&e.on===`${y.year}-12-31`)!.usd+=delta;
  candidate.wholeStateCycle.commonCash.find(e=>e.on===`${y.year}-12-31`)!.distributionUsd+=delta;
 }
 candidate.wholeStateCycle.specificationHash=contentHash(candidate.specification);
 return candidate;
 };
 // Affinity establishes the interior law; endpoint execution additionally checks
 // finite machine arithmetic and all affine cash/account constraints.
 for(const endpoint of p.priceDeltaDomain){
  try{
   const actual=evaluateGregorianRenewal(candidateFor(endpoint)).conditionalPeriodicProjectValueUsd;
   if(Math.abs(actual-(value+slope*endpoint))>p.residualToleranceUsd)
    return {...common,status:"unresolved",roots:[],reason:"Declared numerical tolerance not established over the domain"};
  }catch{return unsupported("A declared domain endpoint is not executable under the same cash law");}
 }
 if(root<p.priceDeltaDomain[0]||root>p.priceDeltaDomain[1])return {...common,status:"no-root",roots:[],range,slope};
 const candidate=candidateFor(root);
 const actual=evaluateGregorianRenewal(candidate).conditionalPeriodicProjectValueUsd,residual=actual-p.targetValueUsd;
 return {...common,status:Math.abs(residual)<=p.residualToleranceUsd?"unique-supported-affine-root":"unresolved",
  roots:Math.abs(residual)<=p.residualToleranceUsd?[root]:[],range,slope,residualUsd:residual,candidateInputHash:contentHash(candidate),
  certificate:"Positive constant slope over the entire declared admissible domain; coincident AR/collection/distribution changes preserve all dated states. Nonlinear/tax/other cash laws are unsupported, not sampled as unique.",
  ownerWidthAndDualThresholdAcceptance:false};
}
