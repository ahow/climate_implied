import test from "node:test";
import assert from "node:assert/strict";
import {contentHash} from "../server/calculation/analysisManifest";
import {settleTerminal,type TerminalSettlement} from "../server/calculation/terminalSettlement";
function fixture():TerminalSettlement{
 const opening={cash:0,receivables:100,payables:20,tax:5,otherWC:0,debt:10,nonCommon:5};
 return {version:"terminal-settlement-1",currency:"USD",claimantId:"synthetic",physicalParentHash:"physical",
  accrualScope:"complete-declared-post-cutoff-schedule",priority:"common-after-declared-liabilities",opening,
  events:[{id:"collect",on:"2028-02-29",kind:"receivables",usd:100,evidenceIds:["fixture"]},
   ...(["payables","tax","debt","nonCommon"] as const).map(kind=>({id:kind,on:"2028-03-01",kind,usd:opening[kind],evidenceIds:["fixture"]})),
   {id:"distribute",on:"2028-03-01",kind:"distribution",usd:60,evidenceIds:["fixture"]}],
  openingObligations:{version:"opening-obligations-1",closingHash:contentHash(opening),claimantId:"synthetic",legalEntityId:"entity",currency:"USD",asOf:"2028-01-01",
   items:(["payables","tax","debt","nonCommon"] as const).map(account=>({id:account,sourceId:"fixture",legalEntityId:"entity",claimantId:"synthetic",currency:"USD",accruedOn:"2027-12-31",account,openingUsd:opening[account]})),
   allocations:(["payables","tax","debt","nonCommon"] as const).map(account=>({eventId:account,obligationId:account,usd:opening[account]}))}};
}
const run=(p:TerminalSettlement)=>settleTerminal(p,p.opening,"physical","synthetic","2028-01-01","2028-01-01",.1,["fixture"]);
test("booked obligations settle once, with leap-date PV and no new expense",()=>{
 const r=run(fixture());assert.equal(r.commonNetCash,60);assert.equal(r.subsequentAccruedCostUsd,0);
 assert.equal(r.openingObligations!.newExpenseUsd,0);
 assert.ok(Math.abs(r.presentCommonCashUsd-60/1.1**(60/365.25))<1e-10);
 assert.equal(r.openingObligations!.rows.reduce((n,r)=>n+r.settledUsd,0),40);
});
test("item matching refuses swapped, ambiguous, duplicated and borrowed liabilities",()=>{
 for(const mutate of [
  (p:TerminalSettlement)=>{p.openingObligations!.closingHash="swapped";},
  (p:TerminalSettlement)=>{p.openingObligations!.items.push({...p.openingObligations!.items[0]});},
  (p:TerminalSettlement)=>{p.openingObligations!.items[0].legalEntityId="other";},
  (p:TerminalSettlement)=>{p.openingObligations!.allocations.push({...p.openingObligations!.allocations[0]});},
  (p:TerminalSettlement)=>{p.openingObligations!.items[0].openingUsd=19;},
  (p:TerminalSettlement)=>{p.openingObligations!.allocations[0].obligationId="unknown";}
 ]){const p=fixture();mutate(p);assert.throws(()=>run(p));}
});
test("receivable default and explicit owner funding can produce negative common cash",()=>{
 const p=fixture();p.events=p.events.filter(e=>e.id!=="collect"&&e.id!=="distribute");
 p.events.push({id:"default",on:"2028-02-29",kind:"receivable-default",usd:100,evidenceIds:["fixture"]},
  {id:"fund",on:"2028-02-28",kind:"contribution",usd:40,evidenceIds:["fixture"]});
 const r=run(p);assert.equal(r.commonNetCash,-40);assert.equal(r.receivableDefaultsUsd,100);
 assert.ok(Math.abs(r.presentCommonCashUsd+40/1.1**(58/365.25))<1e-10);
 p.events=p.events.filter(e=>e.id!=="fund");assert.throws(()=>run(p),/shortfall/);
});
