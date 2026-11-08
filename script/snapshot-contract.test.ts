import test from "node:test";
import assert from "node:assert/strict";
import { packDataset, unpackDataset } from "../server/snapshots/contract";

const companies = [{ id: 2, isin: "DE000BAY0017", name: "Fixture", geography: null,
  sector: null, subSector: null, industry: null, sdgAlignmentScore: null, emissionTarget2050: null }];
const rows = [{ id: 3, companyId: 2, date: new Date("2024-01-01T00:00:00Z"),
  totalReturnIndex: 100, marketCap: 500, priceEarnings: 10, scope1Emissions: 0,
  scope2Emissions: null, scope3Emissions: null, netProfit: 50 }];
test("snapshot roundtrip preserves null/zero and native date identity", () => {
  const packed = packDataset(companies, rows);
  const restored = unpackDataset(packed.id, packed.chunks);
  assert.deepEqual(restored, { companies, timeSeries: rows });
  assert.equal(packDataset(companies, rows).id, packed.id);
  assert.equal(packDataset([...companies].reverse(), [...rows].reverse()).id, packed.id);
  assert.notEqual(packDataset(companies, [{ ...rows[0], marketCap: 600 }]).id, packed.id);
});
test("snapshots reject corruption, duplicate cells and orphan company observations", () => {
  const packed = packDataset(companies, rows);
  assert.throws(() => unpackDataset("0".repeat(64), packed.chunks));
  assert.throws(() => packDataset(companies, [rows[0], rows[0]]));
  assert.throws(() => packDataset([], rows));
});
