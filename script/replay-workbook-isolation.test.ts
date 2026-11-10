import test from "node:test";
import assert from "node:assert/strict";
import { packDataset } from "../server/snapshots/contract";
import { loadSnapshot, runWithReplayWorkbook, type SnapshotHeader } from "../server/snapshots/store";

function fixture(marketCap = 500) {
  const companies = [{ id: 2, isin: "ENGINEERING-ONLY", name: "Replay isolation fixture",
    geography: null, sector: null, subSector: null, industry: null,
    sdgAlignmentScore: null, emissionTarget2050: null }];
  const timeSeries = [{ id: 3, companyId: 2, date: new Date("2024-01-01T00:00:00Z"),
    totalReturnIndex: 100, marketCap, priceEarnings: 10, scope1Emissions: 0,
    scope2Emissions: null, scope3Emissions: null, netProfit: 50 }];
  const packed = packDataset(companies, timeSeries);
  const header = { id: packed.id, companyCount: 1, observationCount: 1 } as SnapshotHeader;
  return { packed, header };
}

test("private replay validates once, detaches caller chunks, and returns independent rows/dates", async () => {
  const { packed, header } = fixture();
  await runWithReplayWorkbook(packed, async () => {
    // Mutating caller-owned bytes after entry cannot alter the validated scope.
    const chunk = packed.chunks.find(c => c.entity === "timeSeries")!;
    (chunk.rows[0] as { marketCap: number }).marketCap = 999;
    const first = await loadSnapshot(header);
    assert.equal(first.timeSeries[0].marketCap, 500);
    first.companies[0].name = "consumer mutation";
    first.timeSeries[0].marketCap = 0;
    first.timeSeries[0].date.setUTCFullYear(2099);
    const second = await loadSnapshot(header);
    assert.equal(second.companies[0].name, "Replay isolation fixture");
    assert.equal(second.timeSeries[0].marketCap, 500);
    assert.equal(second.timeSeries[0].date.toISOString(), "2024-01-01T00:00:00.000Z");
  });
  assert.throws(() => runWithReplayWorkbook(packed, () => null), /hash mismatch/);
});

test("concurrent and nested private replay scopes never reuse another selection", async () => {
  const a = fixture(500), b = fixture(700);
  await Promise.all([a, b].map(({ packed, header }, index) =>
    runWithReplayWorkbook(packed, async () => {
      await new Promise(resolve => setImmediate(resolve));
      assert.equal((await loadSnapshot(header)).timeSeries[0].marketCap, index ? 700 : 500);
      await assert.rejects(loadSnapshot(index ? a.header : b.header), /selection mismatch/);
    })));
  await runWithReplayWorkbook(a.packed, async () => {
    await runWithReplayWorkbook(b.packed, async () => {
      assert.equal((await loadSnapshot(b.header)).timeSeries[0].marketCap, 700);
    });
    assert.equal((await loadSnapshot(a.header)).timeSeries[0].marketCap, 500);
    await assert.rejects(loadSnapshot({ ...a.header, observationCount: 2 }), /population mismatch/);
  });
});
