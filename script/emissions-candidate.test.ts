import { test } from "node:test";
import assert from "node:assert/strict";
import { constantScenario as base, illustrativeScenario as transition, projectNativeEmissions as run, candidateInventory } from "../server/calculation/emissionsCandidate";
test("source gas/sector inventory reconciles to reporting total within rounding", () => {
  const inv = candidateInventory(), path = run(base);
  assert.ok(Math.abs(path.trajectory[0].reportingGtCO2e - 56.8) < .05);
  for (const row of path.trajectory) {
    assert.ok(Math.abs(Object.values(row.sectorsGtCO2e).reduce((a,b)=>a+b,0) - row.reportingGtCO2e) < 1e-10);
    assert.ok(Object.values(row.nativeMt).every(n => n >= 0));
    assert.ok(Math.abs(row.nativeMt.CO2-row.co2FossilMt-row.co2LandUseMt)<1e-8);
  }
  assert.equal(inv.year, 2024); assert.equal(path.temperature, null);
});
test("all scenarios share the observed starting emissions; no horizon dependence", () => {
  const a=run(base), b=run(transition), short=run(transition,2050);
  assert.deepEqual(a.trajectory[0].nativeMt,b.trajectory[0].nativeMt);
  assert.deepEqual(b.trajectory.slice(0,27),short.trajectory);
  assert.deepEqual(b,run(transition));
});
test("annual activity compounds independently of horizon",()=>{
  const path=run({...base,annualActivityGrowth:.02},2026);
  const industry=path.trajectory.map(r=>r.sectorsGtCO2e.industry);
  // Non-CO2 does not follow the economic proxy. Compare native CO2 by removal
  // of constant non-CO2 industry contribution via first/second differences.
  assert.ok(Math.abs((industry[2]-industry[1])/(industry[1]-industry[0])-1.02)<1e-9);
});
test("policy zero, direction, lag, boundedness and complete-overlap rule",()=>{
  const s={...base,maximumAbatement:.4,policyImplementation:1,incrementalPolicyCoverage:.6};
  const a=run(s), zero=run({...s,incrementalPolicyCoverage:0});
  assert.equal(a.trajectory[2].reportingGtCO2e,zero.trajectory[2].reportingGtCO2e);
  assert.ok(a.trajectory[76].reportingGtCO2e<zero.trajectory[76].reportingGtCO2e);
  const overlap=run({...s,corporateCoverage:.6,corporateDelivery:1});
  assert.deepEqual(a.trajectory,overlap.trajectory);
});
test("EV bounded adoption, lag, reversal guard and power accounting",()=>{
  const p=run(transition);
  for(let i=1;i<p.trajectory.length;i++){
    const a=p.trajectory[i-1],b=p.trajectory[i];
    assert.ok(b.evSalesShare>=a.evSalesShare && b.evSalesShare<=1);
    assert.ok(b.evFleetShare<b.evSalesShare);
    assert.ok(Math.abs(b.power.fossilTWh+b.power.utilizedRenewableTWh-b.power.demandTWh)<1e-8);
  }
  assert.throws(()=>run({...base,evLogitGrowth:-.1}),/reversal/);
  assert.throws(()=>run({...base,evSalesShare:0}),/reversal/);
  assert.throws(()=>run({...base,policyImplementation:1.1}),/fraction/);
  assert.throws(()=>run({...base,renewableAdditionsGW:NaN}),/Non-finite/);
});
test("reversal is deliberate, finite, and never replaces the fleet instantly",()=>{
  const path=run({...base,reversal:true,evLogitGrowth:-.02,evSalesShare:.02});
  assert.equal(path.trajectory[0].evFleetShare,.04);
  assert.ok(path.trajectory[1].evFleetShare>.02);
  assert.ok(path.trajectory[76].evFleetShare<.04);
  assert.ok(path.trajectory.every(r=>Number.isFinite(r.reportingGtCO2e)&&r.reportingGtCO2e>0));
});
test("EV electricity raises power emissions once and only when fossil generation is needed",()=>{
  const noPowerDemand=run({...base,evSalesShare:1,fullElectricFleetDemandTWh:0});
  const electricDemand=run({...base,evSalesShare:1});
  const i=26;
  assert.ok(electricDemand.trajectory[i].sectorsGtCO2e.power>noPowerDemand.trajectory[i].sectorsGtCO2e.power);
  assert.equal(electricDemand.trajectory[i].sectorsGtCO2e.transport,noPowerDemand.trajectory[i].sectorsGtCO2e.transport);
  assert.ok(electricDemand.trajectory[i].sectorsGtCO2e.transport<electricDemand.trajectory[0].sectorsGtCO2e.transport);
});
