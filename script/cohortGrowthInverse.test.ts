import test from "node:test";
import assert from "node:assert/strict";
import {freezeCohortGrowthDeck,invertCohortGrowthDeck,evaluateCohortGrowthDeck,type CohortGrowthDeck} from "../server/calculation/cohortGrowthInverse";
import {mkdtempSync,writeFileSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
const deck=():CohortGrowthDeck=>({
 baseCommissionYear:2026,valuationYear:2026,discountRate:"0.1",targetProjectCashPvUsd:"100",
 lowerOnePlusGrowth:"0",upperOnePlusGrowth:"2",absoluteParameterWidth:"0.00001",maxNodes:10000,
 law:"proportional-replication-of-each-commissioning-cohort-cash-and-service",
 rationale:"Explicit synthetic identical-project replication; no actual issuer fit",
 projects:[{boundary:"conditional-project-FCFE-not-whole-equity",currency:"USD",
 timing:"commission-at-year-start-retire-before-year-service",evidenceIds:["engineering"],
 cohorts:[{id:"a",commissionedYear:2027,retiredYear:2028,installedUnits:1,
  annualDegradation:0,capacityUnit:"MW",serviceUnit:"MWh",servicePerInstalledUnitPerYear:110,evidenceIds:["engineering"]}],
 years:[2027,2028].map(year=>({year,utilization:1,pricePerServiceUsd:1,variableCostPerServiceUsd:0,
  fixedCashCostUsd:0,constructionCashUsd:0,maintenanceCashUsd:0,replacementCashUsd:0,decommissioningCashUsd:0,
  cashTaxUsd:0,increaseOperatingWorkingCapitalUsd:0,interestCashUsd:0,debtRaisedUsd:0,debtRepaidUsd:0,nonCommonCashUsd:0}))}]
});
test("same cohort cash graph produces exact discounted polynomial and certified deployment solution",()=>{
 const f=freezeCohortGrowthDeck(deck()),r=invertCohortGrowthDeck(f);
 assert.deepEqual(f.domain.material.coefficients,["0/1","100/1"]);
 assert.deepEqual(r.roots,[{value:"1/1",derivativeZero:false}]);
 assert.equal(r.complete,true);assert.equal(r.marketIdentified,false);
 const p=evaluateCohortGrowthDeck(f,"1.5");
 assert.equal(p.pv.exact,"150/1");assert.equal(p.projects[0].rows[0].service,165);
 assert.equal(p.projects[0].rows[1].stock,0);
});
test("actual cash graph no-root, horizon, source-allocation and declaration mutations refuse",()=>{
 const x=deck();x.targetProjectCashPvUsd="1000";
 const r=invertCohortGrowthDeck(freezeCohortGrowthDeck(x));assert.equal(r.complete,true);assert.deepEqual(r.roots,[]);
 const y=deck();y.projects[0].years.pop();assert.throws(()=>freezeCohortGrowthDeck(y),/Complete finite/);
 const z=deck();z.projects[0].cohorts.push({...z.projects[0].cohorts[0],id:"b"});
 assert.throws(()=>freezeCohortGrowthDeck(z),/Per-cohort cash/);
 const f=freezeCohortGrowthDeck(deck());f.calculations[0].rows[0].fcfe++;
 assert.throws(()=>invertCohortGrowthDeck(f),/Mutated/);
});
test("offline CLI freezes before calculation and reads actual JSON/XLSX diagnostic output",()=>{
 const folder=mkdtempSync(join(tmpdir(),"cohort-engineering-")),input=join(folder,"deck.json");
 writeFileSync(input,JSON.stringify(deck()));
 const run=spawnSync(process.execPath,["--import","tsx","script/cohort-continuation-run.ts",input,"1.5"],
  {encoding:"utf8",timeout:30000});
 assert.equal(run.status,0,run.stderr);
 const receipt=JSON.parse(run.stdout.trim().split("\n").at(-1)!);
 assert.equal(receipt.literalReadback,true);assert.equal(receipt.scientificAcceptance,false);
 const report=JSON.parse(readFileSync(join(receipt.folder,"result.json"),"utf8"));
 assert.equal(report.result.point.pv.exact,"150/1");
 assert.equal(report.identity.sourceAuthenticated,false);
 assert.ok(readFileSync(join(receipt.folder,"result.xlsx")).length>0);
});
