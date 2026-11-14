import {contentHash} from "./analysisManifest";
import {calculateOperatingCohorts,type CohortSpecification} from "./operatingCohorts";
import {reconcileDatedAccruals,type CohortCashLedger,type DatedProjectCash,type CashTiming,type AccrualSchedule} from "./cohortCashLedger";

/** Prospective physical input compiler. It does not infer a market target or
 * manufacture settlement dates, financing, or a periodic continuation. */
export interface DeploymentGrowthProtocol {
 version:"finite-owned-deployment-1";
 claim:"conditional-project-common-residual";
 quantity:"commissioned-owned-capacity";
 calendar:"UTC-civil";
 baselineQuantity:number;
 baselineOn:string;
 growthDomain:[number,number];
 specification:CohortSpecification;
 commissioning:{cohortId:string;on:string;capitalOn:string;capitalUsdPerUnit:number;maximumUnits:number;ownedFraction:1;evidenceIds:string[]}[];
 evidenceIds:string[];
 baselineBinding:{kind:"annual-commissioned-flow";unit:"MW"|"vehicle"|"kWh-storage";openingOperatingStock:number;constructionBasis:"only-declared-cohort-capital";horizon:[number,number];cutoff:string;availableAt:string;sourceId:string};
}
export function freezeDeploymentGrowth(p:DeploymentGrowthProtocol){
 const s=p.specification;
 const date=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 if(p.version!=="finite-owned-deployment-1"||p.claim!=="conditional-project-common-residual"||
  p.quantity!=="commissioned-owned-capacity"||p.calendar!=="UTC-civil"||
  s.timing!=="utc-civil-day-service"||s.liquidation||!date(p.baselineOn)||
  !Number.isFinite(p.baselineQuantity)||p.baselineQuantity<=0||
  p.growthDomain.length!==2||p.growthDomain.some(v=>!Number.isFinite(v))||
  p.growthDomain[0]<=-1||p.growthDomain[1]<p.growthDomain[0]||
  !p.evidenceIds.length||p.evidenceIds.some(id=>!s.evidenceIds.includes(id)))
  throw Error("Explicit finite deployment protocol/claim/domain required");
 const b=p.baselineBinding;
 if(!b||b.kind!=="annual-commissioned-flow"||b.openingOperatingStock!==0||
  b.constructionBasis!=="only-declared-cohort-capital"||b.horizon[0]!==s.years[0].year||
  b.horizon[1]!==s.years.at(-1)!.year||b.horizon[1]-b.horizon[0]+1!==s.years.length||
  p.commissioning.length!==s.years.length||Number(p.baselineOn.slice(0,4))!==b.horizon[0]||
  !date(b.cutoff)||!date(b.availableAt)||b.availableAt>b.cutoff||b.cutoff>p.baselineOn||
  !p.evidenceIds.includes(b.sourceId)||s.cohorts.some(c=>c.capacityUnit!==b.unit))
  throw Error("Unambiguous sourced commissioned-flow baseline, zero legacy stock and complete prospective horizon required");
 calculateOperatingCohorts(s);
 if(p.commissioning.length!==s.cohorts.length||new Set(p.commissioning.map(v=>v.cohortId)).size!==s.cohorts.length||
  new Set(p.commissioning.map(v=>v.on.slice(0,4))).size!==p.commissioning.length)
  throw Error("One declared commissioning cohort per growth year required");
 const first=Number(p.baselineOn.slice(0,4));
 const ordered=[...p.commissioning].sort((a,b)=>a.on.localeCompare(b.on));
 for(let i=0;i<ordered.length;i++){
  const c=ordered[i];
  const cohort=s.cohorts.find(v=>v.id===c.cohortId);
  if(!cohort||!date(c.on)||!date(c.capitalOn)||c.on!==cohort.dated?.commissionedOn||
   (i===0&&c.on!==p.baselineOn)||Number(c.on.slice(0,4))!==first+i||
   c.capitalOn>c.on||!s.years.some(y=>y.year===Number(c.capitalOn.slice(0,4)))||
   c.ownedFraction!==1||!Number.isFinite(c.capitalUsdPerUnit)||c.capitalUsdPerUnit<=0||
   !Number.isFinite(c.maximumUnits)||c.maximumUnits<=0||
   !c.evidenceIds.length||c.evidenceIds.some(id=>!p.evidenceIds.includes(id))||
   cohort.installedUnits!==p.baselineQuantity)
   throw Error("Explicit baseline, complete dates, full ownership and unit capital required");
 }
 for(const y of s.years){
  const declared=p.commissioning.filter(c=>Number(c.capitalOn.slice(0,4))===y.year).reduce((a,c)=>a+p.baselineQuantity*c.capitalUsdPerUnit,0);
  if(Math.abs(declared-y.constructionCashUsd)>1e-9)throw Error("Ambiguous construction baseline; undeclared capital cannot be overwritten");
 }
 return {version:p.version,definitionHash:contentHash(p),protocol:structuredClone(p)};
}
/** Executes independently supplied dated accounts against the compiled physical
 * path. Never derives collection/funding dates or silently balances an account. */
export function executeDeploymentCash(frozen:ReturnType<typeof freezeDeploymentGrowth>,growth:number,
 accounts:{definitionHash:string;growth:number;ledger:CohortCashLedger;declaration:Omit<DatedProjectCash,"events">;timing:CashTiming[];accrual:AccrualSchedule;
  interest:"explicit-zero";recovery:"none";ownership:"full-common-claim"}){
 if(accounts.definitionHash!==frozen.definitionHash||accounts.growth!==growth||
  accounts.interest!=="explicit-zero"||accounts.recovery!=="none"||accounts.ownership!=="full-common-claim")
  throw Error("Matched cash definition/growth required; interest, recovery and partial claims unsupported");
 const physical=compileDeploymentGrowth(frozen,growth);
 if(physical.specification.years.some(y=>y.interestCashUsd!==0||y.debtRaisedUsd!==0||y.debtRepaidUsd!==0||y.nonCommonCashUsd!==0))
  throw Error("Financing/interest/noncommon bridge not supported in this version");
 if(accounts.declaration.valuationOn!==frozen.protocol.baselineOn||
  accounts.accrual.version!=="dated-accrual-2")throw Error("Exact valuation date and separate accrued/paid costs required");
 const cash=reconcileDatedAccruals(physical.model,accounts.ledger,accounts.declaration,accounts.timing,accounts.accrual,physical.specification.evidenceIds);
 for(const c of physical.capitalRequirements){
  const paid=-cash.derivedEvents.filter(e=>e.component==="construction"&&e.on===c.on).reduce((a,e)=>a+e.usd,0);
  const required=physical.capitalRequirements.filter(v=>v.on===c.on).reduce((a,v)=>a+v.usd,0);
  if(Math.abs(paid-required)>1e-9)throw Error("Construction settlement does not match frozen dated capital");
 }
 return {version:"finite-deployment-cash-1",physical,cash,conditionalPeriodicProjectValueUsd:null,inverse:null,
  marketImplied:false,scientificAcceptance:false,remaining:"Full physical/financial/rights cycle join and compatible growth inverse remain unavailable"};
}
export function compileDeploymentGrowth(frozen:ReturnType<typeof freezeDeploymentGrowth>,growth:number){
 if(contentHash(frozen.protocol)!==frozen.definitionHash)throw Error("Changed pre-execution deployment protocol");
 const p=frozen.protocol;
 if(!Number.isFinite(growth)||growth<p.growthDomain[0]||growth>p.growthDomain[1])throw Error("Growth outside frozen domain");
 const s=structuredClone(p.specification),first=Number(p.baselineOn.slice(0,4));
 const capitalRequirements=p.commissioning.map(c=>{
  const exponent=Number(c.on.slice(0,4))-first,units=p.baselineQuantity*Math.pow(1+growth,exponent);
  if(!Number.isFinite(units)||units>c.maximumUnits)throw Error("Physical capacity constraint violated");
  s.cohorts.find(v=>v.id===c.cohortId)!.installedUnits=units;
  return {cohortId:c.cohortId,on:c.capitalOn,commissionedOn:c.on,units,usd:units*c.capitalUsdPerUnit,evidenceIds:c.evidenceIds};
 });
 // Construction is replaced, never added twice. Other controls remain unchanged.
 for(const y of s.years)y.constructionCashUsd=capitalRequirements.filter(c=>Number(c.on.slice(0,4))===y.year).reduce((sum,c)=>sum+c.usd,0);
 const model=calculateOperatingCohorts(s);
 return {version:p.version,definitionHash:frozen.definitionHash,growth,specification:s,model,capitalRequirements,
  formula:"commissioned quantity in year k = explicit baseline quantity × (1+g)^k; capital = quantity × declared USD/unit",
  conditionalPeriodicProjectValueUsd:null,inverse:null,marketImplied:false,scientificAcceptance:false,
  remaining:["Dated capital requirements are not payments or funding","Accrual/cash and complete transition-to-Gregorian join not yet implemented here",
   "No price-shift substitution, manufacturer shipment conversion, whole-equity terminal or market inference"]};
}
