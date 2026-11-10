import type { OutputFieldSemantic } from "./outputFieldSemantics";
const context={
  source:"calculateSensitivityAnalysis literal scenario configuration and selected legacy model source hash",
  period:"Selected latest input/nowcast year through2100",
  geography:"Global legacy model",
  status:"One-factor engineering sensitivity diagnostic; NOT calibrated quantiles, confidence intervals or causal effects",
  missingness:"Invalid temperature inputs throw; unavailable results are not zero effects",
  uncertainty:"2000 emissions draws per scenario; separate10000-draw median-temperature resampling. Input brackets are hand-specified, not probabilistic",
  scope:"Selected input reconstruction under current code; no original-vintage forecast claim",
  asOfRule:"Latest row of request-selected historical input context; otherwise current resolved nowcast",
};
const lower="renewableCapacityGW:.7x; renewableGrowthRate:.5x; evSalesShare:.6x; evGrowthRate:.3x; policyCoveragePercent:.6x; policyImplementationRate:.5x; sbtiCompaniesPercent:.5x; corporateImplementationRate:.5x; carbonIntensity:.8x; carbonIntensityDeclineRate:.3x; cleanEnergyInvestmentTrn:.5x; fossilFuelInvestmentTrn:.5x; greenBondIssuanceBln:.4x; fossilCO2GtPerYear:.85x; co2GrowthRatePpm:1.5";
const upper="renewableCapacityGW:1.5x; renewableGrowthRate:1.8x; evSalesShare:min(1.8x,80); evGrowthRate:2x; policyCoveragePercent:min(1.15x,100); policyImplementationRate:min(1.4x,1); sbtiCompaniesPercent:min(1.8x,100); corporateImplementationRate:min(1.2x,1); carbonIntensity:1.3x; carbonIntensityDeclineRate:2x; cleanEnergyInvestmentTrn:2x; fossilFuelInvestmentTrn:1.5x; greenBondIssuanceBln:2x; fossilCO2GtPerYear:1.1x; co2GrowthRatePpm:4";
const units="GW(capacity); percent/year(renewable/EV growth and intensity decline); percent(EV share/policy coverage/SBTi); fraction(implementation); kg CO2/USD(intensity); USD trillion(investments); USD billion(bonds); Gt CO2/year(emissions); ppm/year(CO2 growth)";
const fields:[string,string,OutputFieldSemantic["role"],string,string,string[]][]=[
  ["indicator","Engine input identifier varied alone","Input","indicatorConfigs.key","identifier",["indicatorConfigs"]],
  ["label","Human-readable varied-input label","Input","indicatorConfigs.label","label",["indicatorConfigs"]],
  ["category","Configured input category","Input","indicatorConfigs.category","category",["indicatorConfigs"]],
  ["direction","Configured expected sign, not an estimated causal effect","Input","indicatorConfigs.direction: positive for intensity/fossil investment/fossil emissions/CO2 growth; negative otherwise","sign enum",["indicatorConfigs"]],
  ["p10Value","Lower engineering input setting; legacy name does NOT mean a measured10th percentile","Input","x=baseIndicators[indicator]; "+lower,units,["baseIndicators","indicator"]],
  ["p90Value","Upper engineering input setting; legacy name does NOT mean a measured90th percentile","Input","x=baseIndicators[indicator]; "+upper,units,["baseIndicators","indicator"]],
  ["baselineTemperature","Median legacy temperature with unperturbed selected inputs","Output","trajectory=calculateEmissionsTrajectory(baseIndicators,startYear,2100,2000); getTemperatureStats(calculateTemperatureDistribution(trajectory,2000),trajectory).median","°C; legacy baseline not independently reconciled",["baseIndicators","legacyTemperatureResampling"]],
  ["p10Temperature","Smaller of the two perturbed-scenario medians; NOT an outcome10th percentile","Output","min(lowInputScenario.median,highInputScenario.median)","°C",["p10Value","p90Value","legacyTemperatureResampling"]],
  ["p90Temperature","Larger of the two perturbed-scenario medians; NOT an outcome90th percentile","Output","max(lowInputScenario.median,highInputScenario.median)","°C",["p10Value","p90Value","legacyTemperatureResampling"]],
  ["temperatureRange","Absolute difference between the two perturbed medians","Calculated","abs(highInputScenario.median-lowInputScenario.median)","°C",["p10Temperature","p90Temperature"]],
];
export const sensitivityFieldSemantics:OutputFieldSemantic[]=fields.map(([key,meaning,role,formula,unit,dependencies])=>({
  id:`sensitivity.${key}`,meaning,role,formula,unit,dependencies,...context,
}));
