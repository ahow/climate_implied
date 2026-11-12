import test from "node:test";
import assert from "node:assert/strict";
import {calculateCleanManufacturing,freezeManufacturingDomain,invertManufacturingDomain,type ManufacturingCandidate} from "../server/calculation/cleanManufacturingMap";
import {calculateCoveredPhysicalPaths,type PhysicalCell} from "../server/calculation/coveredPhysicalPaths";
import {contentHash} from "../server/calculation/analysisManifest";
function fixture():ManufacturingCandidate {
 const accounting={symbol:"TEST",cik:"0000000001",security:"Engineering only",currency:"USD",
  referenceDate:"2026-11-10",frozenAt:"2026-11-10T12:00:00.000Z",firstYear:2027,baseFcfe:40,
  boundary:"whole-issuer-common-equity",unresolvedAccountingClaims:[],
  evidence:[{id:"fixture",kind:"frozen-analyst-assumption",rationale:"Engineering-only hand accounting",availableAt:"2026-11-10T12:00:00.000Z",sha256:"a".repeat(64)}],
  discountRate:.08,terminalGrowth:.03,continuationGrowthAtYear5:.03,terminalEvidenceIds:["fixture"],
  stub:{cashBasis:"FCFE-whole-issuer-common-equity",currency:"USD",throughDate:"2026-12-31",
   rationale:"Explicit zero stub, engineering only",completenessEvidenceIds:["fixture"],cashFlows:[]},
  years:Array.from({length:5},(_,i)=>({year:2027+i,cashFlowDate:`${2027+i}-12-31`,evidenceIds:["fixture"],
   nonClimateRevenue:0,climateRevenue:100,operatingMarginBeforeClimateCostsAndCredits:.3,climateOperatingCost:0,
   recognizedPolicyCredit:0,cashPolicyCredit:0,depreciation:10,otherNonCash:0,openingReceivables:0,closingReceivables:0,
   increaseOtherOperatingWorkingCapital:0,interestPaid:0,cashTax:5,otherOperatingCash:0,capitalSpend:10,debtProceeds:0,debtRepayments:0,nonCommonCashClaims:0}))};
 return {id:"a",product:"solar-module-W-shipped",costBasis:"cash-costs-exclude-depreciation-separate-climate-costs-and-policy-credits",accounting,
  production:Array.from({length:5},(_,i)=>({year:2027+i,units:1e9,capacityUnits:2e9,realizedPriceUsdPerUnit:.1,
    cashVariableCostUsdPerUnit:.04,fixedOperatingCostUsdMillion:10,capitalUsdPerUnit:.01,fixedCapitalUsdMillion:0,evidenceIds:["fixture"]}))};
}
test("manufacturing rebuild reuses original accounting without depreciation/capex double deduction",()=>{
 const r=calculateCleanManufacturing(fixture());assert.equal(r.ledger.years[0].revenue,100);
 assert.equal(r.ledger.years[0].operatingProfit,40);assert.equal(r.ledger.years[0].fcfe,35);
 assert.equal(r.claims.installedGeneration,false);assert.equal(r.claims.marketImplied,false);
 assert.ok(Number.isFinite(r.valuation.forwardWholeEquity));
});
test("predeclared candidate domain preserves every no-root, invalid and multiple branch",()=>{
 const a=fixture(),b=structuredClone(a);b.id="b";
 const target=calculateCleanManufacturing(a).valuation.forwardWholeEquity;
 assert.equal(invertManufacturingDomain(freezeManufacturingDomain([a,b],target,0)).status,"multiple-declared-candidate-roots");
 assert.equal(invertManufacturingDomain(freezeManufacturingDomain([a],target*2,0)).status,"no-declared-candidate-root");
 b.production[0].units=3e9;
 const r=invertManufacturingDomain(freezeManufacturingDomain([a,b],target,0));
 assert.equal(r.status,"incomplete-domain");assert.equal(r.outcomes.length,2);
 const freeze=freezeManufacturingDomain([a],target,0);freeze.material.targetUsdMillion++;
 assert.throws(()=>invertManufacturingDomain(freeze),/Corrupt/);
});
test("actual manufacturing calculator result supplies exact physical activity, not growth or avoided emissions",()=>{
 const result=calculateCleanManufacturing(fixture()),parent=contentHash(result);
 const common={hash:"a".repeat(64),locator:"Explicit engineering-only conditional source",
   publishedAt:"2026-11-10T12:00:00Z",year:2027,periodStart:"2027-01-01",periodEnd:"2027-12-31",geography:"fixture",kind:"conditional-assumption" as const};
 const cell:PhysicalCell={issuer:"TEST",unitId:"factory",year:2027,geography:"fixture",scope:"1",gas:"CO2",
   activity:result.activity[0].units,activityUnit:"module-W-shipped",intensity:1e-7,
   intensityNumerator:"tonnes-native-gas",intensityDenominator:"module-W-shipped",ownership:1,
   basis:"full-unit-before-ownership",channel:"operational",parentResultHash:parent,parentActivityPointer:"/activity/0/units",parentYearPointer:"/activity/0/year",parentUnitPointer:"/product",
   activitySource:{...common,unit:"module-W-shipped"},
   intensitySource:{...common,unit:"tonnes-CO2/module-W-shipped",gas:"CO2",scope:"1"}};
 const input={cutoff:"2026-11-12T00:00:00Z",population:["TEST"],years:[2027],cells:[cell],
   parents:[{hash:parent,payload:result}],scenarios:[{id:"engineering",assumptions:{source:"synthetic, not physical acceptance"},cells:[cell]}]};
 const path=calculateCoveredPhysicalPaths(input);
 assert.equal(path.scenarios[0].rows![0].emissionsTonnes,100);
 cell.activity=101;
 assert.equal(calculateCoveredPhysicalPaths(input).scenarios[0].status,"unavailable");
});
