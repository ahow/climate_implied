import { test } from "node:test";
import assert from "node:assert/strict";
import { candidateInventory, constantScenario, projectInventoryEmissions } from "../server/calculation/emissionsCandidate";

const cells = candidateInventory().cells;
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b)), `${a} != ${b}`);

test("S05-009 renewable surplus cannot displace nuclear or ineligible native cells", () => {
  // Deliberate boundary inputs, not a calibration or a production ensemble.
  const scenario = { ...constantScenario, nuclearGenerationTWh: 2800 };
  const control = projectInventoryEmissions(scenario, 2100, cells, true);
  const surplus = projectInventoryEmissions({ ...scenario, renewableAdditionsGW: 100000 }, 2100, cells, true);
  surplus.trajectory.forEach((r, t) => {
    const baseline = control.trajectory[t];
    close(r.power.demandTWh, baseline.power.demandTWh);
    close(r.power.utilizedNuclearTWh, baseline.power.utilizedNuclearTWh);
    const displaced = baseline.power.fossilTWh - r.power.fossilTWh;
    assert.ok(displaced >= 0 && displaced <= baseline.power.fossilTWh);
    close(r.power.utilizedRenewableTWh - baseline.power.utilizedRenewableTWh, displaced);
    close(r.power.fossilTWh + r.power.utilizedRenewableTWh + r.power.utilizedNuclearTWh, r.power.demandTWh);
    if (t > 0) {
      assert.equal(r.power.fossilTWh, 0);
      assert.ok(r.power.renewableTWh > r.power.utilizedRenewableTWh);
    }
    cells.forEach((c, i) => {
      if (c.gas === "CO2" && c.sector === "1.A.1.a") {
        assert.ok(r.nativeCellsMt![i] >= 0 && r.nativeCellsMt![i] <= baseline.nativeCellsMt![i]);
        close(r.nativeCellsMt![i], c.nativeMt * r.power.fossilTWh / scenario.fossilGenerationTWh);
      } else assert.equal(r.nativeCellsMt![i], baseline.nativeCellsMt![i]);
    });
  });
});

test("S05-009 maximal EV tailpipe displacement reaches zero road CO2, never negative transport", () => {
  const scenario = { ...constantScenario, evSalesShare: 1, fleetTurnover: 1,
    passengerTransportFraction: 1, evTailpipeReduction: 1 };
  const control = projectInventoryEmissions(constantScenario, 2100, cells, true);
  const electric = projectInventoryEmissions(scenario, 2100, cells, true);
  let roadCells = 0;
  electric.trajectory.forEach((r, t) => {
    assert.ok(Number.isFinite(r.sectorsGtCO2e.transport) && r.sectorsGtCO2e.transport >= 0);
    cells.forEach((c, i) => {
      if (!c.sector.startsWith("1.A.3")) return;
      assert.ok(Number.isFinite(r.nativeCellsMt![i]) && r.nativeCellsMt![i] >= 0);
      if (c.gas === "CO2" && c.sector.startsWith("1.A.3.b")) {
        if (t > 0) assert.equal(r.nativeCellsMt![i], 0);
        else roadCells++;
      } else assert.equal(r.nativeCellsMt![i], control.trajectory[t].nativeCellsMt![i]);
    });
    close(r.power.totalEvTWh, r.evFleetShare * scenario.fullElectricFleetDemandTWh);
    close(r.power.fossilTWh + r.power.utilizedRenewableTWh + r.power.utilizedNuclearTWh, r.power.demandTWh);
  });
  assert.ok(roadCells > 0, "must exercise authentic inventory road cells");
});
