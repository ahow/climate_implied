import test from "node:test";
import assert from "node:assert/strict";
import { fieldSemantics,semanticRows } from "../shared/fieldSemantics";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";
test("core field semantics retain input/calculation/output units, formula and as-of distinctions",()=>{
  assert.equal(new Set(fieldSemantics.map(f=>f.field)).size,fieldSemantics.length);
  assert.ok(fieldSemantics.every(f=>f.formula&&f.unit&&f.source&&f.vintage&&f.asOf));
  assert.deepEqual(new Set(fieldSemantics.map(f=>f.role)),new Set(["Input","Calculated","Output"]));
  assert.equal(semanticRows().length,fieldSemantics.length);
  assert.match(fieldSemantics.find(f=>f.field==="carbonIntensity")!.unit,/market cap/);
});
test("22 retained driver histories have deterministic provenance without invented publication dates",()=>{
  const rows=driverEvidenceRegistry();
  assert.equal(rows.length,22);
  assert.deepEqual(rows,driverEvidenceRegistry());
  for(const row of rows) {
    assert.match(row.sourceProvenance.retainedInputHash,/^[a-f0-9]{64}$/);
    assert.ok(row.sourceProvenance.recordCount>0);
    assert.equal(row.informationAvailableAt,null);
    assert.equal(row.centralModelEligible,false);
    assert.match(row.vintage,/retained-curated-history/);
  }
});
