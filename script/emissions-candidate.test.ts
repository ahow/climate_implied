import { test } from "node:test";
import assert from "node:assert/strict";
import { constantScenario as base, illustrativeScenario as transition, projectNativeEmissions as run, candidateInventory } from "../server/calculation/emissionsCandidate";
import { resolveEmissionsInputs } from "../server/calculation/emissionsInputs";
import { HISTORICAL_INDICATORS } from "../server/calculation/historicalIndicators";
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
test("nuclear is separate and energy balances reconcile with growing EV activity", () => {
  const p = run({...base, nuclearGenerationTWh: 2800, annualActivityGrowth: .02,
    annualPowerDemandGrowth: .025, evSalesShare: .2});
  for (const r of p.trajectory) {
    assert.ok(Math.abs(r.power.fossilTWh + r.power.utilizedRenewableTWh +
      r.power.utilizedNuclearTWh - r.power.demandTWh) < 1e-8);
    const t = r.year - 2024;
    assert.ok(Math.abs(r.power.totalEvTWh - r.evFleetShare * 1.02 ** t * base.fullElectricFleetDemandTWh) < 1e-8);
  }
  assert.equal(p.trajectory[0].power.fossilTWh, base.fossilGenerationTWh);
});
test("reversal uses the same baseline-relative road denominator as forward adoption", () => {
  const p = run({...base, reversal: true, evSalesShare: 0, fullElectricFleetDemandTWh: 0});
  const inv = candidateInventory();
  const road = inv.cells.filter(c=>c.gas==="CO2"&&c.sector.startsWith("1.A.3.b")).reduce((a,c)=>a+c.nativeMt/1000,0);
  const a = p.trajectory[0], b = p.trajectory[1];
  const expected = road * (.04-b.evFleetShare)/(1-.04)*base.passengerTransportFraction;
  assert.ok(Math.abs(b.sectorsGtCO2e.transport-a.sectorsGtCO2e.transport-expected)<1e-10);
});
test("sector-specific native gas pathways stop at their declared year, not output horizon", () => {
  const s = {...base, sectorPathways: {agriculture: {
    annualActivityGrowth: .01, residualIntensityImprovement: .002, trendEndYear: 2034,
  }}};
  const p=run(s), short=run(s,2050);
  assert.deepEqual(short.trajectory, p.trajectory.slice(0,27));
  const b=p.trajectory[0].sectorsGtCO2e.agriculture;
  assert.ok(Math.abs(p.trajectory[10].sectorsGtCO2e.agriculture/b-(1.01*.998)**10)<1e-10);
  assert.equal(p.trajectory[10].sectorsGtCO2e.agriculture,p.trajectory[76].sectorsGtCO2e.agriculture);
  assert.ok(p.trajectory[10].nativeMt.CH4>p.trajectory[0].nativeMt.CH4);
});
test("scoped measures affect only eligible native gases and cannot stack duplicates", () => {
  const measure = {id:"test-only",mechanism:"policy" as const,sectorCodes:["3.A.1"],gases:["CH4"],
    coverage:.5,implementation:.8,maximumReduction:.3,startYear:2026,deliveryYears:10,
    evidence:"Synthetic mechanism test; not empirical calibration"};
  const p=run({...base,measures:[measure]});
  const doubled=run({...base,measures:[measure,{...measure,id:"overlapping",mechanism:"corporate"}]});
  assert.deepEqual(p.trajectory,doubled.trajectory);
  assert.equal(p.trajectory[2].nativeMt.CH4,p.trajectory[0].nativeMt.CH4);
  assert.ok(p.trajectory[26].nativeMt.CH4<p.trajectory[0].nativeMt.CH4);
  assert.equal(p.trajectory[26].nativeMt.N2O,p.trajectory[0].nativeMt.N2O);
  assert.equal(p.trajectory[26].nativeMt.CO2,p.trajectory[0].nativeMt.CO2);
  assert.throws(()=>run({...base,measures:[{...measure,coverage:1.1}]}),/Invalid/);
  assert.throws(()=>run({...base,measures:[{...measure,evidence:""}]}),/Invalid/);
  assert.throws(()=>run({...base,measures:[{...measure,sectorCodes:["invented"]}]}),/Unmatched/);
  assert.throws(()=>run({...base,measures:[{...measure,sectorCodes:["1.A.1.a"],gases:["CO2"]}]}),/Power abatement/);
});
test("target proxies never masquerade as delivered policy; dated drivers change candidate identity", () => {
  const input=resolveEmissionsInputs(HISTORICAL_INDICATORS);
  const changed=HISTORICAL_INDICATORS.map(r=>r.year===2024?{...r,renewableCapacityGW:r.renewableCapacityGW+100}:r);
  const next=resolveEmissionsInputs(changed);
  assert.notEqual(run(input.diagnostic).key,run(next.diagnostic).key);
  assert.notEqual(run(input.diagnostic).trajectory[6].reportingGtCO2e,run(next.diagnostic).trajectory[6].reportingGtCO2e);
  // By 2050 both diagnostic cases exhaust fossil power displacement. Extra
  // capacity must not invent negative power emissions merely to stay sensitive.
  assert.equal(run(input.diagnostic).trajectory[26].power.fossilTWh,0);
  assert.equal(run(next.diagnostic).trajectory[26].power.fossilTWh,0);
  assert.equal(input.indicators.find(r=>r.key==="policyImplementationRate")?.role,"context");
  assert.equal(input.readiness.status,"blocked-evidence-required");
  const later=[...HISTORICAL_INDICATORS,{...HISTORICAL_INDICATORS[0],year:2027,renewableCapacityGW:99999}];
  assert.deepEqual(resolveEmissionsInputs(later),input);
  assert.throws(()=>resolveEmissionsInputs([]),/dated/);
  assert.throws(()=>resolveEmissionsInputs(HISTORICAL_INDICATORS.map(r=>({...r,evSalesSharePct:NaN}))),/Invalid dated/);
});
