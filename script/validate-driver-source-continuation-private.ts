/**
 * MANDATORY new original-source validation (not a public *.test.ts file).
 * npx tsx --test script/validate-driver-source-continuation-private.ts
 * Missing original retained files/hash changes fail, never skip/substitute.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { retainedPolicyExposureSnapshot } from "../server/calculation/driverParameterRegistry";

test("MANDATORY original World Bank snapshot produces only a gross rounded descriptive exposure", async () => {
  const x = await retainedPolicyExposureSnapshot();
  assert.equal(x.inputs.reportedMeanPrice, 19);
  assert.equal(x.inputs.coveredFraction, .28);
  assert.equal(x.grossExposureUSDPerTotalTCO2e, 19 * .28);
  assert.equal(x.publisherRoundedGlobalPriceUSDPerTotalTCO2e, 5);
  assert.equal(x.priceBasis.realBaseYear, 2025);
  assert.equal(x.policySnapshotDate, "2025-04-01");
  assert.equal(x.coverageInventoryYear, 2023);
  assert.equal(x.originalRelease.issuedDate, "2025-06-10");
  assert.equal(x.netEffectiveExposureUSDPerTotalTCO2e, null);
  assert.equal(x.exemptionsAdjustment, null);
  assert.equal(x.freeAllocationAdjustment, null);
  assert.equal(x.behaviouralElasticity, null);
  assert.equal(x.parameterDistribution.status, "unavailable");
  assert.equal(x.status, "sensitivity-only");
  assert.equal(x.centralModelEligible, false);
  assert.deepEqual(await retainedPolicyExposureSnapshot(), x);
});
test("MANDATORY original policy exposure rejects central consumption rather than becoming an elasticity", async () => {
  await assert.rejects(retainedPolicyExposureSnapshot("central"), /Central policy consumption blocked/);
});
test("MANDATORY original IRENA detailed source preserves missing countries and rejects total-wind substitution", () => {
  const path = "generated-artifacts/driver-source-continuation/irena-onshore-data.json";
  const bytes = readFileSync(path);
  assert.equal(createHash("sha256").update(bytes).digest("hex"),
    "46033dca04850738f2d1bf6ff0b4dd9da9dc6ab9df5012ae03d58f8d9ec36a41");
  const x = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(x.size, [224, 1, 1, 1, 15]);
  assert.equal(x.dimension.Technology.category.label["5"], "Onshore wind energy");
  assert.equal(x.dimension["Data Type"].category.label["1"], "Electrical Installed Capacity (MW)");
  assert.equal(x.dimension["Grid connection"].category.label["0"], "All");
  assert.deepEqual(Object.values(x.dimension.Year.category.label), Array.from({ length: 15 }, (_, i) => String(2010 + i)));
  assert.equal(x.value.filter((v: unknown) => v === null).length, 1264);
  assert.equal(x.value.filter((v: unknown) => v === 0).length, 16);
  assert.equal(x.updated, "9999-12-31T23:59:59Z"); // Invalid sentinel, not a publication timestamp.
  const regional = JSON.parse(readFileSync("generated-artifacts/driver-source-continuation/irena-capacity-schema.json", "utf8"));
  assert.ok(regional.variables.find((v: { code: string }) => v.code === "Technology").valueTexts.includes("Wind energy"));
  assert.ok(!regional.variables.find((v: { code: string }) => v.code === "Technology").valueTexts.includes("Onshore wind energy"));
});
