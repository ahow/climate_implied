import {test} from "node:test";
import assert from "node:assert/strict";
import {settleTerminal,type TerminalSettlement} from "../server/calculation/terminalSettlement";
const opening={cash:0,receivables:100,payables:20,tax:10,otherWC:5,debt:30,nonCommon:5};
const event=(id:string,kind:TerminalSettlement["events"][number]["kind"],usd:number,on="2028-02-29")=>({id,kind,usd,on,evidenceIds:["synthetic"]});
const policy=():TerminalSettlement=>({version:"terminal-settlement-1",currency:"USD",claimantId:"synthetic-project",physicalParentHash:"p",opening:{...opening},
 accrualScope:"complete-declared-post-cutoff-schedule",priority:"common-after-declared-liabilities",
 events:[event("ar","receivables",90),event("default","receivable-default",10),event("ap","payables",20),
 event("tax","tax",10),event("wc","otherWC",5),event("debt","debt",30),event("nc","nonCommon",5),event("common","distribution",30)]});
const run=(p=policy())=>settleTerminal(p,opening,"p","synthetic-project","2028-01-01","2027-01-01",.1,["synthetic"]);
test("synthetic delayed leap-day settlement preserves defaults, liabilities and common cash",()=>{
 const r=run();assert.equal(r.commonNetCash,30);assert.equal(r.receivableDefaultsUsd,10);
 assert.ok(Math.abs(r.presentCommonCashUsd-30/1.1**(424/365.25))<1e-10);
 assert.deepEqual(Object.values(r.closing),[0,0,0,0,0,0,0]);assert.equal(r.periodicValueUsd,null);
});
test("actual earlier funding is deducted once and repaid only in residual common cash",()=>{
 const p=policy();p.events.find(e=>e.id==="ap")!.on="2028-01-02";
 assert.throws(()=>run(p),/funding/);p.events.push(event("fund","contribution",20,"2028-01-02"));
 p.events.find(e=>e.id==="common")!.usd=50;
 const r=run(p);assert.equal(r.commonNetCash,30);
 assert.ok(Math.abs(r.presentCommonCashUsd-(50/1.1**(424/365.25)-20/1.1**(366/365.25)))<1e-10);
});
test("missing liabilities, early priority, swapped source/claim and invalid calendar refuse",()=>{
 let p=policy();p.events=p.events.filter(e=>e.id!=="nc");assert.throws(()=>run(p),/liability/);
 p=policy();p.claimantId="other";assert.throws(()=>run(p),/claim/);
 p=policy();p.events[0].on="2028-02-30";assert.throws(()=>run(p),/date/);
 p=policy();p.events[0].evidenceIds=["unknown"];assert.throws(()=>run(p),/source/);
 p=policy();p.opening.receivables=99;assert.throws(()=>run(p),/opening/);
});
test("post-retirement interest accrues separately, debt funding and repayment cancel once",()=>{
 const p=policy();p.events.push(event("borrow","debt-funding",20,"2028-01-02"),
  {...event("accrue-interest","payable-accrual",2,"2028-02-01"),costBasis:"interest"},
  event("pay-interest","payables",2),event("repay-new","debt",20));
 p.events.find(e=>e.id==="ap")!.on="2028-01-02";
 p.events.find(e=>e.id==="common")!.usd=28;
 const r=run(p);assert.equal(r.commonNetCash,28);assert.equal(r.subsequentAccruedCostUsd,2);
});
