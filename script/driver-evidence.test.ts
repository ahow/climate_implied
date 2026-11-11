import test from "node:test";
import assert from "node:assert/strict";
import { driverEvidenceRegistry, interpolateInterior } from "../server/calculation/driverEvidence";
import { adaptLegacyDriverRole, assertCuratedForecastUse, driverRoleSchema } from "../shared/driverAdmission";
import { resolveEmissionsInputs } from "../server/calculation/emissionsInputs";
import { HISTORICAL_INDICATORS } from "../server/calculation/historicalIndicators";
import { projectNativeEmissions } from "../server/calculation/emissionsCandidate";
test("driver registry accounts for all indicators without inventing calibration", () => {
  const rows = driverEvidenceRegistry();
  assert.equal(rows.length, 22);
  assert.equal(new Set(rows.map(r => r.id)).size, rows.length);
  assert.ok(rows.every(r => r.reason && r.publisher && r.rawUnit && !r.centralModelEligible));
  assert.equal(rows.find(r => r.id === "policyImplementationRate")?.role, "context");
});
test("all 22 use one canonical role vocabulary without conferring forecast admission", () => {
  const registry = driverEvidenceRegistry(), native = resolveEmissionsInputs();
  for (const row of registry) {
    const input = native.indicators.find(i => i.key === row.id)!;
    assert.equal(row.role, input.role);
    assert.equal(driverRoleSchema.parse(row.role), row.role);
    assert.equal(input.centralModelEligible, false);
    assert.throws(() => assertCuratedForecastUse(row), /Central consumption blocked|mechanism-input role/);
  }
  assert.equal(registry.filter(r => r.role === "mechanism-input").length, 6);
  assert.deepEqual(native.indicators.filter(i => i.diagnosticConsumed).map(i => i.key).sort(),
    ["evSalesSharePct", "renewableCapacityGW"]);
  assert.deepEqual(adaptLegacyDriverRole("candidate-mechanism-input"), {
    role: "mechanism-input", legacyRole: "candidate-mechanism-input", eligibilityTransferred: false,
  });
  assert.equal(adaptLegacyDriverRole("validation").role, "validation-target");
});
test("context and validation observations cannot change the native diagnostic trajectory", () => {
  const base = resolveEmissionsInputs();
  const expected = projectNativeEmissions(base.diagnostic, 2026).trajectory;
  for (const input of base.indicators.filter(i => !i.diagnosticConsumed)) {
    const history = structuredClone(HISTORICAL_INDICATORS);
    for (const row of history) row[input.key] = row[input.key] * 2 + 1;
    assert.deepEqual(projectNativeEmissions(resolveEmissionsInputs(history).diagnostic, 2026).trajectory, expected);
  }
  const result = projectNativeEmissions(base.diagnostic, 2026);
  assert.equal(result.use, "diagnostic");
  assert.equal(result.centralConsumptionAllowed, false);
  assert.equal(result.productionEligible, false);
});
test("missingness interpolation preserves observed zeros and refuses extrapolation", () => {
  const rows = [{ year: 2020, value: 0 }, { year: 2021, value: null }, { year: 2022, value: 4 }];
  assert.equal(interpolateInterior(rows, 2020).value, 0);
  assert.equal(interpolateInterior(rows, 2021).value, 2);
  assert.equal(interpolateInterior(rows, 2021).infilled, true);
  assert.equal(interpolateInterior(rows, 2019).value, null);
  assert.throws(() => interpolateInterior([{ year: 2020, value: NaN }], 2020));
});
