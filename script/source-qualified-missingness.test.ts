import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import ts from "typescript";
import XLSX from "xlsx";
import { readQualifiedIndicatorArchive, interpolateQualifiedIndicator, exportQualifiedIndicators } from "../server/dataIngestion/adapters/qualifiedArchive";
import { owidAdapter } from "../server/dataIngestion/adapters/owid";
import { noaaAdapter } from "../server/dataIngestion/adapters/noaa";
import { computeGroupAggregates } from "../server/climateValuation/carbonPriceCalculator";
import { calculateCarbonIntensity } from "../server/climateValuation/sharedUtils";
import { computeSignalScores } from "../server/climateValuation/backtestCalculator";
import { monetaryContext, type MonetaryContext } from "../server/financialData/workbookMoney";

const directory = process.env.S03_004_EVIDENCE_DIR ?? mkdtempSync(join(tmpdir(), "s03-004-"));
function retainedAdapter(path: string, name: string) {
  const source = execFileSync("git", ["show", `b91c298dba2b0a1884b5c758ebc0c21e0a59f84e:${path}`], { encoding: "utf8" });
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const declarations = ast.statements.filter(node => !ts.isImportDeclaration(node))
    .map(node => node.getText(ast).replace(/^export\s+/, "")).join("\n");
  const js = ts.transpileModule(declarations, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function("fetchWithTimeout", "todayIso", "createHash", `${js};return ${name};`)(
    (url: string) => globalThis.fetch(url), () => "2026-01-01", createHash);
}
function archive(edit?: (value: any) => void) {
  const source = {
    version: "qualified-indicator-source-v1", publisher: "Engineering source fixture; not a real provider approval",
    sourceUrl: "https://example.org/engineering-only",
    sampling: { method: "paired-source-draw-linear-interior", evidence: "Fixture explicitly supplies paired draws; no distribution inferred",
      sourceUrl: "https://example.org/engineering-only-method" },
    series: [{ indicatorKey: "fossilCO2GtPerYear", unit: "Gt/yr", points: [
      { year: 2020, state: "unavailable", value: null, reason: "blank" },
      { year: 2021, state: "observed", value: 2, draws: [{ id: "a", value: 1 }, { id: "b", value: 3 }] },
      { year: 2022, state: "unavailable", value: null, reason: "blank" },
      { year: 2023, state: "observed", value: 4, draws: [{ id: "b", value: 5 }, { id: "a", value: 3 }] },
      { year: 2024, state: "not-applicable", value: null, reason: "Source declares boundary inapplicable" },
      { year: 2025, state: "below-threshold", value: null, operator: "<", limit: 0.1, reason: "Source-reported detection bound, not a measured value" },
      { year: 2026, state: "observed", value: 0 },
      { year: 2027, state: "unavailable", value: null, reason: "provider-null" },
    ] }],
  };
  edit?.(source);
  const path = join(directory, `source-${createHash("sha256").update(JSON.stringify(source)).digest("hex")}.json`);
  writeFileSync(path, JSON.stringify(source, null, 2));
  return { path, input: readQualifiedIndicatorArchive(path) };
}
test("actual qualified-source adapter→immutable input→XLSX/CLI distinguishes zero, unavailable, not-applicable and below-threshold", () => {
  const { input, path } = archive();
  assert.equal(input.sourceId, createHash("sha256").update(readFileSync(path)).digest("hex"));
  assert.throws(() => { input.source.series[0].points[0].value = 99 as never; });
  assert.throws(() => exportQualifiedIndicators({ ...input }), /Actual immutable/);
  const output = join(directory, "qualified-indicator-audit.xlsx");
  execFileSync("npx", ["tsx", "script/export-qualified-indicators.ts", path, output, "--engineering-only"]);
  const book = XLSX.readFile(output);
  const rows = XLSX.utils.sheet_to_json<any>(book.Sheets.SourceCells, { defval: null });
  assert.equal(rows.length, 8);
  assert.equal(rows.find(row => row.year === 2026).originalValue, 0);
  for (const [year, state] of [[2020, "unavailable"], [2024, "not-applicable"], [2025, "below-threshold"], [2027, "unavailable"]]) {
    const row = rows.find(row => row.year === year);
    assert.equal(row.state, state); assert.equal(row.originalValue, null);
  }
  assert.equal(rows.find(row => row.year === 2025).limit, 0.1);
  assert.equal(rows.find(row => row.year === 2025).operator, "<");
  const identity = XLSX.utils.sheet_to_json<any>(book.Sheets.Identity)[0];
  assert.match(identity.approval, /not-approved/);
});
test("paired-source samples interpolate only an actual interior blank with exact original/donor/method lineage", () => {
  const { input } = archive();
  const result = interpolateQualifiedIndicator(input, "fossilCO2GtPerYear", 2022);
  assert.equal(result.infilled, true); assert.equal(result.value, 3);
  assert.deepEqual(result.samples.map(sample => [sample.id, sample.value]), [["a", 2], ["b", 4]]);
  assert.equal(result.original?.locator, "/series/0/points/2/value");
  assert.ok(result.samples.every(sample => sample.left.sourceId === input.sourceId && sample.right.sourceId === input.sourceId));
  assert.equal(result.samples[0].right.locator, "/series/0/points/3/draws/1/value", "Pair by supplied ID, not row order");
  const workbook = exportQualifiedIndicators(input);
  const restored = XLSX.read(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const lineage = XLSX.utils.sheet_to_json<any>(restored.Sheets.SampleLineage);
  const sourceSamples = XLSX.utils.sheet_to_json<any>(restored.Sheets.SourceSamples);
  assert.equal(sourceSamples.length, 4);
  assert.equal(lineage.length, 2);
  for (const row of lineage) {
    assert.equal(JSON.parse(row.original).locator, "/series/0/points/2/value");
    assert.equal(JSON.parse(row.methodSource).locator, "/sampling");
    assert.equal(JSON.parse(row.methodSource).sourceId, input.sourceId);
    for (const side of ["left", "right"]) {
      const ref = JSON.parse(row[side]);
      const donor = sourceSamples.find(source => source.sourceId === ref.sourceId && source.locator === ref.locator);
      assert.ok(donor, "Every derived sample's exact original donor is in the export");
      assert.equal(donor.id, row.id);
    }
  }
});
test("no original cell, nonblank qualifiers, missing donor/method/draw evidence and unpaired draws refuse infill", () => {
  const { input } = archive();
  for (const year of [2019, 2020, 2024, 2025, 2027]) {
    const result = interpolateQualifiedIndicator(input, "fossilCO2GtPerYear", year);
    assert.equal(result.value, null); assert.equal(result.infilled, false);
  }
  assert.equal(interpolateQualifiedIndicator(input, "fossilCO2GtPerYear", 2026).value, 0);
  const fullyBracketed = archive(s => {
    s.series[0].points[6].draws = [{ id: "a", value: 0 }, { id: "b", value: 0 }];
  }).input;
  for (const [year, state] of [[2024, "not-applicable"], [2025, "below-threshold"]] as const) {
    const result = interpolateQualifiedIndicator(fullyBracketed, "fossilCO2GtPerYear", year);
    assert.equal(result.reason, `source-${state}-is-not-an-original-blank`);
    assert.equal(result.value, null, "Even fully evidenced bracketing samples cannot fill a nonblank qualifier");
    assert.deepEqual(result.samples, []);
  }
  for (const edit of [
    (s: any) => delete s.sampling,
    (s: any) => delete s.series[0].points[1].draws,
    (s: any) => { s.series[0].points[3].draws[0].id = "not-paired"; },
  ]) {
    const result = interpolateQualifiedIndicator(archive(edit).input, "fossilCO2GtPerYear", 2022);
    assert.equal(result.value, null); assert.equal(result.infilled, false);
    assert.match(result.reason, /source.*(unavailable|mismatch)/);
  }
});
test("ambiguous tokens, fabricated numeric qualifiers, duplicate years/IDs and unknown units fail actual archive ingestion", () => {
  for (const edit of [
    (s: any) => { s.series[0].points[0].value = "N/A"; },
    (s: any) => { s.series[0].points[4].value = 0; },
    (s: any) => { s.series[0].points[5].value = 0.05; },
    (s: any) => { s.series[0].points[0].year = 2021; },
    (s: any) => { s.series[0].points[1].draws[1].id = "a"; },
    (s: any) => { s.series[0].unit = "Mt/year"; },
    (s: any) => { s.sampling.method = "invent-a-normal-distribution"; },
  ]) assert.throws(() => archive(edit));
});
test("actual OWID adapter retains null-source lineage, true zero and small nonzero after native-unit conversion", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ World: { data: [
      { year: 2020, co2: 0 }, { year: 2021, co2: 0.0005 }, { year: 2022, co2: null },
    ] } }));
    const before = await retainedAdapter("server/dataIngestion/adapters/owid.ts", "owidAdapter").fetch({});
    assert.equal(before[0].value, 0, "Actual retained pre-change adapter rounds the known nonzero source to zero");
    const values = await owidAdapter.fetch({} as any);
    assert.equal(values[0].value, 0.0000005, "Old one-decimal rounding incorrectly made this zero");
    assert.equal(values[0].year, 2021, "No newer source period invented");
    const context = JSON.parse(values[0].rawContext!);
    assert.equal(context.sourceCells[0].originalValue, 0);
    assert.equal(context.sourceCells[2].state, "unavailable");
    assert.equal(context.sourceCells[2].originalValue, null);
    globalThis.fetch = async () => new Response(JSON.stringify({ World: { data: [{ year: 2024, co2: "<0.1" }] } }));
    assert.deepEqual(await owidAdapter.fetch({} as any), [], "Unsupported token refused, not interpreted as a bound/zero");
    globalThis.fetch = async () => new Response(JSON.stringify({ World: { data: [{ year: 2024, co2: Number.MIN_VALUE }] } }));
    await assert.rejects(() => owidAdapter.fetch({} as any), /underflow/);
  } finally { globalThis.fetch = original; }
});
test("actual NOAA adapter retains source precision rather than rounding a small known growth value to zero", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => new Response(String(url).includes("co2_gr_")
      ? "2024 0.001 0.01\n" : "2024 420.1234 0.1\n");
    const before = await retainedAdapter("server/dataIngestion/adapters/noaa.ts", "noaaAdapter").fetch({});
    assert.equal(before.find((value: any) => value.indicatorKey === "co2GrowthRatePpm").value, 0);
    const values = await noaaAdapter.fetch({} as any);
    assert.equal(values.find(value => value.indicatorKey === "co2GrowthRatePpm")?.value, 0.001);
    assert.equal(values.find(value => value.indicatorKey === "atmosphericCO2ppm")?.value, 420.1234);
    for (const value of values) assert.equal(JSON.parse(value.rawContext!).originalValue, value.value);
    globalThis.fetch = async () => new Response("2024 1e-600\n");
    await assert.rejects(() => noaaAdapter.fetch({} as any), /Missing\/unsupported/);
  } finally { globalThis.fetch = original; }
});
test("actual scope consumers preserve complete observed-zero rows and omit unknown scopes; retained old aggregate baseline differs", () => {
  const records = [
    { companyId: 1, marketCap: 100, netProfit: 5, scope1Emissions: 10, scope2Emissions: null, scope3Emissions: 2, date: new Date("2024-01-01") },
    { companyId: 2, marketCap: 100, netProfit: 5, scope1Emissions: 0, scope2Emissions: 0, scope3Emissions: null, date: new Date("2024-01-01") },
  ] as any;
  // Isolated monetary receipts satisfy the concurrent currency guard without
  // granting a real issuer approval or changing that worker's implementation.
  const moneyBook = XLSX.utils.book_new();
  for (const [sheet, values] of [["MV", [100, 100]], ["Profit", [5, 5]]] as const)
    XLSX.utils.book_append_sheet(moneyBook, XLSX.utils.aoa_to_sheet([
      ["Engineering-only USD millions", "Fixture1", "Fixture2"], ["2024-01-01", ...values],
    ]), sheet);
  const moneyId = createHash("sha256").update(XLSX.write(moneyBook, { type: "buffer", bookType: "xlsx" })).digest("hex");
  const context: MonetaryContext = { cutoff: "2024-01-01", targetCurrency: "USD", fx: [], identities: [],
    cells: [] };
  for (const row of records) {
    const isin = `engineering-only-${row.companyId}`;
    context.identities.push({ companyId: row.companyId, isin, reviewId: moneyId, status: "approved", reviewedAt: "2024-01-01" });
    row.sourceCells = {};
    for (const field of ["marketCap", "netProfit"] as const) {
      const sheet = field === "marketCap" ? "MV" : "Profit", cell = row.companyId === 1 ? "B2" : "C2";
      row.sourceCells[field] = { sourceId: moneyId, sheet, cell, observationDate: "2024-01-01",
        originalValue: row[field], state: "observed" };
      context.cells.push({ companyId: row.companyId, isin, field, sourceId: moneyId, sheet, cell,
        observationDate: "2024-01-01", nativeValue: row[field], nativeCurrency: "USD",
        magnitude: "millions", denominationEvidenceHash: moneyId });
    }
  }
  const current = monetaryContext.run(context, () => computeGroupAggregates(records, false, false, 5));
  assert.equal(current.count, 1); assert.equal(current.totalEmissions, 0);
  assert.equal(calculateCarbonIntensity(0, 0, null, 100, false), 0);
  assert.equal(calculateCarbonIntensity(0, 0, null, 100, true), null);
  const scores = computeSignalScores([{ id: 1 }, { id: 2 }] as any, "carbon_intensity", new Map(records.map((row: any) => [row.companyId, [row]])));
  assert.equal(scores.size, 0, "Incomplete row omitted; one valid row cannot form a rank distribution");
  const path = "server/climateValuation/carbonPriceCalculator.ts";
  const source = execFileSync("git", ["show", `40c524b29bec455f51e0bb9ac7d3efabe0218e3e:${path}`], { encoding: "utf8" });
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "computeGroupAggregates");
  assert.ok(declaration);
  const js = ts.transpileModule(declaration.getText(ast).replace(/^export\s+/, "") +
    "\nreturn computeGroupAggregates;", { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const originalAggregate = new Function(js)();
  const before = originalAggregate(records, false, false, 5);
  assert.equal(before.count, 2); assert.equal(before.totalEmissions, 10);
  assert.ok(!readFileSync(path, "utf8").match(/scope[123]Emissions\s*\|\|\s*0/));
});
