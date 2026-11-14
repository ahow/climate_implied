import ts from "typescript";
import {readFileSync} from "node:fs";
import {contentHash} from "../server/calculation/analysisManifest";
import {evaluateGregorianRenewal} from "../server/calculation/gregorianRenewal";
import {freezeDeploymentGrowth} from "../server/calculation/deploymentGrowth";
/** Reuse the explicit test fixture without importing/registering its tests twice. */
export function transitionTransportFixture(){
 const src=readFileSync("script/deployment-transition.test.ts","utf8");
 const start=src.indexOf("export function transitionFixture"),end=src.indexOf("\ntest(",start);
 if(start<0||end<0)throw Error("Explicit synthetic transition fixture unavailable");
 const js=ts.transpile(src.slice(start,end).replace("export function","function"),{target:ts.ScriptTarget.ES2022});
 return Function("renewalTransportFixture","freezeDeploymentGrowth",`${js};return transitionFixture();`)(renewalTransportFixture,freezeDeploymentGrowth);
}
export function renewalTransportFixture(){
 const src=readFileSync("script/gregorian-renewal.test.ts","utf8"),start=src.indexOf("export function gregorianFixture"),end=src.indexOf('\ntest(',start);
 if(start<0||end<0)throw Error("Explicit synthetic fixture unavailable");
 const js=ts.transpile(src.slice(start,end).replace("export function","function"),{target:ts.ScriptTarget.ES2022});
 const r=Function("contentHash",`${js};return gregorianFixture();`)(contentHash);
 // Deliberately artificial400-year assets reduce transport size; NOT an issuer
 // lifetime or a calibration/source assumption suitable for actual deployment.
 r.specification.cohorts=r.specification.cohorts.filter((c:any)=>[2025,2425,2825].includes(c.commissionedYear));
 for(const c of r.specification.cohorts){c.retiredYear=c.commissionedYear+400;c.dated.retiredOn=`${c.retiredYear}-07-01`;}
 const replacement=(y:number)=>[2425,2825].includes(y);
 for(const y of r.specification.years)y.replacementCashUsd=replacement(y.year)?10:0;
 for(const y of r.cashLedger.years)y.commonDistribution=87.5-(replacement(y.year)?10:0);
 r.datedAccounting.timing=r.datedAccounting.timing.filter((t:any)=>t.component!=="replacement"||replacement(t.year));
 r.datedAccounting.accrual.entries=r.datedAccounting.accrual.entries.filter((e:any)=>e.component!=="replacement"||replacement(Number(e.on.slice(0,4))));
 r.replacementAccruals=r.replacementAccruals.filter((e:any)=>r.specification.cohorts.some((c:any)=>c.id===e.cohortId));
 r.wholeStateCycle.rights=r.wholeStateCycle.rights.filter((e:any)=>r.specification.cohorts.some((c:any)=>c.id===e.cohortId));
 for(const c of r.wholeStateCycle.commonCash)c.distributionUsd=87.5-(replacement(Number(c.on.slice(0,4)))?10:0);
 r.wholeStateCycle.specificationHash=contentHash(r.specification);
 const target=evaluateGregorianRenewal(r).conditionalPeriodicProjectValueUsd;
 const physical=r.specification.years.flatMap((y:any)=>r.specification.cohorts.map((c:any)=>{
  const source={hash:"a".repeat(64),locator:"SYNTHETIC transport only",publishedAt:"2025-01-01T00:00:00Z",year:y.year,
   periodStart:`${y.year}-01-01`,periodEnd:`${y.year}-12-31`,geography:"fixture",unit:"kWh-charged",kind:"conditional-assumption"};
  return {issuer:"42",unitId:c.id,year:y.year,scope:"2-location",gas:"CO2",geography:"fixture",channel:"operational",cohortId:c.id,activityChannel:"charge-energy",
   intensity:.01,intensityDenominator:"kWh-charged",intensityNumerator:"tonnes-native-gas",ownership:1,basis:"full-unit-before-ownership",
   activitySource:source,intensitySource:{...source,unit:"tonnes-CO2/kWh-charged",gas:"CO2",scope:"2-location"}};
 }));
 return {version:"company-cohort-input-1",companyId:"42",cutoff:"2026-01-01T00:00:00Z",years:r.specification.years.map((y:any)=>y.year),
  renewalFamily:{declaredSets:["synthetic-renewal","synthetic-missing"],missing:[{id:"synthetic-missing",reason:"Synthetic missing-source case; no actual issuer inference"}]},
  cells:physical.map(({issuer,unitId,year,scope,gas,geography,channel}:any)=>({issuer,unitId,year,scope,gas,geography,channel})),
  scenarios:[{id:"synthetic-renewal",specification:r.specification,physical,renewal:r,
   renewalInverse:{version:"gregorian-affine-price-inverse-1",baseInputHash:contentHash(r),claimantId:r.cashLedger.claimantId,valuationOn:"2026-01-01",
    targetKind:"conditional-project-common-cash",currency:"USD",targetValueUsd:target,priceDeltaDomain:[-1,1],residualToleranceUsd:1e-7,
    heldFixed:"all-physical-and-nonprice-inputs",taxBasis:"explicit-zero-tax-only"}}]};
}
