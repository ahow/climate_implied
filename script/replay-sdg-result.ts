/** Recalculate a real archived SDG response in a fresh process. No approvals. */
import assert from "node:assert/strict";
import { loadAnalysisResult } from "../server/snapshots/results";
import { loadMaterialArchive,currentSourceArchiveId } from "../server/snapshots/materialInputs";
import { resolveSnapshot,snapshotContext } from "../server/snapshots/store";
import { loadOverlay,overlayContext } from "../server/snapshots/overlays";
import { calculateSDGGrowthDifferential } from "../server/climateValuation/sdgGrowthCalculator";
import { contentHash } from "../server/calculation/analysisManifest";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { historicalInputContext } from "../server/calculation/historicalIndicators";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { writeFileSync } from "node:fs";
const [id,out]=process.argv.slice(2);
const result=await loadAnalysisResult(id);
assert.equal(result.manifest.scenario,"descriptive-valuation:/sdg-growth");
const material=await loadMaterialArchive(String(result.manifest.settings.materialInputsId),"material-inputs");
assert.equal(currentSourceArchiveId(),material.sourceArchive,"Replay executable source/config/dependency version differs");
const header=await resolveSnapshot(material.workbook); assert.ok(header);
const overlays=await Promise.all(material.overlays.map((id:string)=>loadOverlay(id)));
const settings=result.manifest.settings;
const calculate=()=>calculateSDGGrowthDifferential(Number(settings.costOfEquity ?? .08),settings.geography as string|undefined);
const computed=await runWithOverrideRows(material.approvedValues,()=>
  historicalInputContext.run(material.effectiveHistoricalIndicators,()=>
    snapshotContext.run(header,()=>overlays.length ? overlayContext.run({
      ids:material.overlays,cutoff:material.cutoff,overlays
    },calculate) : calculate())));
const normalized=JSON.parse(JSON.stringify(publicValuationResult(computed)));
assert.equal(contentHash(normalized),contentHash(result.result));
writeFileSync(out,JSON.stringify({id,materialInputsId:settings.materialInputsId,resultHash:contentHash(normalized),
  meaning:"Fresh-process actual SDG calculator replay; not acceptance of other endpoints or original vintages"}));
console.log("PASS real SDG result recalculation",contentHash(normalized));
process.exit(0);
