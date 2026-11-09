import { test } from "node:test";
import assert from "node:assert/strict";
import { compareValuationModels } from "../server/calculation/valuationComparison";

function fixture() {
  return { protocolId: "a".repeat(64), evidenceMode: "revised-history", evaluationAsOf: "2026-12-31",
    blockLength: 3, bootstrapReplications: 500, seed: 19,
    rows: Array.from({ length: 8 }, (_, y) => Array.from({ length: 12 }, (_, i) => ({
      companyId: String(i), origin: `${2010 + y}-12-31`, outcomeAvailableAt: `${2014 + y}-03-31`,
      cashFlowHorizonYears: 3, cashFlowBasis: "FCFE", currency: "USD",
      actualCashFlowGrowth: i / 100, gordonCashFlowGrowth: i / 100 + .2,
      dcfCashFlowGrowth: i / 100 + .01, gordonSignal: -i, dcfSignal: i, validationReturn: i / 10,
    }))).flat() };
}
test("D8 uses paired common-sample MAE and IC and is order invariant", () => {
  const p = fixture(), result = compareValuationModels(p);
  assert.equal(result.status, "evaluated");
  if (result.status !== "evaluated") return;
  assert.equal(result.passesNumericalGate, true);
  assert.ok(Math.abs(result.forecastMAEImprovement - .19) < 1e-12);
  assert.equal(result.signalICImprovement, 2);
  assert.equal(result.automaticPromotionAllowed, false);
  const reversed = compareValuationModels({ ...p, rows: [...p.rows].reverse() });
  // Input lineage records caller order; numerical output does not.
  assert.deepEqual({ ...result, inputHash: "" }, { ...reversed, inputHash: "" });
});
test("D8 requires both strict improvements; tied IC cannot pass", () => {
  const p = fixture();
  p.rows.forEach(r => { r.gordonSignal = r.dcfSignal; });
  const result = compareValuationModels(p);
  assert.equal(result.status, "evaluated");
  if (result.status === "evaluated") assert.equal(result.passesNumericalGate, false);
});
test("D8 refuses duplicates, premature outcomes, short samples and unidentified IC", () => {
  const p = fixture();
  assert.throws(() => compareValuationModels({ ...p, rows: [...p.rows, p.rows[0]] }), /Duplicate/);
  assert.throws(() => compareValuationModels({ ...p, rows: [{ ...p.rows[0], outcomeAvailableAt: "2011-12-31" }] }), /three-year/);
  assert.equal(compareValuationModels({ ...p, rows: p.rows.slice(0, 20) }).status, "unavailable");
  assert.equal(compareValuationModels({ ...p, rows: p.rows.map(r => ({ ...r, dcfSignal: 1 })) }).status, "unavailable");
});
test("D8 excludes missing and unavailable outcomes from both models and counts coverage", () => {
  const p = fixture();
  const result = compareValuationModels({ ...p, rows: p.rows.map((r, i) =>
    i === 0 ? { ...r, dcfCashFlowGrowth: null } : i === 1 ? { ...r, outcomeAvailableAt: "2027-01-01" } : r) });
  assert.deepEqual(result.coverage, { supplied: 96, incomplete: 1, notYetAvailable: 1, completeAvailable: 94 });
  assert.equal(result.status, "evaluated");
});
