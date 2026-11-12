import {contentHash} from "./analysisManifest";
import {calculateOperatingCohorts,type CohortSpecification} from "./operatingCohorts";
import {discountedCohortPolynomial,freezePolynomialDomain,certifyPolynomialDomain,evaluateDeclaredPolynomial} from "./polynomialDomain";
export interface CohortGrowthDeck {
 projects:CohortSpecification[];baseCommissionYear:number;valuationYear:number;
 discountRate:string;targetProjectCashPvUsd:string;
 lowerOnePlusGrowth:string;upperOnePlusGrowth:string;absoluteParameterWidth:string;maxNodes:number;
 law:"proportional-replication-of-each-commissioning-cohort-cash-and-service";
 rationale:string;
}
export function freezeCohortGrowthDeck(input:CohortGrowthDeck){
 const deck:CohortGrowthDeck=JSON.parse(JSON.stringify(input));
 if(deck.law!=="proportional-replication-of-each-commissioning-cohort-cash-and-service"||
   !deck.rationale.trim()||!deck.projects.length||!Number.isInteger(deck.baseCommissionYear)||
   !Number.isInteger(deck.valuationYear))throw Error("Explicit conditional replication law and dates required");
 const ids=deck.projects.flatMap(p=>p.cohorts.map(c=>c.id));
 if(new Set(ids).size!==ids.length)throw Error("Project cohorts overlap");
 const calculations=deck.projects.map(p=>{
   if(p.liquidation)throw Error("Dated liquidation is outside this certified annual polynomial; terminal cash must not be omitted");
  if(p.cohorts.length!==1)throw Error("Per-cohort cash allocation required, no MW allocation of pooled issuer cash");
  const c=p.cohorts[0];
  if(p.years[0].year>c.commissionedYear||p.years.at(-1)!.year<c.retiredYear)
   throw Error("Complete finite construction/operation/retirement window required; no perpetual shortcut");
  return calculateOperatingCohorts(p);
 });
 const terms=calculations.flatMap((p,i)=>p.rows.map(y=>({
  power:deck.projects[i].cohorts[0].commissionedYear-deck.baseCommissionYear,
  years:y.year-deck.valuationYear,cashUsd:y.fcfe.toString()})));
 const coefficients=discountedCohortPolynomial(terms,deck.discountRate);
 const domain=freezePolynomialDomain({coefficients,target:deck.targetProjectCashPvUsd,
  lower:deck.lowerOnePlusGrowth,upper:deck.upperOnePlusGrowth,
  absoluteParameterWidth:deck.absoluteParameterWidth,maxNodes:deck.maxNodes,
  parameterMeaning:"u=1+conditional commissioning-cohort replication growth; finite project cash PV only",
  cashModelHash:contentHash({deck,calculations})});
 if(!Number.isFinite(Number(deck.lowerOnePlusGrowth))||!Number.isFinite(Number(deck.upperOnePlusGrowth))||
   Number(deck.lowerOnePlusGrowth)<0)throw Error("Finite decimal nonnegative deployment domain required");
 return {deck,calculations,domain,hash:contentHash({deck,calculations,domain})};
}
export function invertCohortGrowthDeck(frozen:ReturnType<typeof freezeCohortGrowthDeck>){
 if(frozen.hash!==contentHash({deck:frozen.deck,calculations:frozen.calculations,domain:frozen.domain}))
  throw Error("Mutated cohort/economic declaration");
 return {...certifyPolynomialDomain(frozen.domain),claim:"finite conditional project cash PV, NOT common equity or market expectations",
  sourceAuthenticated:false,ownerAccepted:false,
  limitation:"Exact declared polynomial of recorded base cash. Proportional replication is an explicit assumption, not inferred issuer economics; other controls/regimes require separate declarations."};
}
export function evaluateCohortGrowthDeck(frozen:ReturnType<typeof freezeCohortGrowthDeck>,onePlusGrowth:string){
 if(frozen.hash!==contentHash({deck:frozen.deck,calculations:frozen.calculations,domain:frozen.domain}))
  throw Error("Mutated cohort/economic declaration");
 const u=Number(onePlusGrowth);
 if(!Number.isFinite(u)||u<Number(frozen.deck.lowerOnePlusGrowth)||u>Number(frozen.deck.upperOnePlusGrowth))
  throw Error("Outside declared physical domain");
 return {pv:evaluateDeclaredPolynomial(frozen.domain.material.coefficients,onePlusGrowth),
  projects:frozen.calculations.map((p,i)=>{
   const factor=u**(frozen.deck.projects[i].cohorts[0].commissionedYear-frozen.deck.baseCommissionYear);
   return {cohortId:frozen.deck.projects[i].cohorts[0].id,serviceUnit:p.serviceUnit,
    rows:p.rows.map(y=>({year:y.year,stock:y.closing*factor,service:y.service*factor,fcfeUsd:y.fcfe*factor}))};
  }),sourceAuthenticated:false,marketImplied:false};
}
