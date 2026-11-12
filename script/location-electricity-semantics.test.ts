import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { locationElectricityCashBridgeSchema, calculateLocationElectricityCashBridge }
  from "../server/calculation/locationElectricityCashBridge";
import { locationElectricitySemantics } from "../shared/locationElectricitySemantics";
import { requireOutputSemantic, bindNestedOutput } from "../shared/outputFieldSemantics";

function schemaPaths(schema: z.ZodTypeAny, prefix = ""): string[] {
  if (schema instanceof z.ZodObject)
    return Object.entries(schema.shape).flatMap(([key, value]) =>
      schemaPaths(value as z.ZodTypeAny, prefix ? `${prefix}.${key}` : key));
  if (schema instanceof z.ZodArray) return schemaPaths(schema.element, `${prefix}[]`);
  return [prefix];
}
test("every actual optional electricity input schema leaf has exact registered semantics", () => {
  const paths = schemaPaths(locationElectricityCashBridgeSchema);
  const definitions = locationElectricitySemantics.filter(s => s.role === "Input");
  assert.deepEqual(definitions.map(s => s.id.replace("companyProjection.locationElectricity.", "")).sort(), paths.sort());
  for (const definition of definitions) {
    assert.equal(requireOutputSemantic(definition.id), definition);
    for (const [key, value] of Object.entries(definition)) {
      if (typeof value === "string") assert.ok(value.trim(), `${definition.id}.${key}`);
    }
  }
});
test("actual executed electricity output binds every leaf including evidence, null-free signed cash and empty assumptions", () => {
  // Explicit synthetic engineering control, never a production source fallback.
  const source = { id: "synthetic", url: "https://example.invalid/control", sha256: "a".repeat(64),
    locator: "synthetic-only", observedAt: "2025-01-02T00:00:00Z", availableAt: "2025-01-01T00:00:00Z" };
  const measure = (value: number) => ({ value, basis: "source-fact" as const, source,
    rationale: "Synthetic schema coverage only", bounds: { minimum: value, maximum: value } });
  const price = (value: number) => ({ ...measure(value), unit: "major-currency/MWh", currency: "USD",
    year: 2025, kind: "issuer-contract", supplier: "SYNTHETIC", tariff: "SYNTHETIC" });
  const result = calculateLocationElectricityCashBridge({
    companyId: "SYNTHETIC", year: 2025, currency: "USD", cutoff: "2025-02-01T00:00:00Z",
    expenseBasis: "incremental-above-electricity-expense-in-baseline",
    workingCapitalBasis: "electricity-increment-excluded-from-baseline-working-capital",
    scope2DirectTax: false, locations: [{
      id: "SYNTHETIC", companyId: "SYNTHETIC", jurisdiction: "SYNTHETIC", operatingStatus: "operating",
      locationSource: source, applicabilitySource: source, supplier: "SYNTHETIC", tariff: "SYNTHETIC",
      purchasedElectricity: { ...measure(100), unit: "MWh", year: 2025 },
      baselinePrice: price(70), scenarioPrice: price(50),
      customerRecoveryFraction: measure(.4), supplierPaymentFraction: measure(.75),
      customerCollectionFraction: measure(.25),
    }],
  });
  const bindings = bindNestedOutput("companyProjection.electricityPriceBridge", result);
  assert.ok(bindings.length > 100);
  assert.equal(result.totals.preTaxCashImpact, 1300);
  assert.deepEqual(result.locations[0].conditionalInputs, []);
  assert.equal(requireOutputSemantic("companyProjection.electricityPriceBridge.locations[].evidence.quantity.value").unit, "MWh/year");
  assert.match(requireOutputSemantic("companyProjection.electricityPriceBridge.integration.recomputeCompanyCashTax").formula, /max\(0/);
  assert.throws(() => bindNestedOutput("companyProjection.electricityPriceBridge", { unknown: 1 }), /Unmapped/);
});
