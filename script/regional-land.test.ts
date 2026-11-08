import test from "node:test";
import assert from "node:assert/strict";
import { regionalLandUse } from "../server/calculation/regionalLandUse";
test("bookkeeping land-use allocation preserves sinks and reconciles global anchor", () => {
  const models = ["BLUE","OSCAR","LUCE"].map(model => ({
    model, globalMtC: 100, eu27MtC: -10, usMtC: 5, chinaMtC: -3, indiaMtC: 2,
  }));
  const result = regionalLandUse(models, 366.4);
  // Binary floating arithmetic differs by ~1e-14 Mt; use an absolute
  // numerical tolerance, not decimal string identity (see stage report).
  assert.ok(Math.abs(result.cells.find(c=>c.region==="EU27")!.nativeMt + 36.64)<1e-10);
  assert.ok(Math.abs(result.cells.reduce((s,c)=>s+c.nativeMt,0)-366.4)<1e-9);
  assert.equal(result.cells.find(c=>c.region==="International transport")!.nativeMt,0);
  assert.deepEqual(regionalLandUse([...models].reverse(),366.4),result);
  assert.throws(()=>regionalLandUse(models,400),/incompatible/);
  assert.throws(()=>regionalLandUse(models.slice(1),366.4),/three/);
});
