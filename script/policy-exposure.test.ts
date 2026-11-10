import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePolicyExposure } from "../server/calculation/driverParameterRegistry";

// Explicit synthetic engineering values, not publisher data or a calibrated prior.
const fixture = {
  scope: "synthetic-engineering-scope",
  priceSnapshotDate: "2025-04-01", coverageSnapshotDate: "2025-04-01", coverageInventoryYear: 2023,
  reportedMeanPrice: 20, coveredFraction: .5,
  priceDenominator: "covered-emissions", coverageDenominator: "same-scope-total-GHG",
  priceCurrency: "USD", realPriceBaseYear: 2025,
  priceSourceId: "synthetic-source", coverageSourceId: "synthetic-source",
  sourceValuesRounded: true, exemptionsAdjustment: null, freeAllocationAdjustment: null,
};
test("synthetic policy accounting is deterministic, preserves unknowns and does not invent a distribution", () => {
  const a = evaluatePolicyExposure(fixture);
  assert.deepEqual(evaluatePolicyExposure(fixture), a);
  assert.equal(a.grossExposureUSDPerTotalTCO2e, 10);
  assert.equal(a.netEffectiveExposureUSDPerTotalTCO2e, null);
  assert.equal(a.exemptionsAdjustment, null);
  assert.equal(a.freeAllocationAdjustment, null);
  assert.equal(a.behaviouralElasticity, null);
  assert.equal(a.parameterDistribution.status, "unavailable");
  assert.equal(a.status, "sensitivity-only");
});
test("synthetic policy gate rejects central use, wrong weighting/basis, substituted sources and snapshot mismatch", () => {
  assert.throws(() => evaluatePolicyExposure(fixture, "central"), /Central policy consumption blocked/);
  assert.throws(() => evaluatePolicyExposure({ ...fixture, priceDenominator: "global-emissions" }));
  assert.throws(() => evaluatePolicyExposure({ ...fixture, coveredFraction: 28 }));
  assert.throws(() => evaluatePolicyExposure({ ...fixture, priceCurrency: "EUR" }));
  assert.throws(() => evaluatePolicyExposure({ ...fixture, coverageSourceId: "incompatible-source" }), /compatible/);
  assert.throws(() => evaluatePolicyExposure({ ...fixture, coverageSnapshotDate: "2024-04-01" }), /compatible/);
  assert.throws(() => evaluatePolicyExposure({ ...fixture, priceSnapshotDate: "2025-02-31",
    coverageSnapshotDate: "2025-02-31" }), /compatible/);
  assert.throws(() => evaluatePolicyExposure({ ...fixture, exemptionsAdjustment: 0 }));
});
test("synthetic scope-total accounting keeps zero distinct from unknown and currency base explicit", () => {
  const zero = evaluatePolicyExposure({ ...fixture, coveredFraction: 0 });
  assert.equal(zero.grossExposureUSDPerTotalTCO2e, 0);
  assert.equal(zero.netEffectiveExposureUSDPerTotalTCO2e, null);
  assert.equal(zero.priceBasis.realBaseYear, 2025);
  assert.throws(() => evaluatePolicyExposure({ ...fixture, coverageInventoryYear: 2026 }), /compatible/);
});
