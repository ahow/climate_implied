import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { nativeGasIds } from "./nativeOutputSemantics";

export const nativePathwayGasIds=nativeGasIds.filter(g=>g!=="CO2").concat(["CO2-EIP","CO2-LULUCF"]).sort();
const context={
  role:"Output" as const,dependencies:["pairSchema submitted pair","nativeInventory baseline","inventory2024.json"],
  source:"server/calculation/nativePathwayContract.ts:validateNativePair; pairSchema; nativeInventory",
  period:"Annual 2024–2100 submitted values; reported checkpoints 2030,2050,2100 and sum 2025–2100",
  geography:"Global inventory; no regional attribution",
  status:"Accounting-valid-not-scientifically-promoted; declarations and provenance links are not source verification",
  missingness:"Reject duplicate scenarios, missing/unexpected gas keys, noncontiguous years, nonfinite values, negative non-CO2 and inventory mismatch. No silent infill. Empty infilling={} means none declared, not none needed.",
  uncertainty:"Submitted deterministic values; infilling sensitivity is declared prose, not sampled uncertainty",
  scope:"Two submitted policy cases. CO2-EIP and CO2-LULUCF are separated, other gases retain native chemical species. No CO2e/temperature conversion.",
  asOfRule:"policyCutoff and revision are user declarations; not authenticated publication/availability dates",
};
const specs:[string,string,string,string][]=[
  ["status","Accounting gate only","literal accounting-valid-not-scientifically-promoted","label"],
  ["inventoryVersion","Version of inventory used by accounting validator","inventory.version","identifier"],
  ["scenarios[].scenario","Submitted distinct policy case","implemented-policies or announced-commitments; both exactly once","label"],
  ["scenarios[].source.url","Submitted source reference","p.source.url; HTTPS URL validated, retrieval not performed","URL"],
  ["scenarios[].source.revision","Submitted nonempty source revision","p.source.revision","text"],
  ["scenarios[].source.policyCutoff","Declared policy cutoff, not verified availability","p.source.policyCutoff; YYYY-MM syntax only","year-month"],
  ["scenarios[].source.includesLongTermPledges","Declared inclusion of long-term commitments","p.source.includesLongTermPledges; announced-commitments requires true","boolean"],
  ["scenarios[].source.processingStage","Declared processing stage","p.source.processingStage; raw,harmonized,infilled","label"],
  ["scenarios[].unit","Native mass-rate convention","literal Mt gas/year","unit label"],
  ["scenarios[].infilling","No gas-specific infilling declared","{} when submitted infilling absent/empty","empty map"],
];
for(const gas of nativePathwayGasIds) {
  for(const year of [2030,2050,2100]) specs.push([
    `scenarios[].annualNative.${year}.${gas}`,`${gas} submitted annual emissions in ${year}`,
    `p.gases[${JSON.stringify(gas)}][${year}-2024]; not interpolated or model-generated`,`Mt ${gas}/year`,
  ]);
  specs.push([`scenarios[].cumulative2025Through2100Mt.${gas}`,`${gas} sum of submitted annual emissions`,
    `sum(p.gases[${JSON.stringify(gas)}].slice(1)); 76 annual cells 2025..2100, excludes 2024; rectangular annual sum, not trapezoidal integration`,`Mt ${gas}`]);
  for(const [field,meaning,formula,unit] of [
    ["method","Declared infilling method","p.infilling[gas].method; min10 characters","text"],
    ["evidence","Declared infilling evidence URL","p.infilling[gas].evidence; URL syntax only","URL"],
    ["sensitivity","Declared sensitivity description","p.infilling[gas].sensitivity; min10 characters; not quantified by validator","text"],
  ]) specs.push([`scenarios[].infilling.${gas}.${field}`,`${gas}: ${meaning}`,formula,unit]);
}
export const nativePathwaySemantics:OutputFieldSemantic[]=specs.map(([field,meaning,formula,unit])=>({
  ...context,id:`nativePathway.${field}`,meaning,formula,unit,
}));
// A wildcard slot represents this exact finite domain, not one newly counted
// slot per species. Runtime pairSchema enforces inventory gas-key equality.
export const nativePathwayDynamicSlots=[
  "scenarios[].annualNative.*","scenarios[].cumulative2025Through2100Mt.*","scenarios[].infilling.*",
];
