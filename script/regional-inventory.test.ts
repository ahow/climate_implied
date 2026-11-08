import test from "node:test";
import assert from "node:assert/strict";
import { regionForCountry, aggregateRegionalInventory, reconcileRegionalInventory } from "../server/calculation/regionalInventory";
test("regions cover EU27 and named countries without assigning UK to EU", () => {
  assert.equal(regionForCountry("DEU"), "EU27");
  assert.equal(regionForCountry("GBR"), "Rest of World");
  assert.equal(regionForCountry("USA"), "US");
  assert.equal(regionForCountry("CHN"), "China");
  assert.equal(regionForCountry("IND"), "India");
  assert.equal(regionForCountry("AIR"), "International transport");
  assert.equal(regionForCountry("SEA"), "International transport");
  assert.throws(() => regionForCountry(""));
});
test("native accounting preserves signed adjustments and never makes missing observations zero", () => {
  const rows = [
    { country: "USA", sector: "x", gas: "CH4", nativeMt: 2 },
    { country: "USA", sector: "x", gas: "CH4", nativeMt: -.1 },
    { country: "CHN", sector: "x", gas: "CH4", nativeMt: 3 },
  ];
  const cells = aggregateRegionalInventory(rows);
  assert.equal(cells.find(c => c.region === "US")?.nativeMt, 1.9);
  assert.deepEqual(cells, aggregateRegionalInventory([...rows].reverse()));
  assert.equal(reconcileRegionalInventory(cells, [{ gas: "CH4", sector: "x", nativeMt: 4.9 }]).passed, true);
  assert.equal(reconcileRegionalInventory(cells, [{ gas: "CH4", sector: "x", nativeMt: 5 }]).passed, false);
  assert.throws(() => aggregateRegionalInventory([{ ...rows[0], nativeMt: NaN }]));
});
