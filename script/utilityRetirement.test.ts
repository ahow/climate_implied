import test from "node:test";
import assert from "node:assert/strict";
import { calculateUtilityRetirement, invertUtilityRetirement, freezeUtilityRetirement, type RetirementInput } from "../server/calculation/utilityRetirement";
function fixture():RetirementInput {
  return {issuer:"engineering-only",currency:"USD",basis:"unit-unlevered",fiscal:"calendar",startYear:2024,endYear:2026,
    discountRate:.1,terminalValue:0,cutoff:"2024-01-01T00:00:00Z",assumptionId:"synthetic-predeclared",
    sources:[{id:"fixture",publishedAt:"2023-12-01T00:00:00Z",locator:"isolated engineering fixture",sha256:"a".repeat(64)}],
    cashConvention:"energy-revenue-excludes-separate-capital-recovery",
    recoveryBasis:"cash-collections-not-book-amortization",decommissioningBasis:"payments-not-provision",
    units:[{id:"one",legalEntity:"engineering-only",site:"fixture",fullUnitNetMW:100,ownership:.5,announcedYear:2025,
      legallyCommittedLatestYear:2026,retirementYear:2025,unrecoveredBookValue:50,decommissioningCash:10,
      decommissioningPaymentYear:2026,sourceIds:["fixture"],
      years:[2024,2025,2026].map(year=>({year,capacityFactor:year===2024?.5:0,priceUsdMWh:100,
        variableCostUsdMWh:20,fixedOpex:year===2024?1:0,maintenanceCapex:year===2024?2:0,
        replacementPowerCash:year===2024?0:4,replacementCapex:0,cashTaxes:1,deltaWorkingCapital:0,
        recoveryCash:year===2026?20:0}))}]};
}
test("shared ownership, leap-year MWh and hand cash reconciliation without book-value deduction",()=>{
  const r=calculateUtilityRetirement(fixture());
  assert.equal(r.rows[0].grossGenerationMWh,439200);
  assert.equal(r.rows[0].ownedGenerationMWh,219600);
  assert.ok(Math.abs(r.rows[0].grossCashFlow-31.136)<1e-12);
  assert.equal(r.rows[1].ownedCashFlow,-2.5);
  assert.equal(r.rows[2].ownedCashFlow,2.5);
  assert.ok(Math.abs(r.valueUsdMillion-(15.568/1.1-2.5/1.1**2+2.5/1.1**3))<1e-12);
  const b=fixture();b.units[0].unrecoveredBookValue=1000;
  assert.equal(calculateUtilityRetirement(b).valueUsdMillion,r.valueUsdMillion);
  assert.equal(r.commonEquityValue,null);
});
test("liability and recovery timing each change PV once",()=>{
  const b=fixture(), base=calculateUtilityRetirement(b);
  b.units[0].decommissioningPaymentYear=2025;
  assert.ok(calculateUtilityRetirement(b).valueUsdMillion<base.valueUsdMillion);
  b.units[0].years[1].recoveryCash=20;b.units[0].years[2].recoveryCash=0;
  assert.ok(calculateUtilityRetirement(b).valueUsdMillion>base.valueUsdMillion);
});
test("exact discrete roots, nonidentification and no-root are distinct",()=>{
  const input=fixture(),value=calculateUtilityRetirement(input).valueUsdMillion;
  const target={valueUsdMillion:value,basis:"unit-unlevered" as const,currency:"USD" as const,assumptionId:input.assumptionId};
  assert.equal(invertUtilityRetirement(freezeUtilityRetirement([{id:"a",input}],target,1e-8)).status,"unique-within-declared-discrete-domain");
  assert.equal(invertUtilityRetirement(freezeUtilityRetirement([{id:"a",input},{id:"b",input}],target,1e-8)).status,"nonidentified-multiple");
  assert.equal(invertUtilityRetirement(freezeUtilityRetirement([{id:"a",input}],{...target,valueUsdMillion:10000},1e-8)).status,"no-root");
  assert.throws(()=>invertUtilityRetirement(freezeUtilityRetirement([{id:"a",input}],{...target,assumptionId:"wrong"},1e-8)),/mismatch/);
});
test("pre-inversion declaration clones material and rejects mutation, changed tolerance and future freeze",()=>{
  const input=fixture(),value=calculateUtilityRetirement(input).valueUsdMillion;
  const freeze=freezeUtilityRetirement([{id:"a",input}],{valueUsdMillion:value,basis:"unit-unlevered",currency:"USD",assumptionId:input.assumptionId},1e-8);
  input.units[0].ownership=.1;
  assert.equal(invertUtilityRetirement(freeze).status,"unique-within-declared-discrete-domain");
  const changed=structuredClone(freeze);changed.material.toleranceUsdMillion=1e6;
  assert.throws(()=>invertUtilityRetirement(changed),/pre-inversion/);
  assert.throws(()=>invertUtilityRetirement({...freeze,frozenAt:"2099-01-01T00:00:00Z"}),/pre-inversion/);
});
for(const [name,change] of Object.entries({
  "missing economics":(x:RetirementInput)=>{x.units[0].years[0].cashTaxes=null as any;},
  "future source":(x:RetirementInput)=>{x.sources[0].publishedAt="2026-01-01T00:00:00Z";},
  "day-only source":(x:RetirementInput)=>{x.sources[0].publishedAt="2023-12-01";},
  "shared share invalid":(x:RetirementInput)=>{x.units[0].ownership=1.1;},
  "committed retirement":(x:RetirementInput)=>{x.units[0].legallyCommittedLatestYear=2024;},
  "liability beyond horizon":(x:RetirementInput)=>{x.units[0].decommissioningPaymentYear=2027;},
  "post-retirement generation":(x:RetirementInput)=>{x.units[0].years[1].capacityFactor=.5;},
  "wrong entity":(x:RetirementInput)=>{x.units[0].legalEntity="parent";},
  "missing year":(x:RetirementInput)=>{x.units[0].years.pop();},
  "unsupported basis":(x:RetirementInput)=>{x.basis="FCFE" as any;},
  "double recovery":(x:RetirementInput)=>{x.cashConvention="recovery-already-in-price" as any;},
  "past annual start":(x:RetirementInput)=>{x.cutoff="2024-06-01T00:00:00Z";},
})) test(name+" refuses rather than silently coercing",()=>{
  const x=fixture();change(x);assert.throws(()=>calculateUtilityRetirement(x));
});
