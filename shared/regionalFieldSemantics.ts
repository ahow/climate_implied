import { FIXED_5GT_DESCRIPTOR } from "./quantityDescriptors";
import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { REGIONAL_COUNTERFACTUAL } from "./regionalCounterfactual";
const context={
  source:`calculateRegionalFromInputs; ${REGIONAL_COUNTERFACTUAL.source} Retained producer exports carry captured material manifests; ordinary exports do not establish retained input/model identity.`,
  period:"Legacy simulation 2024–2100; source intensity observation year is not supplied by this response",
  geography:"Named region's intensity substituted into a global model; NOT local/regional warming",
  status:"Unsupported legacy conditional counterfactual; not calibrated or a regional forecast",
  missingness:"Missing/nonfinite/nonpositive captured regional intensities throw; null threshold means not reached by2100",
  uncertainty:"Emissions1000 conditional draws; temperature summary separately resamples10000 draws. Neither is calibrated uncertainty",
  scope:"Current input set or explicitly captured regional snapshot; snapshot selection does not establish original-publication availability",
  asOfRule:"Explicit regional snapshot loads captured intensities without live fallback. Otherwise current regional feed/cache applies; no publication-time historical claim",
};
const fields:[string,string,OutputFieldSemantic["role"],string,string,string[]][]=[
  ["region","Regional intensity configuration key","Input","REGIONAL_CARBON_INTENSITIES entry key","identifier",["regionalConfig"]],
  ["regionName","Display name of the intensity source region","Input","REGIONAL_CARBON_INTENSITIES[region].name","label",["region","regionalConfig"]],
  ["carbonIntensity","Intensity substituted for the global model's carbon-intensity input","Input","intensities[region].value","kg CO2/GDP dollar; denominator specified by carbonIntensityBasis",["regionalIntensitySnapshot","region"]],
  ["carbonIntensitySource","Origin class of the selected intensity","Input","intensities[region].source; owid or static","source enum",["regionalIntensitySnapshot"]],
  ["carbonIntensityBasis","Explicit GDP price basis; PPP and nominal are not interchangeable","Output",
    "source==owid ? kg CO2/international-dollar GDP(PPP) : kg CO2/nominal-dollar GDP(static assumption)","basis label",["carbonIntensitySource"]],
  ["claim","Scope restriction on the counterfactual","Output",REGIONAL_COUNTERFACTUAL.claim,"claim label",[]],
  ["milestoneDefinition","Meaning and censoring rule of the legacy threshold","Output",FIXED_5GT_DESCRIPTOR.description,"definition",[]],
  ["netZeroYear",FIXED_5GT_DESCRIPTOR.label,"Output",
    "min(year where trajectory.p50<=5), otherwise null","calendar year",["trajectory.year","trajectory.p50"]],
  ["reductionRate","Ten-year compound reduction of median global counterfactual emissions","Output",
    "100*(1-(trajectory[10].p50/trajectory[0].p50)^(1/10))","percent/year",["trajectory.p50"]],
  ["temperatureRise",REGIONAL_COUNTERFACTUAL.warmingLabel,"Output",
    "sort(clamp(LEGACY_CLIMATE.warmingOffsetC + final median cumulativeEmissions*N(1,0.15)*LEGACY_CLIMATE.tcreCPerGt*N(3,0.5)/3,1,5))[5000];10000 draws;seed99*12345",
    "°C; legacy baseline/GWP not independently reconciled",["trajectory.cumulativeEmissions","LEGACY_CLIMATE","seed99*12345"]],
];
export const regionalFieldSemantics:OutputFieldSemantic[]=fields.map(([key,meaning,role,formula,unit,dependencies])=>({
  id:`regional.${key}`,meaning,role,formula,unit,dependencies,...context,
  ...(["netZeroYear","milestoneDefinition"].includes(key)?{scope:`${FIXED_5GT_DESCRIPTOR.description} ${context.scope}`}:{}),
}));
