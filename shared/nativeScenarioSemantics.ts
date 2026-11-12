import type { OutputFieldSemantic } from "./outputFieldSemantics";
// These are configuration semantics, not empirical parameter estimates.
const parameters: [string,string,string,string][] = [
  ["name","Scenario identifier","identifier","control: constant-activity-control; transition: illustrative-transition-not-calibrated; dashboard: dated-dashboard-input-diagnostic-not-a-policy-forecast"],
  ["annualActivityGrowth","Annual activity change outside the explicit electricity balance","fraction/year","0 in all three API scenarios; activity multiplier=(1+growth)^t"],
  ["residualIntensityImprovement","Residual annual intensity improvement","fraction/year","0 in API scenarios; residual multiplier=(1-improvement)^t; must lie in[0,1]"],
  ["evSalesShare","Initial EV sales mix, not fleet share","fraction","control=.04; transition=.2; dashboard=2024 evSalesSharePct/100"],
  ["evFleetShare","Initial passenger EV fleet share","fraction","rounded reference .04 in all API scenarios, not an estimated fleet history"],
  ["evLogitGrowth","Logistic sales-share trend coefficient","1/year","control/dashboard=0; transition=.06; sales(t)=s0/(s0+(1-s0)*exp(-k*t)); endpoints0 and1 remain fixed"],
  ["reversal","Explicit permission for declining adoption","boolean","false in API scenarios; negative logit growth or initial sales below fleet requires true"],
  ["fleetTurnover","Annual replacement fraction of fleet","fraction/year","1/15 scenario assumption; fleet(t)=fleet(t-1)+(sales(t-1)-fleet(t-1))*turnover"],
  ["passengerTransportFraction","Addressable passenger fraction of road emissions","fraction","diagnostic .5; applied only to codes starting1.A.3.b, not all transport"],
  ["evTailpipeReduction","Direct tailpipe displacement per electrified vehicle","fraction","diagnostic1; not well-to-wheel; baseline denominator=1-initialFleet*tailpipeReduction must be positive when passenger share>0"],
  ["fullElectricFleetDemandTWh","Annual demand for a fully electric reference passenger fleet","TWh/year","diagnostic2500; total EV load=fleet*transportActivity*fullElectricFleetDemandTWh"],
  ["renewableCapacityGW","Initial renewable nameplate stock","GW","control/transition=4443; dashboard=retained2024 capacity"],
  ["renewableAdditionsGW","Annual capacity increment","GW/year","control0; transition300; dashboard=capacity2024-capacity2023 with zero retirement; falling dashboard capacity rejects"],
  ["renewableRetirement","Annual retirement fraction of capacity","fraction/year","control/dashboard0; transition.02; capacity(t)=capacity(t-1)*(1-retirement)+additions"],
  ["capacityFactor","Annual generation/nameplate capacity ratio","fraction","diagnostic .3; renewableTWh=capacityGW*8.76*capacityFactor"],
  ["fossilGenerationTWh","Baseline fossil electricity generation","TWh/year","diagnostic18000, strictly positive; power CO2 factor=futureFossil/baselineFossil"],
  ["annualPowerDemandGrowth","Growth of non-passenger-EV electricity demand","fraction/year","0 in API scenarios; nonEV baseline demand multiplied by(1+growth)^t"],
  ["incrementalPolicyCoverage","Incremental eligible policy coverage","fraction","control/dashboard0; transition.2; NOT copied from dashboard target coverage; generic coverage excludes power, land, aviation and marine transport"],
  ["policyImplementation","Policy delivery fraction","fraction","control/dashboard0; transition.6; policy reduction=coverage*implementation*maximumAbatement*delivery"],
  ["corporateCoverage","Incremental eligible corporate coverage","fraction","control/dashboard0; transition.2; not issuer-count coverage; generic diagnostic only, excludes power, land, aviation and marine transport; no accepted central coefficient"],
  ["corporateDelivery","Corporate delivery fraction","fraction","control/dashboard0; transition.6; corporate reduction=coverage*delivery*maximumAbatement*laggedDelivery"],
  ["maximumAbatement","Maximum fraction of covered emissions reduced","fraction","control/dashboard0; transition.3; technology/policy/corporate reductions overlap by maximum, not sum"],
  ["deliveryLagYears","Delay before generic reductions begin","years","2; laggedDelivery=1-exp(-max(0,t-lag)/deliveryTimeYears)"],
  ["deliveryTimeYears","Exponential delivery time constant, not completion date","years","15; must be strictly positive; one time constant delivers1-exp(-1)"],
  ["nuclearGenerationTWh","Other low-carbon generation, separate from renewables","TWh/year","optional; absent=>0; utilized nuclear=min(nuclear,demand), before renewable utilization"],
];
const measures: [string,string,string,string][] = [
  ["id","Unique scoped measure identifier","identifier","nonempty and unique within scenario"],
  ["mechanism","Declared measure mechanism","enum","policy | corporate | process"],
   ["sectorCodes[]","Exactly eligible inventory sector codes","sector code","nonempty array; exact includes(cell.sector), no prefix matching; power rejected; signed land sinks require a flux-specific mechanism and reject fractional abatement"],
  ["gases[]","Exactly eligible native gas species","gas identifier","nonempty array; exact includes(cell.gas), not CO2e aggregate"],
  ["coverage","Eligible emissions fraction covered","fraction","bounded[0,1]"],
  ["implementation","Delivered fraction of scoped measure","fraction","bounded[0,1]"],
  ["maximumReduction","Maximum reduction within covered scope","fraction","bounded[0,1]"],
  ["startYear","First possible delivery year","calendar year","delivery fraction=1-exp(-max(0,year-startYear)/deliveryYears)"],
  ["deliveryYears","Exponential delivery time constant","years","strictly positive; scoped reduction=coverage*implementation*maximumReduction*delivery fraction"],
  ["evidence","User-supplied evidence reference","text","nonempty text required; existence/authenticity is not established by this validation"],
];
function definition(prefix:string,key:string,meaning:string,unit:string,formula:string):OutputFieldSemantic {
  return {
    id:`native.${prefix}.${key}`,meaning,unit,formula,role:"Input",
    dependencies:prefix==="inputs.diagnostic" && key==="renewableCapacityGW"?["historical[2024].renewableCapacityGW"]:
      prefix==="inputs.diagnostic" && key==="renewableAdditionsGW"?["historical[2024].renewableCapacityGW","historical[2023].renewableCapacityGW"]:
      prefix==="inputs.diagnostic" && key==="evSalesShare"?["historical[2024].evSalesSharePct"]:
      [`${prefix==="inputs.diagnostic"?"constantScenario":"query.scenario-selected configuration"}.${key}`],
    source:"Versioned native-emissions candidate configuration; retained2023/2024 rows only for dashboard capacity/net additions/sales mix",
    period:"Initial2024 state; annual conditional simulation through requested endYear (API2100)",
    geography:"Global inventory; no regional observation or ensemble member identifier in this endpoint",
    status:"Diagnostic assumption, not calibrated/approved central forecast; failed EV fits are not promoted",
    missingness:"Required finite scalars reject when absent; optional nuclear=>0, sector pathways/measures absent=>none. No probability imputation",
    uncertainty:"Deterministic scenario coefficient; no sampling distribution or calibrated interval",
    scope:prefix==="inputs.diagnostic"?"Dashboard input diagnostic, even when result selects another scenario":"Selected control/transition/dashboard scenario",
    asOfRule:"Retained2023/2024 observations are not original publication vintages; source hashes identify content only",
  };
}
export const nativeScenarioSemantics:OutputFieldSemantic[]=["inputs.diagnostic","result.scenario"].flatMap(prefix=>[
  ...parameters.map(([key,meaning,unit,formula])=>definition(prefix,key,meaning,unit,formula)),
  ...measures.map(([key,meaning,unit,formula])=>definition(prefix,`measures[].${key}`,meaning,unit,
    `${formula}; optional measures absent in current API scenarios; eligible reductions combine by maximum, never sum`)),
  ...["power","transport","industry","buildings","agriculture","other","land"].flatMap(sector=>[
    ["annualActivityGrowth","Annual sector activity trend","fraction/year","sectorActivity=((1+activityGrowth)*(1-intensityImprovement))^min(t,trendEndYear-2024)"],
    ["residualIntensityImprovement","Annual residual sector intensity change","fraction/year","bounded[0,1]; combined multiplicatively with sector activity, not an additional additive abatement"],
    ["trendEndYear","Explicit end of sector trend","calendar year","integer2024..2100; trend freezes after this year, independently of output horizon"],
  ].map(([key,meaning,unit,formula])=>definition(prefix,`sectorPathways.${sector}.${key}`,`${sector}: ${meaning}`,unit,
    sector==="power"?"Power sector pathways are rejected; electricity balance must determine power activity":`${formula}; optional sector pathway absent in current API scenarios`))),
]);
