import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { gordonBaselineMetadata, publicValuationResult } from "../server/calculation/publicValuationContract";
import { gordonBaselineLabel, gordonBaselinePct, gordonExportNotes, verifyGordonBaselineRows } from "../client/src/lib/valuation-claims";
import { calculateSDGGrowthDifferential } from "../server/climateValuation/sdgGrowthCalculator";
import { calculateDecarbTerciles } from "../server/climateValuation/decarbTercileCalculator";
import { gordonBaselineSemantics } from "../shared/gordonBaselineSemantics";
import { bindNestedOutput, requireOutputSemantic } from "../shared/outputFieldSemantics";
import { semanticRows } from "../shared/fieldSemantics";
import { originalNominalAssessmentHandler } from "../server/calculation/originalNominalAssessmentHandler";
import type { Request, Response } from "express";
import { packDataset } from "../server/snapshots/contract";
import { runWithReplayWorkbook, snapshotContext, type SnapshotHeader } from "../server/snapshots/store";
import {
  equityProjection, originalNominalEquityProjection, originalNominalEquityAssessment,
  ORIGINAL_NOMINAL_TERMINAL_GRID,
} from "../server/calculation/reverseValuation";

test("S01-004 actual custom-r calculator/API, rendered label and XLSX notes agree; fixed8 retained", async () => {
  // Engineering-only fixture; not an issuer or production valuation assumption.
  const companies = [1, 2].map(id => ({ id, isin: `ENGINEERING-ONLY-${id}`, name: "Label fixture",
    geography: null, sector: null, subSector: null, industry: null,
    sdgAlignmentScore: id === 1 ? 1 : -1, emissionTarget2050: null }));
  const rows = companies.map(c => ({ id: c.id, companyId: c.id, date: new Date("2024-01-31Z"),
    totalReturnIndex: 100, marketCap: 100, netProfit: c.id === 1 ? 5 : 10,
    priceEarnings: null, scope1Emissions: 0, scope2Emissions: 0, scope3Emissions: 0 }));
  const packed = packDataset(companies, rows);
  const header = { id: packed.id, companyCount: 2, observationCount: 2 } as SnapshotHeader;
  for (const percent of [8, 9.25, 6.125]) {
    const result = await runWithReplayWorkbook(packed, () => snapshotContext.run(header,
      () => calculateSDGGrowthDifferential(percent / 100)));
    assert.equal(result.length, 1);
    const api = publicValuationResult(result) as typeof result;
    const actual = api[0];
    assert.doesNotThrow(() => verifyGordonBaselineRows(api, percent));
    assert.throws(() => verifyGordonBaselineRows(api, percent + 1), /do not match/);
    assert.equal(actual.costOfEquity, percent / 100);
    assert.equal(actual.gordonBaselineLabel, gordonBaselineLabel(percent));
    assert.ok(Math.abs(actual.cleanGrowth * 100 - gordonBaselinePct(actual.cleanPE, percent)!) < .0051);
    assert.equal(renderToStaticMarkup(createElement("p", null, gordonBaselineLabel(percent))),
      `<p>${actual.gordonBaselineLabel}</p>`);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gordonExportNotes(percent)), "Interpretation");
    const reopened = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
    const notes = XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(reopened.Sheets.Interpretation);
    assert.equal(notes.find(row => row.Field === "Valuation baseline")?.Value, actual.gordonBaselineLabel);
    assert.equal(notes.find(row => row.Field === "Gordon definition")?.Value, actual.gordonDefinition);
    assert.equal(Number(notes.find(row => row.Field === "Gordon cost of equity (decimal)")?.Value), actual.costOfEquity);
    assert.ok(!("impliedTemperature" in actual) && !("impliedDecarbRate" in actual));
  }
  assert.equal(gordonBaselineLabel(8), "Gordon baseline (r = 8%)");
  for (const invalid of [0, -1, NaN, Infinity, 101]) assert.throws(() => gordonBaselineLabel(invalid));
  assert.throws(() => gordonBaselineMetadata(NaN));
  assert.throws(() => verifyGordonBaselineRows([{ cleanPE: 20 }], 8), /do not match/);
});

test("S01-004 actual page and download paths wire additive notes without a generic default-r claim", () => {
  const read = (file: string) => readFileSync(file, "utf8");
  const download = read("client/src/components/download-data-button.tsx");
  assert.match(download, /interpretationNotes = \[\]/);
  assert.match(download, /\.\.\.interpretationNotes/);
  assert.doesNotMatch(download, /gordonExportNotes\(8\)/);
  const variable = read("client/src/pages/climate-valuation.tsx");
  assert.equal((variable.match(/costOfEquityPct=\{costOfEquity\}/g) ?? []).length, 2);
  assert.match(variable, /icon=\{Factory\}\s+costOfEquityPct=\{8\}/);
  assert.match(variable, /gordonBaselineLabel\(costOfEquityPct\)/);
  assert.match(variable, /interpretationNotes=\{gordonExportNotes\(costOfEquityPct, gordonSemanticPrefix\)\}/);
  assert.match(variable, /gordonSemanticPrefix="sdg"/);
  assert.match(variable, /gordonSemanticPrefix="targetTerciles"/);
  for (const file of ["decarb-signal", "decarb-gap-signal"]) {
    const source = read(`client/src/pages/${file}.tsx`);
    assert.match(source, /gordonBaselineLabel\(8\)/);
    assert.match(source, /interpretationNotes=\{gordonExportNotes\(8\)\}/);
  }
});

test("S01-004 nonempty actual target API filtering and registered workbook bindings agree at custom r", async () => {
  const companies = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1, isin: `ENGINEERING-TARGET-${index}`, name: "Target label engineering fixture",
    geography: null, sector: "Engineering only", subSector: null, industry: null,
    sdgAlignmentScore: index % 2 ? 1 : -1, emissionTarget2050: -.1 * (index + 1),
    targetEvidence: { baseYear: 2020, targetYear: 2050 as const, accountingScope: "scope1+scope2" as const,
      unit: "fractional-change" as const, publishedAt: "2023-01-01",
      sourceLocator: "ENGINEERING-ONLY source fixture", sourceExcerpt: "Synthetic target metadata test, not issuer evidence" },
  }));
  const rows = companies.map(c => ({ id: c.id, companyId: c.id, date: new Date("2024-01-31Z"),
    totalReturnIndex: 100, marketCap: 100, netProfit: [2, 2, 4, 4, 5, 5][c.id - 1],
    priceEarnings: null, scope1Emissions: 0, scope2Emissions: 0, scope3Emissions: 0 }));
  const packed = packDataset(companies, rows);
  const header = { id: packed.id, companyCount: 6, observationCount: 6 } as SnapshotHeader;
  assert.equal(gordonBaselineSemantics.length, 6, "Only six authorized additive metadata IDs");
  assert.equal(new Set(gordonBaselineSemantics.map(field => field.id)).size, 6);
  const percent = 9.375;
  await runWithReplayWorkbook(packed, () => snapshotContext.run(header, async () => {
    const target = await calculateDecarbTerciles("absolute", percent / 100);
    const sdg = await calculateSDGGrowthDifferential(percent / 100);
    for (const [prefix, raw] of [["targetTerciles", target], ["sdg", sdg]] as const) {
      assert.equal(raw.length, 1, "Test nonempty output, not vacuous empty-array metadata");
      const api = JSON.parse(JSON.stringify(publicValuationResult(raw)));
      assert.doesNotThrow(() => verifyGordonBaselineRows(api, percent));
      const bound = bindNestedOutput(prefix, api);
      for (const leaf of ["costOfEquity", "gordonBaselineLabel", "gordonDefinition"])
        assert.ok(bound.some(field => field.id === `${prefix}.${leaf}`));
      for (const forbidden of ["impliedTemperature", "impliedCarbonPrice", "impliedDecarbRate"])
        assert.ok(!(forbidden in api[0]));
      assert.equal(api[0].gordonBaselineLabel, gordonBaselineLabel(percent));
      if (prefix === "targetTerciles") {
        assert.ok(Math.abs(api[0].bestImpliedGrowth * 100 - gordonBaselinePct(api[0].bestTercilePE, percent)!) < .0051);
        assert.ok(Math.abs(api[0].worstImpliedGrowth * 100 - gordonBaselinePct(api[0].worstTercilePE, percent)!) < .0051);
      }
      const wb = XLSX.utils.book_new();
      const notes = gordonExportNotes(percent, prefix);
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(notes), "Interpretation");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(semanticRows()
        .filter(row => gordonBaselineSemantics.some(field => field.id === row.Field))), "Field semantics");
      const reopened = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
      const saved = XLSX.utils.sheet_to_json<{ Field: string; Value: string; SemanticField: string }>(reopened.Sheets.Interpretation);
      const definitions = XLSX.utils.sheet_to_json<{ Field: string }>(reopened.Sheets["Field semantics"]);
      for (const note of saved) {
        const leaf = note.SemanticField.slice(prefix.length + 1);
        assert.equal(String(api[0][leaf]), note.Value);
        assert.ok(definitions.some(row => row.Field === note.SemanticField));
        assert.equal(requireOutputSemantic(note.SemanticField).id, note.SemanticField);
      }
    }
  }));
});

const nominal = { baseEarnings: 100, discountRate: .08, returnOnEquity: .2,
  sharesBasis: "total-equity", stageOneGrowth: .06, rateBasis: "nominal",
  returnOnEquityEvidence: "ENGINEERING-ONLY supported ROE fixture",
  discountRateEvidence: "ENGINEERING-ONLY nominal rate fixture" };

test("S11-010 read-only endpoint handler requires explicit inputs and conditional acknowledgement", () => {
  function dispatch(method: string, query: unknown) {
    const result: { status: number; body?: any; headers: Record<string, string> } = { status: 200, headers: {} };
    const response = {
      set(key: string, value: string) { result.headers[key] = value; return this; },
      status(value: number) { result.status = value; return this; },
      json(body: unknown) { result.body = body; return this; },
    };
    originalNominalAssessmentHandler({ method, query } as Request, response as unknown as Response,
      () => assert.fail("Pure handler must not delegate to a collector or another route"));
    return result;
  }
  const query = Object.fromEntries(Object.entries({ ...nominal, acknowledgeConditionalModel: true })
    .map(([key, value]) => [key, String(value)]));
  const valid = dispatch("GET", query);
  assert.equal(valid.status, 200);
  assert.equal(valid.headers["Cache-Control"], "no-store");
  assert.equal(valid.body.rows.length, 4);
  assert.equal(valid.body.productionEligible, false);
  assert.equal(dispatch("POST", query).status, 405);
  assert.equal(dispatch("GET", {}).status, 400);
  assert.equal(dispatch("GET", { ...query, acknowledgeConditionalModel: undefined }).status, 400);
  assert.equal(dispatch("GET", { ...query, discountRate: ["0.08", "0.1"] }).status, 400);
  assert.equal(dispatch("GET", { ...query, rateBasis: "real" }).status, 400);
  assert.equal(dispatch("GET", { ...query, sourceSnapshotId: "do-not-infer-data" }).status, 400);
  assert.equal(dispatch("GET", { ...query, baseEarnings: "-1" }).status, 422);
  const boundary = dispatch("GET", { ...query, discountRate: "0.025" });
  assert.equal(boundary.status, 200);
  assert.ok(boundary.body.rows.every((row: any) => row.status === "refused"));
});

test("S11-010 original nominal 2.5–4% grid has exact years6–15 fade and sustainable reinvestment", () => {
  const assessment = originalNominalEquityAssessment(nominal);
  assert.equal(assessment.status, "conditional-assessment");
  if (assessment.status !== "conditional-assessment") return assert.fail();
  assert.deepEqual(assessment.rows.map(row => row.terminalGrowth), [.025, .03, .035, .04]);
  for (const row of assessment.rows) {
    if (row.status !== "conditional-value") return assert.fail();
    const p = row.projection;
    assert.equal(p.years.length, 15);
    p.years.forEach((year, i) => {
      const expected = i < 5 ? .06 : .06 + (row.terminalGrowth - .06) * (i - 4) / 10;
      assert.ok(Math.abs(year.growth - expected) < 1e-14);
      assert.ok(Math.abs(year.reinvestmentRate * nominal.returnOnEquity - Math.max(0, year.growth)) < 1e-14);
      assert.ok(year.reinvestmentRate >= 0 && year.reinvestmentRate <= 1);
      assert.ok(Math.abs(year.distributed + year.reinvestment - year.earnings) < 1e-12);
    });
    assert.ok(Math.abs(p.years[14].growth - row.terminalGrowth) < 1e-14);
    assert.ok(Math.abs(p.terminalReinvestmentRate * nominal.returnOnEquity - row.terminalGrowth) < 1e-14);
    // Independently accumulate the explicit annual distributions and terminal.
    const expectedPV = p.years.reduce((pv, year) => pv + year.distributed / 1.08 ** year.year, 0)
      + p.terminalCashFlow / (.08 - row.terminalGrowth) / 1.08 ** 15;
    assert.ok(Math.abs(expectedPV - p.equityValue) < 1e-10);
  }
});

test("S11-010 terminal boundaries, unsustainable growth and unsupported nominal assumptions refuse explicitly", () => {
  for (const terminalGrowth of [.02499, .04001])
    assert.throws(() => originalNominalEquityProjection({ ...nominal, terminalGrowth }));
  for (const terminalGrowth of ORIGINAL_NOMINAL_TERMINAL_GRID) {
    const p = originalNominalEquityProjection({ ...nominal, terminalGrowth, stageOneGrowth: terminalGrowth });
    const closed = 100 * (1 + terminalGrowth) * (1 - terminalGrowth / .2) / (.08 - terminalGrowth);
    assert.ok(Math.abs(p.equityValue - closed) < 1e-9);
  }
  const limited = originalNominalEquityAssessment({ ...nominal, discountRate: .035 });
  if (limited.status !== "conditional-assessment") return assert.fail();
  assert.deepEqual(limited.rows.map(row => row.status), ["conditional-value", "conditional-value", "refused", "refused"]);
  const capacity = originalNominalEquityAssessment({ ...nominal, returnOnEquity: .03, stageOneGrowth: .02 });
  if (capacity.status !== "conditional-assessment") return assert.fail();
  assert.deepEqual(capacity.rows.map(row => row.status), ["conditional-value", "conditional-value", "refused", "refused"]);
  for (const input of [
    { ...nominal, rateBasis: "real" }, { ...nominal, returnOnEquityEvidence: "" },
    { ...nominal, discountRateEvidence: undefined }, { ...nominal, baseEarnings: -1 },
  ]) assert.equal(originalNominalEquityAssessment(input).status, "refused");
  const excessive = originalNominalEquityAssessment({ ...nominal, stageOneGrowth: .21 });
  if (excessive.status !== "conditional-assessment") return assert.fail();
  assert.ok(excessive.rows.every(row => row.status === "refused"));
  const negative = equityProjection({ ...nominal, terminalGrowth: .025, stageOneGrowth: -.1 });
  assert.equal(negative.years[0].reinvestment, 0, "negative growth must not invent capital release");
});

test("S11-010 separate original nominal assessment leaves the 1–3% diagnostic and D8 frozen", () => {
  const diagnostic = readFileSync("script/company-valuation-sensitivity.ts", "utf8");
  assert.match(diagnostic, /terminalGrowth of \[\.01, \.02, \.03\]/);
  assert.match(readFileSync("server/financialData/asOfValuation.ts", "utf8"), /costOfEquity: 0\.08, terminalGrowth: 0\.03/);
});
