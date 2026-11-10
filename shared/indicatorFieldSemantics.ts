import type { OutputFieldSemantic } from "./outputFieldSemantics";

// These describe the retained-series endpoint, not the original publishers'
// estimators. Bounds below document existing engineering clamps, not priors.
export const indicatorFieldSpecs = [
  ["renewableCapacityGW","Installed renewable electricity capacity","GW","IRENA",0,50000],
  ["renewableGrowthRate","Annual renewable capacity growth","fraction/year","Derived IRENA series",0,0.5],
  ["evSalesSharePct","Electric vehicles as a share of new car sales","percent","IEA",0,100],
  ["evGrowthRate","Annual relative growth of EV new-car sales share, not growth of the vehicle fleet","fraction/year","Derived IEA sales-share series",-0.5,2],
  ["policyCoveragePct","Global emissions covered by announced national net-zero targets","percent","Climate Action Tracker",0,100],
  ["policyImplementationRate","Share of announced targets enshrined in law or policy; not measured delivery","fraction","Climate Action Tracker",0,1],
  ["gdpTrillionUSD","World nominal gross domestic product","USD trillion","World Bank",0,500],
  ["carbonIntensityKgPerGDP","Fossil CO2 intensity of nominal GDP; not PPP intensity","kg CO2/USD","Retained CO2/GDP series",0.05,1],
  ["climateConcernPct","Respondents expressing serious climate concern","percent","Gallup",0,100],
  ["policySupportPct","Respondents supporting government climate action","percent","Pew Research",0,100],
  ["sacrificeWillingnessPct","Respondents willing to make lifestyle sacrifices","percent","Pew/UN survey references",0,100],
  ["humanCausationPct","Respondents attributing climate change mostly to human activity","percent","Survey reference",0,100],
  ["corporateTargetsPct","Retained estimate of large/listed companies with SBTi targets; denominator not independently verified","percent","SBTi",0,100],
  ["corporateImplementationRate","Estimated share of target-setting companies on track; not verified realised abatement","fraction","SBTi estimate",0,1],
  ["cleanEnergyInvestmentTrn","Annual clean-energy investment","USD trillion","IEA",0,20],
  ["fossilFuelInvestmentTrn","Annual fossil-fuel supply investment","USD trillion","IEA",0,10],
  ["greenBondIssuanceBln","Annual labelled green-bond issuance","USD billion","Climate Bonds Initiative",0,5000],
  ["fossilDivestmentTrn","Cumulative assets under management committed to divestment; not realised withdrawn capital","USD trillion","Stand.earth",0,200],
  ["fossilCO2GtPerYear","Annual fossil CO2 emissions; not all-gas CO2-equivalent emissions","Gt CO2/year","Global Carbon Project",20,60],
  ["atmosphericCO2ppm","Atmospheric CO2 concentration at Mauna Loa","ppm","NOAA Mauna Loa",350,600],
  ["co2GrowthRatePpm","Annual CO2 concentration growth at Mauna Loa","ppm/year","NOAA Mauna Loa",0,10],
  ["remainingBudget15C_Gt","Retained remaining 1.5°C CO2 budget diagnostic; not a newly assessed probabilistic budget","Gt CO2","Retained IPCC-minus-emissions estimate",0,1000],
] as const;

const context = {
  period:"Row.year is the reference year; isNowcast distinguishes extrapolated rows, not vintage-verified observations",
  status:"Curated input or conditional nowcast; not independently calibrated or original-vintage verified",
  missingness:"Endpoint uses retained resolved table cells. Future approved cell override takes precedence. No new imputation is introduced by this metadata",
  uncertainty:"No calibrated interval on retained input or nowcast; engineering clamps are not credible intervals or saturation priors",
  scope:"Current resolved series or request-isolated historical snapshot; historical reconstruction is not issuance-time forecasting",
  asOfRule:"Historical request context wins; otherwise approved overrides resolve retained cells. Horizon=max(server calendar year,last override year). Source publication timestamps remain unknown",
};

export const indicatorFieldSemantics:OutputFieldSemantic[]=[
  ...indicatorFieldSpecs.map(([key,meaning,unit,publisher,lo,hi])=>({
    id:`indicator.${key}`,meaning,role:"Input" as const,unit,...context,
    formula:`Resolved retained row[year].${key}; approved override[${key},year] if present. Otherwise future row: round(clamp(last + sum(y=1..h, OLS_slope(last 3 resolved annual ${key} values)*0.5^y), ${lo}, ${hi})*1000)/1000`,
    dependencies:[`retainedSeries.${key}`,`approvedOverrides.${key}`,"year","lastResolvedYear","requestHistoricalContext"],
    source:`${publisher} reference in ingestion registry; retained source/model hashes identify the selected material archive, not original publication evidence`,
    geography:/climateConcern|policySupport|sacrifice|humanCausation/.test(key)
      ?"Surveyed populations; country coverage/weighting not independently verified"
      :/atmosphericCO2|co2Growth/.test(key)?"Mauna Loa observatory"
      :/corporate/.test(key)?"Retained corporate reporting universe; population denominator unverified":"Global aggregate",
  })),
  {id:"indicator.year",meaning:"Reference calendar year of the retained or extrapolated input row",role:"Input",
    formula:"Retained row.year; future integer years from lastResolvedYear+1 through max(server year,last override year)",
    dependencies:["retainedSeries.year","serverYear","overrideYears"],unit:"calendar year",source:"Resolved historical indicator series",
    geography:"Varies by indicator",...context},
  {id:"indicator.isNowcast",meaning:"Whether the row was extended beyond the retained series; false does not certify observed or original-vintage data",
    role:"Calculated",formula:"false for resolved retained rows; true for appended future rows, including rows with some approved cell overrides",
    dependencies:["year","lastResolvedYear"],unit:"boolean",source:"getAllHistoricalIndicatorsWithNowcast",
    geography:"Varies by indicator",...context},
];
