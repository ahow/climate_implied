import { FIXED_5GT_DESCRIPTOR } from "./quantityDescriptors";
import type { OutputFieldSemantic } from "./outputFieldSemantics";
const common={
  source:"/api/projection; legacyContext, forwardProjection and historicalTrajectoryMetrics; source/config hashes identify retained code, not scientific validation",
  period:"Selected latest input/nowcast reference year through2100",
  geography:"Global",
  status:"Legacy conditional diagnostic; not calibrated, native-gas coherent or validated forecasting",
  missingness:"Null metadata is unknown, not zero; null threshold is right-censored at2100. Invalid temperature inputs throw",
  uncertainty:"Conditional seeded legacy draws. Temperature resamples median cumulative emissions, not coherent member trajectories; intervals are not calibrated",
  scope:"Current inputs or selected-input reconstruction with current executable; not an originally issued historical forecast",
  asOfRule:"Request-selected approved input context and historical rows; publication availability and common observation date remain unknown",
};
type Spec=[string,string,OutputFieldSemantic["role"],string,string,string[]];
const metadata:Spec[]=[
  ["calculation.contractVersion","Response calculation-contract version","Input","version","CALCULATION_VERSION",["shared/calculationContract.ts"]],
  ["calculation.engine","Active engine identifier","Input","enum","legacy-physical",["legacyContext"]],
  ["calculation.assumptionVersion","Legacy physical assumptions version","Input","version","LEGACY_CLIMATE.version",["LEGACY_CLIMATE"]],
  ["calculation.observationYear","Common observed year is not established for mixed inputs","Input","calendar year or null","null",[]],
  ["calculation.forecastStartYear","First simulated year","Input","calendar year","latest resolved input row.year, else server calendar year",["resolvedInputs.year"]],
  ["calculation.informationAvailableAt","Original public availability is not established","Input","timestamp or null","null",[]],
  ["calculation.endYear","Simulation endpoint","Input","calendar year","2100",["LEGACY_CLIMATE.endYear"]],
  ["calculation.scenario","Requested category intervention or all","Input","category identifier","query.category || all",["query.category"]],
  ["calculation.seed","Emissions random seed","Input","integer","forecastStartYear*12345",["calculation.forecastStartYear"]],
  ["calculation.rngVersion","Seeded RNG implementation version","Input","version","RNG_VERSION",["shared/calculationContract.ts"]],
  ["calculation.inputHash","Hash of effective inputs and projection settings","Calculated","content identifier","calculationKey(effective-projection,indicators,{startYear,endYear:2100,runs:10000,category})",["indicators","calculation.forecastStartYear","calculation.scenario"]],
  ["calculation.inputRevision","Request input revision used by the cache","Input","content identifier","res.locals.calculationRevision",["request-selected approved input revision"]],
  ["calculation.runs","Emissions ensemble member count","Input","members","10000",[]],
  ["calculation.seeds.emissions","Emissions stream seed","Input","integer","forecastStartYear*12345",["calculation.forecastStartYear"]],
  ["calculation.seeds.temperaturePdf","Temperature-density stream seed","Input","integer","42*12345",[]],
  ["calculation.seeds.temperatureSummary","Separate temperature-summary stream seed","Input","integer","99*12345",[]],
  ["calculation.units.emissions","Unreconciled legacy reporting basis","Input","unit label","GtCO2e-legacy-unreconciled",[]],
  ["calculation.units.nativeGasInputs","This legacy engine does not use native-gas inputs","Input","status label","not-yet-implemented",[]],
  ["calculation.units.gwpBasis","No verified GWP basis for legacy aggregate","Input","basis label","unspecified-legacy",[]],
  ["calculation.units.gdpPriceBasis","No reconciled GDP basis in legacy contract","Input","basis label","unverified",[]],
  ["calculation.units.currency","Currency metadata is not established","Input","currency or null","null",[]],
  ["calculation.units.currencyScale","Currency scale metadata is not established","Input","scale or null","null",[]],
  ["calculation.uncertainty","Qualification of the reported distribution","Output","claim label","conditional-legacy-not-validated",[]],
  ["calculation.validation","Validation status","Output","claim label","characterization-only",[]],
  ["calculation.warnings[]","Limitations attached to every global projection","Output","warning text",
    "Literal warnings: retained legacy assumptions; median-only temperature propagation; unresolved observation/availability dates, GWP, GDP basis and currency",[]],
];
// Exact pre-category input mappings; x denotes the latest resolved input row.
const inputSpecs:[string,string,string,string][]=[
  ["renewableCapacityGW","Renewable electricity capacity","GW","x.renewableCapacityGW; technology scenario=5000"],
  ["renewableGrowthRate","Annual renewable-capacity growth in percentage units","percent/year","100*x.renewableGrowthRate"],
  ["renewableAcceleration","Legacy renewable acceleration assumption","multiplier","1"],
  ["evSalesShare","EV share of new-car sales, not fleet share","percent","x.evSalesSharePct; technology scenario=50"],
  ["evGrowthRate","Annual relative EV sales-share growth","percent/year","100*x.evGrowthRate"],
  ["policyCoveragePercent","Announced national target coverage","percent","x.policyCoveragePct; policy scenario=100; socioeconomic scenario=1.3*x.policyCoveragePct"],
  ["policyImplementationRate","Legal/policy implementation proxy, not realised delivery","fraction","x.policyImplementationRate; policy scenario=1; socioeconomic scenario=1.3*x.policyImplementationRate"],
  ["netZeroTargetsCoverage","Legacy target-coverage scaling, not an independent observation","percent","0.9*x.policyCoveragePct"],
  ["globalGDP","Nominal world GDP input","USD trillion","x.gdpTrillionUSD"],
  ["carbonIntensity","Fossil CO2/nominal GDP input","kg CO2/USD","x.carbonIntensityKgPerGDP; socioeconomic scenario=0.85*x.carbonIntensityKgPerGDP"],
  ["carbonIntensityDeclineRate","Historical intensity-decline CAGR; not a held-out forecast","percent/year","max(0,100*(1-(lastIntensity/firstIntensity)^(1/(lastYear-firstYear)))); all retained historical rows, excluding nowcast; fallback2 if fewer than2 rows or nonpositive endpoint/year span"],
  ["sbtiCompaniesPercent","Retained corporate target coverage estimate","percent","x.corporateTargetsPct; corporate scenario=80"],
  ["corporateImplementationRate","Retained corporate on-track estimate","fraction","x.corporateImplementationRate; corporate scenario=1; socioeconomic scenario=1.2*x.corporateImplementationRate"],
  ["cleanEnergyInvestmentTrn","Annual clean-energy investment","USD trillion","x.cleanEnergyInvestmentTrn ?? 2; financial scenario multiplies resolved value by2.5"],
  ["fossilFuelInvestmentTrn","Annual fossil-fuel investment","USD trillion","x.fossilFuelInvestmentTrn ?? 1; financial scenario multiplies resolved value by0.3"],
  ["greenBondIssuanceBln","Annual labelled green-bond issuance","USD billion","x.greenBondIssuanceBln ?? 700; financial scenario multiplies resolved value by3"],
  ["fossilCO2GtPerYear","Annual fossil CO2 emissions input","Gt CO2/year","x.fossilCO2GtPerYear ?? 37.6; emissions scenario multiplies resolved value by0.85"],
  ["atmosphericCO2ppm","Mauna Loa atmospheric concentration input","ppm","x.atmosphericCO2ppm ?? 424.6"],
  ["co2GrowthRatePpm","Mauna Loa annual concentration growth","ppm/year","x.co2GrowthRatePpm ?? 3.53; emissions scenario=1.5"],
];
const trajectory:Spec[]=[
  ["emissionsTrajectory[].year","Simulated calendar year","Input","calendar year","forecastStartYear+yearOffset",["calculation.forecastStartYear"]],
  ["emissionsTrajectory[].emissions","Median annual member emissions; alias of p50","Output","GtCO2e/year; GWP unreconciled","sortAsc(memberEmissions[year])[floor(N/2)]",["legacy emissions member simulations"]],
  ...([["p10",.1],["p25",.25],["p50",.5],["p75",.75],["p90",.9]] as const).map(([q,p]):Spec=>[
    `emissionsTrajectory[].${q}`,`Conditional annual emissions ${q}; not calibrated coverage`,"Output","GtCO2e/year; GWP unreconciled",
    `sortAsc(memberEmissions[year])[floor(N*${p})]`,["legacy emissions member simulations"]]),
  ["emissionsTrajectory[].cumulativeEmissions","Median of member cumulative emissions, not the sum of annual medians","Output","GtCO2e; GWP unreconciled",
    "sortAsc(members.map(m=>sum(m.annualEmissions from start through this year)))[floor(N/2)]",["legacy emissions member simulations"]],
];
const temperature="Each draw samples ecs=N(3,0.5), then cu=N(1,0.15); T=clamp(1.1+finalMedianCumulativeEmissions*cu*0.00045*ecs/3,1,5); summary N=10000,seed99*12345; PDF N=10000,seed42*12345";
const summaries:Spec[]=[
  ...([["median",.5],["p10",.1],["p90",.9]] as const).map(([q,p]):Spec=>[
    `temperatureDistribution.${q}`,`Legacy conditional temperature ${q}`,"Output","°C; legacy baseline/GWP unreconciled",
    `${temperature}; sortAsc(T)[floor(N*${p})]`,["emissionsTrajectory[].cumulativeEmissions","LEGACY_CLIMATE","calculation.seeds.temperatureSummary"]]),
  ["temperatureDistribution.mean","Mean of clipped legacy temperature draws","Output","°C",`${temperature}; sum(T)/N`,["emissionsTrajectory[].cumulativeEmissions","calculation.seeds.temperatureSummary"]],
  ["temperatureDistribution.pdf[].temperature","Temperature evaluation grid","Input","°C","round(1+0.05*k,2) for grid points through5",[]],
  ["temperatureDistribution.pdf[].probability","Gaussian-kernel density, NOT probability mass at a point","Output","1/°C",
    `${temperature}; round(sum(exp(-0.5*((grid-T)/0.1)^2))/(N*0.1*sqrt(2*pi)),6)`,["temperatureDistribution.pdf[].temperature","calculation.seeds.temperaturePdf"]],
  ["temperatureDistribution.pdf[].cumulativeProbability","Empirical fraction of draws at or below the grid point","Output","fraction",
    `${temperature}; round(count(T<=grid)/N,4)`,["temperatureDistribution.pdf[].temperature","calculation.seeds.temperaturePdf"]],
  ["metrics.reductionRate","Ten-year compound reduction of annual median emissions","Output","percent/year","100*(1-(trajectory[10].p50/trajectory[0].p50)^(1/10))",["emissionsTrajectory[].p50"]],
  ["metrics.temperatureRise","Alias of legacy median temperature","Output","°C","temperatureDistribution.median",["temperatureDistribution.median"]],
  ["metrics.netZeroYear",FIXED_5GT_DESCRIPTOR.label,"Output","calendar year or null","first year with trajectory.p50<=5, else null",["emissionsTrajectory[].year","emissionsTrajectory[].p50"]],
  ["metrics.emissionsStart","First simulated annual median emissions","Output","GtCO2e/year","trajectory[0].p50",["emissionsTrajectory[].p50"]],
  ["metrics.emissionsDecadeLater","Annual median emissions ten years after start","Output","GtCO2e/year","trajectory[10].p50",["emissionsTrajectory[].p50"]],
  ["metrics.emissions2100","Final simulated annual median emissions","Output","GtCO2e/year","trajectory[last].p50",["emissionsTrajectory[].p50"]],
];
export const projectionFieldSemantics:OutputFieldSemantic[]=[
  ...metadata,
  ...inputSpecs.map(([key,meaning,unit,formula]):Spec=>[`indicators.${key}`,meaning,"Input",unit,formula,["latest resolved input row","calculation.scenario"]]),
  ...trajectory,...summaries,
].map(([key,meaning,role,unit,formula,dependencies])=>({id:`projection.${key}`,meaning,role,unit,formula,dependencies,...common,
  ...(key==="metrics.netZeroYear"?{scope:`${FIXED_5GT_DESCRIPTOR.description} ${common.scope}`}:{})}));
