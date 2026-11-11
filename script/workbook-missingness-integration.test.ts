import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import XLSX from "xlsx";
import { validateRequiredSheets, parseAndPrepare, generateTimeSeriesStreaming } from "../server/climateValuation/dataProcessor";
import { packDataset, unpackDataset } from "../server/snapshots/contract";
import { runWithReplayWorkbook, snapshotContext, type SnapshotHeader } from "../server/snapshots/store";
import { computeTercilesOnTheFly } from "../server/climateValuation/tercileCalculator";
import { carryForwardEmissions } from "../server/climateValuation/emissionsCarryForward";
import { workbookSourceId, type WorkbookSourceMetadata } from "../server/climateValuation/workbookMissingness";
import { exportWorkbookMissingness } from "../server/climateValuation/workbookMissingnessExport";
import type { CvCompany, CvTimeSeries } from "../shared/schema";
import { interpolateInterior } from "../server/calculation/driverEvidence";
import { computeGroupAggregates } from "../server/climateValuation/carbonPriceCalculator";
import { noaaAdapter } from "../server/dataIngestion/adapters/noaa";
import { worldBankAdapter } from "../server/dataIngestion/adapters/worldBank";
import { owidAdapter } from "../server/dataIngestion/adapters/owid";
import { createHash } from "node:crypto";

const directory = process.env.S03_008_EVIDENCE_DIR ?? mkdtempSync(join(tmpdir(), "s03-008-"));
mkdirSync(directory, { recursive: true });
const names = ["Blank", "Null", "Zero", "Carry", "Low", "High"];
const isins = names.map((_, index) => `US${String(index + 1).padStart(10, "0")}`);
const years = [2022, 2023, 2024];
function fixture(name: string, edit?: (book: XLSX.WorkBook) => void) {
  const book = XLSX.utils.book_new();
  const add = (sheet: string, rows: unknown[][]) => XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), sheet);
  add("Descriptive", [["NAME", "Type"], ...names.map((name, i) => [name, isins[i]])]);
  for (const sheet of ["GreenRev", "EmissionTargets"]) add(sheet, [
    ["ISSUER_ISIN", sheet === "GreenRev" ? "SDG_07_NET_ALIGNMENT_SCORE" : "TARGET_SUMMARY_CUM_CHANGE_2050"],
    ...isins.map((isin, i) => [isin, i === 0 ? "" : i === 1 ? null : i === 2 ? 0 : i]),
  ]);
  for (const [sheet, prefix, carry] of [
    ["S1", "CARBON_EMISSIONS_SCOPE_1_", [5, null, 7]],
    ["S2", "CARBON_EMISSIONS_SCOPE_2_", [7, 8, null]],
    ["S3", "CARBON_EMISSIONS_SCOPE_3_", [9, null, 11]],
  ] as const) add(sheet, [
    ["ISSUER_ISIN", ...years.map(year => `${prefix}FY${year - 2000}`)],
    ...isins.map((isin, i) => [isin, ...years.map((_, t) => i === 0 ? "" : i === 1 ? null : i === 2 ? 0 : i === 3 ? carry[t] : i === 4 ? 1 : 10)]),
  ]);
  for (const sheet of ["RI", "MV", "PE", "Profit"]) add(sheet, [
    ["Name", ...names.map((name, i) => sheet === "PE" ? `${isins[i]}(P)` : `${name} - ${sheet}`)],
    ...years.map(year => [`${year}-07-01`, ...names.map((_, i) => sheet === "RI" ? i === 2 ? 0 : 100 : sheet === "MV" ? 100 : sheet === "PE" ? 20 : i === 0 ? 1 : i === 1 ? 2 : 5)]),
  ]);
  edit?.(book);
  const path = join(directory, `${name}.xlsx`);
  XLSX.writeFile(book, path);
  return path;
}
async function load(path: string) {
  const context = await parseAndPrepare(path, validateRequiredSheets(path));
  try {
    const companies = context.companyData.companies.map((row, i) => ({ ...row, id: i + 1 })) as CvCompany[];
    const ids = new Map(companies.map(row => [row.isin, row.id]));
    const rows: (CvTimeSeries & WorkbookSourceMetadata)[] = [];
    await generateTimeSeriesStreaming(context, path, ids, 100, async batch => {
      for (const row of batch) rows.push({ ...row, id: rows.length + 1 } as CvTimeSeries & WorkbookSourceMetadata);
    });
    return { companies, rows, sourceId: context.sourceId };
  } finally { context.releaseMemory(); }
}
test("actual XLSX loader → immutable dataset → actual calculator → audited XLSX preserves blank/null/zero and every real infill cell", async () => {
  const path = fixture("blank-null-zero-and-infill");
  const loaded = await load(path);
  assert.equal(loaded.sourceId, await workbookSourceId(path));
  assert.equal(loaded.sourceId, createHash("sha256").update(readFileSync(path)).digest("hex"));
  const packed = packDataset(loaded.companies, loaded.rows);
  // Real JSON storage boundary: not an in-memory alias to the loader arrays.
  const stored = JSON.parse(JSON.stringify(packed));
  writeFileSync(join(directory, "immutable-input.json"), JSON.stringify(stored, null, 2));
  const originalBytes = JSON.stringify(stored);
  const restored = unpackDataset(stored.id, stored.chunks);
  const raw = restored.timeSeries as (CvTimeSeries & WorkbookSourceMetadata)[];
  for (const row of raw.filter(row => row.companyId === 1 || row.companyId === 2)) {
    assert.equal(row.scope1Emissions, null); assert.equal(row.scope2Emissions, null);
    assert.equal(row.sourceCells?.scope1Emissions?.state, "blank");
    assert.equal(row.sourceCells?.scope1Emissions?.originalValue, null);
  }
  for (const row of raw.filter(row => row.companyId === 3)) {
    assert.equal(row.scope1Emissions, 0); assert.equal(row.totalReturnIndex, 0);
    assert.equal(row.sourceCells?.scope1Emissions?.state, "observed");
  }
  assert.equal(restored.companies[0].sdgAlignmentScore, null);
  assert.equal(restored.companies[1].emissionTarget2050, null);
  assert.equal(restored.companies[2].sdgAlignmentScore, 0);
  assert.equal(restored.companies[2].emissionTarget2050, 0);
  const filled = carryForwardEmissions(raw);
  const fills = filled.flatMap(row => row.imputedCells ?? []);
  assert.equal(fills.length, 3);
  for (const fill of fills) {
    assert.equal(fill.original.originalValue, null);
    assert.equal(fill.original.sourceId, loaded.sourceId);
    assert.equal(fill.donor.sourceId, loaded.sourceId);
    assert.equal(fill.method, "last-observation-carried-forward");
    const workbook = XLSX.readFile(path);
    assert.ok(workbook.Sheets[fill.original.sheet][fill.original.cell]?.v == null);
    assert.equal(workbook.Sheets[fill.donor.sheet][fill.donor.cell].v, fill.value);
  }
  const mid = filled.find(row => row.companyId === 4 && row.date.getUTCFullYear() === 2023)!;
  assert.equal(mid.emissionsAsOf?.getUTCFullYear(), 2022, "Observed scope2 in2023 must not relabel older scope1/3 donors");
  assert.deepEqual(mid.imputedCells?.map(fill => fill.original.cell), ["C5", "C5"]);
  const header = { id: stored.id, companyCount: 6, observationCount: 18 } as SnapshotHeader;
  const calculation = await runWithReplayWorkbook(stored, () =>
    snapshotContext.run(header, () => computeTercilesOnTheFly("absolute", false)));
  assert.equal(calculation.length, 3, "Actual calculator ran, not a replicated formula");
  for (const row of calculation) {
    assert.equal(row.bottomCount, 1); assert.equal(row.topCount, 1);
    assert.equal(row.bottomTercileAvgPE, 20, "Missing Blank/Null companies cannot replace the true-zero-intensity company");
    assert.equal(row.premium, 0);
  }
  const exported = exportWorkbookMissingness({
    snapshotId: stored.id, immutableInput: stored, sourceId: loaded.sourceId, original: raw, calculated: filled,
    calculationRows: calculation.map(row => ({ ...row })),
  });
  writeFileSync(join(directory, "missingness-calculation-export.xlsx"), exported.bytes);
  const decoded = XLSX.read(exported.bytes, { type: "buffer" });
  const exportedSources = XLSX.utils.sheet_to_json(decoded.Sheets.SourceCells, { defval: null }) as any[];
  const exportedFills = XLSX.utils.sheet_to_json(decoded.Sheets.InfilledCells, { defval: null }) as any[];
  assert.equal(exportedFills.length, 3);
  assert.ok(exportedSources.filter(row => row.companyId === 1 && row.field === "scope1Emissions").every(row => row.originalValue === null && row.calculatedValue === null));
  assert.ok(exportedSources.filter(row => row.companyId === 3 && row.field === "scope1Emissions").every(row => row.originalValue === 0 && row.calculatedValue === 0));
  assert.ok(exportedFills.every(row => row.originalValue === null && row.method === "last-observation-carried-forward" && row.sourceId === loaded.sourceId));
  assert.deepEqual(XLSX.utils.sheet_to_json(decoded.Sheets.Calculation, { defval: null }), calculation);
  assert.equal(JSON.stringify(stored), originalBytes, "No source blank was overwritten by calculation/infill/export");
  const tampered = structuredClone(stored);
  tampered.chunks.find((chunk: any) => chunk.entity === "timeSeries").rows[0].scope1Emissions = 0;
  assert.throws(() => unpackDataset(tampered.id, tampered.chunks), /hash mismatch/);
  assert.throws(() => exportWorkbookMissingness({
    snapshotId: stored.id, immutableInput: stored, sourceId: loaded.sourceId,
    original: raw.map((row, index) => index === 0 ? { ...row, scope1Emissions: 0 } : row),
    calculated: filled, calculationRows: [],
  }), /original values\/source cells conflict/);
  writeFileSync(join(directory, "pipeline-receipt.json"), JSON.stringify({
    criterion: "S03-008", sourceId: loaded.sourceId, immutableInputId: stored.id,
    observations: raw.length, actualCalculator: "computeTercilesOnTheFly", calculationRows: calculation.length,
    sourceBlankRowsUnchanged: true, infilledCells: exported.infills, scientificAcceptance: false,
    output: "missingness-calculation-export.xlsx",
  }, null, 2));
});
for (const [name, sheet, address, value] of [
  ["not-applicable", "S1", "C2", "not applicable"],
  ["below-threshold", "S1", "C2", "<0.1"],
  ["numeric-prefix", "MV", "C2", "12 kg"],
  ["text-null-not-null", "S2", "C2", "null"],
  ["NA-qualifier", "GreenRev", "B2", "N/A"],
  ["infinity", "PE", "B2", "Infinity"],
  ["boolean", "Profit", "C2", false],
  ["RI-partial-numeric", "RI", "C2", "12%"],
] as const) test(`actual loader rejects ${name} with source hash and exact ${sheet}!${address}; no calculation/export`, async () => {
  const path = fixture(`reject-${name}`, book => { book.Sheets[sheet][address] = { t: typeof value === "boolean" ? "b" : "s", v: value }; });
  const sourceId = await workbookSourceId(path);
  let reason = "";
  await assert.rejects(load(path), error => {
    reason = error instanceof Error ? error.message : "";
    return reason.includes(`${sourceId}:${sheet}!${address}`) && reason.includes("explicit token/qualifier review");
  });
  writeFileSync(join(directory, `reject-${name}.receipt.json`), JSON.stringify({
    sourceId, sheet, cell: address, input: value, status: "rejected-not-coerced-or-infilled",
    reason, calculationOrExportAccepted: false, scientificAcceptance: false,
  }, null, 2));
});
test("real Excel error cell is refused rather than disappearing through sheet_to_json as a blank", async () => {
  const path = fixture("reject-excel-error", book => { book.Sheets.S1.C2 = { t: "e", v: 42 }; });
  await assert.rejects(load(path), /S1!C2/);
});
test("actual streaming boundary refuses changed workbook bytes before accepting output batches", async () => {
  const path = fixture("source-changed");
  const context = await parseAndPrepare(path, validateRequiredSheets(path));
  try {
    const book = XLSX.readFile(path); book.Sheets.RI.B2.v = 999; XLSX.writeFile(book, path);
    let accepted = 0;
    await assert.rejects(generateTimeSeriesStreaming(context, path, new Map(), 1, async () => { accepted++; }), /source bytes changed/);
    assert.equal(accepted, 0);
  } finally { context.releaseMemory(); }
});
test("legacy rows without original cell identity cannot silently infill; exports reject forged donor identities", async () => {
  const loaded = await load(fixture("refusal-and-tamper"));
  const legacy = loaded.rows.map(({ sourceCells, ...row }) => row);
  const refused = carryForwardEmissions(legacy);
  assert.equal(refused.flatMap(row => row.imputedCells ?? []).length, 0);
  assert.ok(refused.some(row => row.imputationRefusals?.some(item => /no untraceable infill/.test(item.reason))));
  const filled = carryForwardEmissions(loaded.rows);
  assert.throws(() => carryForwardEmissions(filled), /original unfilled input/);
  const one = filled.find(row => row.imputedCells?.length)!;
  one.imputedCells![0].donor.cell = "Z99";
  const packed = packDataset(loaded.companies, loaded.rows);
  assert.throws(() => exportWorkbookMissingness({
    snapshotId: packed.id, immutableInput: packed, sourceId: loaded.sourceId,
    original: loaded.rows, calculated: filled, calculationRows: [],
  }), /actual original blank and observed donor/);
});
test("interior diagnostic consumes actual loaded immutable source cells, never invents an original blank year", async () => {
  const loaded = await load(fixture("interior-real-source-cells"));
  const packed = packDataset(loaded.companies, loaded.rows);
  const raw = unpackDataset(packed.id, JSON.parse(JSON.stringify(packed.chunks))).timeSeries as (CvTimeSeries & WorkbookSourceMetadata)[];
  const points = raw.filter(row => row.companyId === 4).map(row => ({
    year: row.date.getUTCFullYear(), value: row.scope1Emissions, sourceCell: row.sourceCells?.scope1Emissions,
  }));
  const result = interpolateInterior(points, 2023);
  assert.equal(result.value, 6); assert.equal(result.infilled, true);
  assert.equal(result.method, "linear-interior-diagnostic");
  assert.equal(result.originalSourceCell?.cell, "C5");
  assert.equal(result.originalSourceCell?.originalValue, null);
  assert.deepEqual(result.sourceCells?.map(cell => cell.cell), ["B5", "D5"]);
  assert.ok(result.sourceCells?.every(cell => cell.sourceId === loaded.sourceId));
  assert.equal(interpolateInterior(points.filter(row => row.year !== 2023), 2023).infilled, false);
  writeFileSync(join(directory, "interior-diagnostic-receipt.json"), JSON.stringify({ snapshotId: packed.id, result, scientificAcceptance: false }, null, 2));
});
test("actual carbon-price aggregate/export excludes missing included scope instead of treating it as zero", async () => {
  const loaded = await load(fixture("partial-scope-aggregation", book => { book.Sheets.S1.B2 = { t: "n", v: 0 }; }));
  const packed = packDataset(loaded.companies, loaded.rows);
  const restored = unpackDataset(packed.id, JSON.parse(JSON.stringify(packed.chunks))).timeSeries as (CvTimeSeries & WorkbookSourceMetadata)[];
  const original = restored.filter(row => row.date.getUTCFullYear() === 2022 && [1, 3].includes(row.companyId));
  assert.equal(original[0].scope1Emissions, 0); assert.equal(original[0].scope2Emissions, null);
  const aggregate = computeGroupAggregates(original, false, false, 1);
  assert.equal(aggregate.count, 1); assert.equal(aggregate.totalMarketCap, 100);
  assert.equal(aggregate.totalProfit, 5); assert.equal(aggregate.totalEmissions, 0);
  const calculated = carryForwardEmissions(original);
  const exported = exportWorkbookMissingness({
    snapshotId: packed.id, immutableInput: packed, sourceId: loaded.sourceId, original, calculated, calculationRows: [aggregate],
  });
  const book = XLSX.read(exported.bytes, { type: "buffer" });
  assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets.Calculation, { defval: null }), [aggregate]);
  assert.equal(exported.sourceRows.find(row => row.companyId === 1 && row.field === "scope2Emissions")?.calculatedValue, null);
  writeFileSync(join(directory, "partial-scope-aggregation-export.xlsx"), exported.bytes);
});
const adapterContext = { curated: () => undefined, latestCuratedYear: 2024, fetchedSoFar: new Map() };
test("actual NOAA adapter preserves observed zero and response source-line identity, rejects qualified numeric prefixes", async () => {
  const prior = globalThis.fetch;
  const body = "# Isolated engineering fixture, not live NOAA evidence\n2023 1.25\n2024 0\n";
  try {
    globalThis.fetch = async () => new Response(body);
    const rows = await noaaAdapter.fetch(adapterContext);
    assert.equal(rows.length, 2); assert.ok(rows.every(row => row.value === 0 && row.year === 2024));
    const sourceId = createHash("sha256").update(body).digest("hex");
    assert.ok(rows.every(row => JSON.parse(row.rawContext!).sourceId === sourceId && JSON.parse(row.rawContext!).line === 3));
    writeFileSync(join(directory, "noaa-isolated-source.txt"), body);
    writeFileSync(join(directory, "noaa-isolated-receipt.json"), JSON.stringify(rows, null, 2));
    globalThis.fetch = async () => new Response("# Isolated unsupported token\n2024 0.1ppm\n");
    await assert.rejects(noaaAdapter.fetch(adapterContext), /Unsupported NOAA numeric source.*line2:column2/);
    globalThis.fetch = async () => new Response("# Isolated below-threshold token\n2024 <0.1\n");
    await assert.rejects(noaaAdapter.fetch(adapterContext), /Unsupported NOAA numeric source.*line2:column2/);
  } finally { globalThis.fetch = prior; }
});
test("actual WorldBank/OWID adapters skip null/qualified observations without substituting zero and retain actual earlier-year true zero", async () => {
  const prior = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json([{}, [{ date: "2024", value: null }, { date: "2023", value: 0 }]]);
    const wb = await worldBankAdapter.fetch(adapterContext);
    assert.equal(wb.length, 1); assert.equal(wb[0].year, 2023); assert.equal(wb[0].value, 0);
    globalThis.fetch = async () => Response.json([{}, [{ date: "2024", value: null }, { date: "2023", value: "<0.1" }]]);
    assert.deepEqual(await worldBankAdapter.fetch(adapterContext), []);
    globalThis.fetch = async () => Response.json({ World: { data: [{ year: 2024, co2: null }, { year: 2023, co2: 0 }] } });
    const owid = await owidAdapter.fetch(adapterContext);
    assert.equal(owid.length, 1); assert.equal(owid[0].year, 2023); assert.equal(owid[0].value, 0);
    globalThis.fetch = async () => Response.json({ World: { data: [{ year: 2024, co2: "N/A" }] } });
    assert.deepEqual(await owidAdapter.fetch(adapterContext), []);
  } finally { globalThis.fetch = prior; }
});
test("present-but-empty Profit sheet remains unavailable; absent Profit derives explicitly from actual MV/PE cells, not an invented blank", async () => {
  const empty = await load(fixture("empty-Profit-not-derived", book => {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets.Profit, { header: 1 });
    book.Sheets.Profit = XLSX.utils.aoa_to_sheet([rows[0]]);
  }));
  assert.ok(empty.rows.every(row => row.netProfit === null && !row.derivations));
  const derived = await load(fixture("absent-Profit-explicit-derivation", book => {
    delete book.Sheets.Profit; book.SheetNames = book.SheetNames.filter(name => name !== "Profit");
  }));
  assert.ok(derived.rows.every(row => row.netProfit === 5 && !row.sourceCells?.netProfit));
  const packed = packDataset(derived.companies, derived.rows);
  const original = unpackDataset(packed.id, JSON.parse(JSON.stringify(packed.chunks))).timeSeries as (CvTimeSeries & WorkbookSourceMetadata)[];
  const exported = exportWorkbookMissingness({
    snapshotId: packed.id, immutableInput: packed, sourceId: derived.sourceId, original,
    calculated: carryForwardEmissions(original), calculationRows: [],
  });
  const book = XLSX.read(exported.bytes, { type: "buffer" });
  const methods = XLSX.utils.sheet_to_json<any>(book.Sheets.Derivations, { defval: null });
  assert.equal(methods.length, 18);
  assert.ok(methods.every(row => row.originalSourceCell === null && /derived-not-source-cell-infill/.test(row.method)));
  assert.ok(methods.every(row => JSON.parse(row.inputs).every((cell: any) => cell.sourceId === derived.sourceId && ["MV", "PE"].includes(cell.sheet))));
  writeFileSync(join(directory, "explicit-profit-derivation-export.xlsx"), exported.bytes);
});
test("actual loader cannot borrow nearby-period Profit as if it were the original source cell", async () => {
  const loaded = await load(fixture("nearby-Profit-not-original", book => { book.Sheets.Profit.A2 = { t: "s", v: "2022-06-30" }; }));
  assert.ok(loaded.rows.filter(row => row.date.getUTCFullYear() === 2022).every(row =>
    row.netProfit === null && !row.sourceCells?.netProfit && !row.derivations));
  assert.ok(loaded.rows.filter(row => row.date.getUTCFullYear() !== 2022).every(row => row.netProfit !== null));
  const packed = packDataset(loaded.companies, loaded.rows);
  const calculation = await runWithReplayWorkbook(packed, () =>
    snapshotContext.run({ id: packed.id, companyCount: 6, observationCount: 18 } as SnapshotHeader,
      () => computeTercilesOnTheFly("absolute", false)));
  assert.equal(calculation.length, 2);
  assert.ok(calculation.every(row => !row.date.startsWith("2022")));
});
test("reviewed retained financial NA sentinel is unavailable, never an original blank or numeric zero", async () => {
  const loaded = await load(fixture("financial-provider-NA", book => {
    for (const name of ["RI", "MV", "PE", "Profit"]) book.Sheets[name].B2 = { t: "s", v: "NA" };
  }));
  const packed = packDataset(loaded.companies, loaded.rows);
  const original = unpackDataset(packed.id, JSON.parse(JSON.stringify(packed.chunks))).timeSeries as (CvTimeSeries & WorkbookSourceMetadata)[];
  const target = original.find(row => row.companyId === 1 && row.date.getUTCFullYear() === 2022)!;
  for (const field of ["totalReturnIndex", "marketCap", "priceEarnings", "netProfit"] as const) {
    assert.equal(target[field], null);
    assert.equal(target.sourceCells?.[field]?.state, "unavailable");
    assert.equal(target.sourceCells?.[field]?.missingness, "provider-NA");
  }
  const exported = exportWorkbookMissingness({
    snapshotId: packed.id, immutableInput: packed, sourceId: loaded.sourceId, original,
    calculated: carryForwardEmissions(original), calculationRows: [],
  });
  assert.ok(exported.sourceRows.filter(row => row.companyId === 1 && row.observationDate === target.date.toISOString() && ["marketCap", "netProfit", "priceEarnings", "totalReturnIndex"].includes(String(row.field)))
    .every(row => row.originalValue === null && row.calculatedValue === null && row.sourceState === "unavailable" && row.method === "provider-NA-not-observed-or-blank"));
  await assert.rejects(load(fixture("NA-not-universal-blank", book => { book.Sheets.S1.C2 = { t: "s", v: "NA" }; })), /Unsupported numeric source cell/);
});
test("unique same-month Profit alignment retains actual source date/cell and never calls it original-blank infill", async () => {
  const loaded = await load(fixture("same-month-Profit-source-period", book => { book.Sheets.Profit.A2 = { t: "s", v: "2022-07-05" }; }));
  const target = loaded.rows.find(row => row.companyId === 3 && row.date.getUTCFullYear() === 2022)!;
  assert.equal(target.netProfit, 5);
  assert.equal(target.sourceCells?.netProfit?.cell, "D2");
  assert.equal(target.sourceCells?.netProfit?.observationDate, "2022-07-05T00:00:00.000Z");
  assert.match(target.derivations?.netProfit.method ?? "", /same-calendar-month-source-period-alignment/);
  assert.equal(target.derivations?.netProfit.originalSourceCell, null);
  const packed = packDataset(loaded.companies, loaded.rows);
  const original = unpackDataset(packed.id, JSON.parse(JSON.stringify(packed.chunks))).timeSeries as (CvTimeSeries & WorkbookSourceMetadata)[];
  const exported = exportWorkbookMissingness({
    snapshotId: packed.id, immutableInput: packed, sourceId: loaded.sourceId, original,
    calculated: carryForwardEmissions(original), calculationRows: [],
  });
  assert.ok(exported.sourceRows.some(row => row.companyId === 3 && row.field === "netProfit" && row.sourceObservationDate === "2022-07-05T00:00:00.000Z" && /same-calendar-month/.test(String(row.method))));
});
test("last mapped financial alias missingness cannot reuse an earlier column's value or source identity", async () => {
  const loaded = await load(fixture("alias-NA-no-backfill", book => {
    const sheet = book.Sheets.MV;
    sheet.H1 = { t: "s", v: "Blank - alias" };
    for (let row = 2; row <= 4; row++) sheet[`H${row}`] = { t: "s", v: "NA" };
    sheet["!ref"] = "A1:H4";
  }));
  for (const row of loaded.rows.filter(row => row.companyId === 1)) {
    assert.equal(row.marketCap, null);
    assert.equal(row.sourceCells?.marketCap?.state, "unavailable");
    assert.match(row.sourceCells?.marketCap?.cell ?? "", /^H/);
  }
});
test("RI aliases emit one authoritative original per company/date, retaining last-column NA without value backfill", async () => {
  const loaded = await load(fixture("RI-alias-one-original", book => {
    const sheet = book.Sheets.RI;
    sheet.H1 = { t: "s", v: "Blank - alias" };
    for (let row = 2; row <= 4; row++) sheet[`H${row}`] = { t: "s", v: "NA" };
    sheet["!ref"] = "A1:H4";
  }));
  assert.equal(loaded.rows.length, 18);
  for (const row of loaded.rows.filter(row => row.companyId === 1)) {
    assert.equal(row.totalReturnIndex, null);
    assert.equal(row.sourceCells?.totalReturnIndex?.state, "unavailable");
    assert.match(row.sourceCells?.totalReturnIndex?.cell ?? "", /^H/);
  }
  assert.doesNotThrow(() => packDataset(loaded.companies, loaded.rows));
});
test("later explicit blank metadata/scope rows cannot inherit an earlier alias row's numeric zero", async () => {
  const loaded = await load(fixture("metadata-row-blank-authoritative", book => {
    for (const sheet of ["GreenRev", "EmissionTargets", "S1"]) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[sheet], { header: 1 });
      rows.push([isins[2], ...Array(rows[0].length - 1).fill(null)]);
      book.Sheets[sheet] = XLSX.utils.aoa_to_sheet(rows);
    }
  }));
  assert.equal(loaded.companies[2].sdgAlignmentScore, null);
  assert.equal(loaded.companies[2].emissionTarget2050, null);
  assert.ok(loaded.rows.filter(row => row.companyId === 3).every(row => row.scope1Emissions === null && row.sourceCells?.scope1Emissions?.state === "blank"));
});
