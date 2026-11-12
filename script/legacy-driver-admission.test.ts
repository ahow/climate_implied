import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { calculateEmissionsTrajectory, getCurrentIndicators } from "../server/calculation/forwardProjection";
import { legacyCoefficientAdmission, assertLegacyComparatorUse } from "../server/calculation/legacyDriverAdmission";

test("actual legacy calculator refuses central/sensitivity use before touching indicators", () => {
  const unreadable = new Proxy({}, { get() { throw new Error("indicator-read"); } });
  for (const use of [{mode:"central"}, {mode:"sensitivity"}, {mode:"accepted-forecast"},
    {mode:"legacy-diagnostic", centralModelEligible:true}, null, {}]) {
    assert.throws(() => calculateEmissionsTrajectory(unreadable as any, 2024, 2025, 1, 1, use as any),
      /diagnostic-only/, "role/admission request must fail before coefficient consumption");
  }
});

test("explicit diagnostic mode preserves actual seeded legacy equations and every coefficient has a role", () => {
  const input = getCurrentIndicators();
  const implicit = calculateEmissionsTrajectory(input, 2024, 2026, 4, 77);
  const explicit = calculateEmissionsTrajectory(input, 2024, 2026, 4, 77, {mode:"legacy-diagnostic"});
  assert.deepEqual(explicit, implicit, "no numerical baseline or calibration change");
  const rows = legacyCoefficientAdmission();
  const source = ts.createSourceFile("forwardProjection.ts", readFileSync("server/calculation/forwardProjection.ts","utf8"), ts.ScriptTarget.Latest, true);
  const contract = source.statements.find(s=>ts.isInterfaceDeclaration(s)&&s.name.text==="IndicatorData") as ts.InterfaceDeclaration;
  assert.deepEqual(rows.map(r=>r.field).sort(),contract.members.map(m=>m.name!.getText(source)).sort(),
    "every actual indicator parameter requires an explicit classification");
  assert.equal(rows.length, 19);
  assert.equal(new Set(rows.map(r=>r.field)).size,19);
  assert.ok(rows.every(r=>r.centralModelEligible===false));
  assert.equal(rows.find(r=>r.field==="co2GrowthRatePpm")!.role,"validation-target");
  assert.equal(rows.find(r=>r.field==="greenBondIssuanceBln")!.role,"context");
  assertLegacyComparatorUse({mode:"legacy-diagnostic"});
});
