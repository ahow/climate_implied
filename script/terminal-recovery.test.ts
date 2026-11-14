import test from "node:test";
import assert from "node:assert/strict";
import {contentHash} from "../server/calculation/analysisManifest";
import {freezeOpeningObligations} from "../server/calculation/terminalObligations";
import {settleTerminal,type TerminalSettlement} from "../server/calculation/terminalSettlement";
function fixture():TerminalSettlement{
 const opening={cash:20,receivables:0,payables:20,tax:0,debt:0,nonCommon:0,otherWC:0};
 return {version:"terminal-settlement-3-recovery",currency:"USD",claimantId:"fixture",physicalParentHash:"physical",
  accrualScope:"complete-declared-post-cutoff-schedule",priority:"common-after-declared-liabilities",opening,
  openingObligations:freezeOpeningObligations({version:"opening-obligations-2-recovery",closingHash:contentHash(opening),
   claimantId:"fixture",legalEntityId:"entity",currency:"USD",asOf:"2028-01-01",
   items:[{id:"booked",sourceId:"source",legalEntityId:"entity",claimantId:"fixture",currency:"USD",
    accruedOn:"2027-12-31",account:"payables",openingUsd:20,counterparty:"vendor",priority:"before-common"}],
   allocations:[{eventId:"pay",obligationId:"booked",usd:20}],
   recoveries:[{id:"recovery",entitlementId:"synthetic-contract",obligationId:"booked",sourceId:"source",counterparty:"insurer",recipient:"fixture",
    legalEntityId:"entity",currency:"USD",priority:"common-after-declared-liabilities",eligibility:"declared-enforceable-reimbursement",
    eligibleOn:"2028-02-29",capUsd:5,recognitionEventId:"recognize",collectionEventId:"collect"}]}),
  events:[{id:"pay",on:"2028-02-29",kind:"payables",usd:20,evidenceIds:["source"]},
   {id:"recognize",on:"2028-02-29",kind:"recovery-accrual",usd:5,evidenceIds:["source"]},
   {id:"collect",on:"2028-03-01",kind:"receivables",usd:5,evidenceIds:["source"]},
   {id:"distribute",on:"2028-03-01",kind:"distribution",usd:5,evidenceIds:["source"]}]};
}
const run=(p:TerminalSettlement)=>settleTerminal(p,p.opening,"physical","fixture","2028-01-01","2028-01-01",.1,["source"]);
test("booked liability payment and eligible delayed recovery reconcile without new expense",()=>{
 const r=run(fixture());assert.equal(r.commonNetCash,5);assert.equal(r.subsequentAccruedCostUsd,0);
 assert.equal(r.recoveryReceivableUsd,5);assert.equal(r.openingObligations!.newExpenseUsd,0);
 assert.ok(Math.abs(r.presentCommonCashUsd-5/1.1**(60/365.25))<1e-10);
});
test("frozen eligibility, cap, recipient and duplicate cash refuse",()=>{
 for(const mutate of [
  (p:TerminalSettlement)=>p.openingObligations!.recoveries![0].recipient="other",
  (p:TerminalSettlement)=>p.openingObligations!.recoveries![0].capUsd=4,
  (p:TerminalSettlement)=>p.openingObligations!.recoveries![0].eligibleOn="2028-03-02",
  (p:TerminalSettlement)=>p.openingObligations!.recoveries!.push({...p.openingObligations!.recoveries![0]})
 ]){const p=fixture();mutate(p);p.openingObligations=freezeOpeningObligations(p.openingObligations!);assert.throws(()=>run(p));}
 const changed=fixture();changed.openingObligations!.items[0].counterparty="changed";assert.throws(()=>run(changed),/Frozen/);
});
