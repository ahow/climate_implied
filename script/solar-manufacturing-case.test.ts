import test from "node:test";
import assert from "node:assert/strict";
import {solarManufacturingPolicyBridge} from "../server/calculation/solarManufacturingCase";
const x={sourceHash:"a".repeat(64),availableAt:"2026-11-10T00:00:00Z",cutoff:"2026-11-10T00:00:00Z",
 salesUsd:4.9e9,grossProfitUsd:2.4e9,operatingExpenseUsd:635e6,includedCreditUsd:2.19e9,retainedCreditFraction:1};
test("explicit credit sensitivity subtracts included recognition once, never invents FCFE",()=>{
 assert.equal(solarManufacturingPolicyBridge(x).conditionalOperatingProfit,1.765e9);
 assert.equal(solarManufacturingPolicyBridge({...x,retainedCreditFraction:0}).conditionalOperatingProfit,-425e6);
 assert.equal(solarManufacturingPolicyBridge(x).fcfe,null);
 assert.throws(()=>solarManufacturingPolicyBridge({...x,cutoff:"2025-01-01T00:00:00Z"}),/Future/);
 assert.throws(()=>solarManufacturingPolicyBridge({...x,retainedCreditFraction:1.1}));
});
