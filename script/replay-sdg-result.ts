/** Recalculate supported real archived CV responses in a fresh process. No approvals.
 * Historical filename retained so prior evidence commands remain runnable. */
import assert from "node:assert/strict";
import { loadAnalysisResult } from "../server/snapshots/results";
import { loadMaterialArchive,currentSourceArchiveId } from "../server/snapshots/materialInputs";
import { resolveSnapshot,snapshotContext } from "../server/snapshots/store";
import { loadOverlay,overlayContext } from "../server/snapshots/overlays";
import { calculateSDGGrowthDifferential } from "../server/climateValuation/sdgGrowthCalculator";
import { computeTercilesOnTheFly } from "../server/climateValuation/tercileCalculator";
import { calculateDecarbBands } from "../server/climateValuation/decarbBandCalculator";
import { calculateDecarbTerciles } from "../server/climateValuation/decarbTercileCalculator";
import { calculateDecarbGapSummary,calculateDecarbGapTimeSeries } from "../server/climateValuation/decarbGapCalculator";
import { calculateTotalBasedCarbonPrice } from "../server/climateValuation/carbonPriceCalculator";
import { calculateBacktest } from "../server/climateValuation/walkForwardBacktest";
import { loadCompaniesAndTimeSeries } from "../server/climateValuation/sharedUtils";
import { carryForwardEmissions,computeImputationStats } from "../server/climateValuation/emissionsCarryForward";
import { contentHash } from "../server/calculation/analysisManifest";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { historicalInputContext } from "../server/calculation/historicalIndicators";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export const replayPaths=["/sdg-growth","/pe-comparison","/decarb-bands","/decarb-terciles",
  "/decarb-gap/summary","/decarb-gap/timeseries","/carbon-price","/backtest","/summary"] as const;
export async function calculateSelectedResult(path:string,settings:Record<string,any>,header:{id:string}) {
  const rate=Number(settings.costOfEquity ?? .08), geography=settings.geography as string|undefined;
  if(path==="/sdg-growth") return calculateSDGGrowthDifferential(rate,geography);
  if(path==="/pe-comparison") return computeTercilesOnTheFly(settings.method as "absolute"|"sector_relative",settings.includeScope3==="true");
  if(path==="/decarb-bands") return calculateDecarbBands();
  if(path==="/decarb-terciles") return calculateDecarbTerciles((settings.method ?? "sector_relative") as any,rate,geography);
  if(path==="/decarb-gap/summary") return calculateDecarbGapSummary(0,(settings.method ?? "sector_relative") as any,rate,geography);
  if(path==="/decarb-gap/timeseries") return calculateDecarbGapTimeSeries(0,(settings.method ?? "sector_relative") as any,rate,geography);
  if(path==="/carbon-price") {
    const rows=await calculateTotalBasedCarbonPrice(0,settings.method as any,settings.includeScope3==="true",
      settings.winsorize!=="false",Number(settings.winsorizePercentile ?? 5),
      (settings.inferenceMethod ?? "carbon_intensity") as any,geography);
    return rows.sort((a,b)=>a.date.getTime()-b.date.getTime());
  }
  if(path==="/backtest") {
    const signal=(settings.signal ?? "carbon_intensity") as any;
    const output=await calculateBacktest(signal,Number(settings.trackingError ?? 2),
      String(settings.method ?? (signal==="decarb_gap"?"sector_relative":"absolute")),geography,Number(settings.costBps ?? 10));
    return settings.format==="series" ? output.series : output;
  }
  if(path==="/summary") {
    const {companies,timeSeries}=await loadCompaniesAndTimeSeries(false);
    let minDate:Date|null=null,maxDate:Date|null=null;
    for(const row of timeSeries) {
      if(!minDate||row.date<minDate) minDate=row.date;
      if(!maxDate||row.date>maxDate) maxDate=row.date;
    }
    return {companiesCount:companies.length,latestUpload:null,snapshotId:header!.id,
      dateRange:{minDate,maxDate,recordCount:timeSeries.length},
      sectors:new Set(companies.map(c=>c.sector).filter(Boolean)).size,
      geographies:new Set(companies.map(c=>c.geography).filter(Boolean)).size,
      imputation:computeImputationStats(carryForwardEmissions(timeSeries))};
  }
  throw new Error(`Executable replay not implemented for ${path}; never substitute another calculation`);
}
async function main() {
const [id,out]=process.argv.slice(2);
const result=await loadAnalysisResult(id);
const path=result.manifest.scenario.replace("descriptive-valuation:","");
const material=await loadMaterialArchive(String(result.manifest.settings.materialInputsId),"material-inputs");
assert.equal(currentSourceArchiveId(),material.sourceArchive,"Replay executable source/config/dependency version differs");
const header=await resolveSnapshot(material.workbook); assert.ok(header);
const overlays=await Promise.all(material.overlays.map((id:string)=>loadOverlay(id)));
const settings=result.manifest.settings;
const calculate=()=>calculateSelectedResult(path,settings,header);
const computed=await runWithOverrideRows(material.approvedValues,()=>
  historicalInputContext.run(material.effectiveHistoricalIndicators,()=>
    snapshotContext.run(header,()=>overlays.length ? overlayContext.run({
      ids:material.overlays,cutoff:material.cutoff,overlays
    },calculate) : calculate())));
const normalized=JSON.parse(JSON.stringify(publicValuationResult(computed,path.startsWith("/decarb-gap"))));
assert.equal(contentHash(normalized),contentHash(result.result));
writeFileSync(out,JSON.stringify({id,materialInputsId:settings.materialInputsId,resultHash:contentHash(normalized),
  path,meaning:"Fresh-process actual selected calculator replay; not acceptance of untested endpoints or original vintages"}));
console.log("PASS real result recalculation",path,contentHash(normalized));
process.exit(0);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href)
  main().catch(error=>{console.error(error);process.exit(1);});
