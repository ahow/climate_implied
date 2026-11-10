/** Actual retained development workbook + private synthetic overlays.
 * No approvals, public-table writes or immutable synthetic DB archives. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { contentHash, createManifest,canonicalJson } from "../server/calculation/analysisManifest";
import { applyOverlays, packOverlay, unpackOverlay } from "../server/snapshots/overlayContract";
import { packAnalysisResult, unpackAnalysisResult } from "../server/snapshots/resultContract";
import { packDataset, unpackDataset } from "../server/snapshots/contract";
import * as XLSX from "xlsx";
import { exportDataIdentity } from "../client/src/lib/export-identity";
import { calculateSelectedResult,replayPaths } from "./replay-sdg-result";
import { snapshotContext,resolveSnapshot } from "../server/snapshots/store";
import { overlayContext } from "../server/snapshots/overlays";
import { currentSourceArchiveId } from "../server/snapshots/materialInputs";
import { runWithOverrideRows } from "../server/dataIngestion/requestOverrides";
import { getAllHistoricalIndicatorsWithNowcast,historicalInputContext } from "../server/calculation/historicalIndicators";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { db } from "../server/db";
import { sql } from "drizzle-orm";

const dir = "generated-artifacts/overlay-replay";
async function main() {
  if(process.env.NODE_ENV==="production") throw new Error("Development only");
  if (process.argv[2] === "--worker") {
    const captured = JSON.parse(readFileSync(process.argv[3], "utf8"));
    assert.equal(currentSourceArchiveId(),captured.sourceArchive,"Replay executable source/config/dependency version differs");
    assert.ok(Array.isArray(captured.approvedValues),"Missing captured driver dependency");
    assert.ok(Array.isArray(captured.historicalIndicators),"Missing captured historical dependency");
    const header=await resolveSnapshot(captured.workbook.id);assert.ok(header);
    const baseline = unpackDataset(captured.workbook.id, captured.workbook.chunks);
    const overlays = captured.overlays.map((o: any) => unpackOverlay(o.id, o.payload));
    const effective = applyOverlays(baseline, overlays, captured.cutoff);
    const packed = packDataset(effective.companies, effective.timeSeries);
    const manifest = createManifest({
      codeVersion: captured.codeVersion, modelVersion: "overlay-replay-1",
      snapshotHashes: [captured.workbook.id, ...captured.overlays.map((o: any) => o.id)],
      scenario: "development-revised-history-fixture", settings: { cutoff: captured.cutoff },
    });
    const actualResults:Record<string,unknown>={};
    await runWithOverrideRows(captured.approvedValues,()=>historicalInputContext.run(captured.historicalIndicators,()=>
      snapshotContext.run(header,()=>overlayContext.run({ids:captured.overlays.map((o:any)=>o.id),
        cutoff:captured.cutoff,overlays},async()=>{
        for(const path of replayPaths) actualResults[path]=JSON.parse(JSON.stringify(publicValuationResult(
          await calculateSelectedResult(path,{method:"absolute"},header),path.startsWith("/decarb-gap"))));
      }))));
    const result = { companyCount: packed.companyCount, rowCount: packed.observationCount,actualResults,
      effectiveInputHash: packed.id,
      selectedCompany: effective.companies.find(c => c.id === captured.companyId),
      selectedObservation: JSON.parse(JSON.stringify(effective.timeSeries.find(r => r.companyId === captured.companyId))),
    };
    const archived = packAnalysisResult(manifest, result);
    assert.deepEqual(unpackAnalysisResult(archived.id, archived.payload).result, result);
    assert.equal(packDataset(baseline.companies, baseline.timeSeries).id, captured.workbook.id);
    const exportedRows = [
      { field:"companyCount",value:result.companyCount },
      { field:"rowCount",value:result.rowCount },
      { field:"effectiveInputHash",value:result.effectiveInputHash },
      ...Object.entries(actualResults).flatMap(([field,value])=>{
        const serialized=canonicalJson(value);
        return Array.from({length:Math.ceil(serialized.length/30000)},(_,part)=>({
          field:`${field}#${part}`,value:serialized.slice(part*30000,(part+1)*30000),
        }));
      }),
    ];
    const identity=await exportDataIdentity(exportedRows);
    const workbook=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet(identity.normalized),"Data");
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.json_to_sheet([
      {manifestId:manifest.id,resultId:archived.id,exportDataHash:identity.hash,
        scope:"Isolated engineering replay fixture; not scientific acceptance"},
    ]),"Identity");
    const restored=XLSX.read(XLSX.write(workbook,{type:"buffer",bookType:"xlsx"}),{type:"buffer"});
    assert.deepEqual(XLSX.utils.sheet_to_json(restored.Sheets.Data),identity.normalized);
    assert.equal((XLSX.utils.sheet_to_json(restored.Sheets.Identity) as any[])[0].resultId,archived.id);
    for(const path of replayPaths) {
      const rows=(XLSX.utils.sheet_to_json(restored.Sheets.Data) as any[]).filter(row=>row.field.startsWith(`${path}#`));
      assert.deepEqual(JSON.parse(rows.map(row=>row.value).join("")),actualResults[path],"Actual calculator XLSX readback");
    }
    assert.throws(() => applyOverlays(baseline, overlays, "1900-01-01"), /cutoff/);
    assert.throws(() => unpackOverlay("0".repeat(64), captured.overlays[0].payload), /hash/);
    writeFileSync(process.argv[4], JSON.stringify({ resultHash: archived.id,exportHash:identity.hash,
      xlsxRoundtrip:true, result }));
    return;
  }
  const { loadSnapshot } = await import("../server/snapshots/store");
  const header = await resolveSnapshot();
  assert.ok(header, "Development workbook archive required");
  const data = await loadSnapshot(header);
  const row = data.timeSeries.find(r => r.marketCap !== null);
  assert.ok(row);
  const date = row.date.toISOString().slice(0, 10);
  const common = { companyId: row.companyId, observationDate: date, availableAt: date,
    source: "synthetic perturbation on retained development baseline",
    approvalEvidence: "TEST ONLY; not an approval", historyBasis: "revised-history" };
  const overlays = [
    packOverlay([{ ...common, field: "marketCap", value: row.marketCap! + 1, kind: "financial", unit: "USD million" }]),
    packOverlay([{ ...common, field: "scope1Emissions", value: 0, kind: "carbon", unit: "tCO2e" }]),
    packOverlay([{ ...common, field: "sdgAlignmentScore", value: 3, kind: "sdg", unit: "score" }]),
  ];
  mkdirSync(dir, { recursive: true });
  const drivers=await db.execute(sql`SELECT indicator_key AS "indicatorKey",year,value,source,
    source_url AS "sourceUrl",as_of_date AS "asOfDate",method FROM indicator_values WHERE status='approved' ORDER BY indicator_key,year`);
  const captured = { workbook: packDataset(data.companies, data.timeSeries), overlays,
    approvedValues:drivers.rows,sourceArchive:currentSourceArchiveId(),
    historicalIndicators:runWithOverrideRows(drivers.rows as any,()=>getAllHistoricalIndicatorsWithNowcast()),
    cutoff: data.timeSeries.map(r=>r.date.toISOString().slice(0,10)).sort().at(-1)!, companyId: row.companyId,
    codeVersion: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim() };
  const file = `${dir}/inputs-${contentHash(captured)}.json`;
  writeFileSync(file, JSON.stringify(captured));
  for(const [name,invalid] of [
    ["code-pin",{...captured,sourceArchive:"0".repeat(64)}],
    ["missing-dependency",{...captured,historicalIndicators:undefined}],
  ] as const) {
    const invalidFile=`${dir}/${name}.json`;
    writeFileSync(invalidFile,JSON.stringify(invalid));
    assert.throws(()=>execFileSync(process.execPath,["--import","tsx","script/verify-overlay-replay.ts",
      "--worker",invalidFile,`${dir}/must-not-exist.json`],{stdio:"pipe",timeout:120000}),
      (error:any)=>String(error.stderr).includes(name==="code-pin"
        ? "Replay executable source/config/dependency version differs" : "Missing captured historical dependency"));
  }
  const results = [1, 2].map(n => {
    const out = `${dir}/worker-${n}.json`;
    execFileSync(process.execPath, ["--import", "tsx", "script/verify-overlay-replay.ts", "--worker", file, out],
      { env: { ...process.env, DATA_SCHEDULER_ENABLED: "false" }, timeout: 120000 });
    return JSON.parse(readFileSync(out, "utf8"));
  });
  assert.deepEqual(results[0], results[1]);
  assert.notEqual(results[0].result.effectiveInputHash, header.id);
  console.log(JSON.stringify({ file, resultHash: results[0].resultHash,
    companyCount: results[0].result.companyCount, rowCount: results[0].result.rowCount,
    unchangedBaseline: true, overlays: 3, freshProcesses: 2,
    actualPaths:replayPaths,xlsxActualResultReadback:true,missingDependencyRejected:true,codePinRejected:true,
    emptyTargetPaths:replayPaths.filter(path=>Array.isArray(results[0].result.actualResults[path]) &&
      results[0].result.actualResults[path].length===0),
    caveat: "Synthetic engineering only; retained immutable workbook dependency still requires DEV DB. Target base-year metadata is unavailable: target paths can be empty, not nonempty-target acceptance." }));
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
