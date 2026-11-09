import test from "node:test";
import assert from "node:assert/strict";
import { ADDITIONAL_GASES, auditMinorGasHistory, minorGasSensitivityHistory } from "../server/calculation/minorGasHistory";
const fixture = () => ADDITIONAL_GASES.map(Substance => ({ Substance, Country_code_A3: "TST",
  ipcc_code_2006_for_standard_report: "2.F",
  ...Object.fromEntries(Array.from({ length: 55 }, (_, i) => [`Y_${1970 + i}`, .01])) }));
test("source gaps remain missing, not observed zero", () => {
  const rows: any[] = fixture(); rows[1].Y_2020 = null;
  const audit = auditMinorGasHistory(rows);
  assert.equal(audit.gases["HFC-134"][50].valueMt, null);
  assert.equal(audit.gases["HFC-134"][50].missingCells.length, 1);
  const zero = minorGasSensitivityHistory(rows, "zero-missing", "https://example.org/source");
  const carry = minorGasSensitivityHistory(rows, "carry-forward", "https://example.org/source");
  assert.equal(zero.gases["HFC-134"][270], 0);
  assert.equal(carry.gases["HFC-134"][270], .00001);
  assert.equal(carry.source.observedHistoryComplete, false);
  assert.equal(carry.productionEligible, false);
  rows[1].Y_2019 = 0;
  const stress = minorGasSensitivityHistory(rows, "historical-peak-stress", "https://example.org/source");
  assert.equal(stress.gases["HFC-134"][270], .00001);
  assert.equal(minorGasSensitivityHistory(rows, "carry-forward", "https://example.org/source").gases["HFC-134"][270], 0);
});
test("minor-gas history rejects duplicates, absent species and invalid cells", () => {
  assert.throws(() => auditMinorGasHistory([...fixture(), fixture()[0]]), /Duplicate/);
  assert.throws(() => auditMinorGasHistory(fixture().slice(1)), /Missing/);
  assert.throws(() => auditMinorGasHistory(fixture().map(r => ({ ...r, Y_2020: -1 }))), /Invalid/);
});
