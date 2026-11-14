import {contentHash} from "./analysisManifest";
import type {TerminalBalances,TerminalSettlement} from "./terminalSettlement";

export interface OpeningObligationRegister {
 version:"opening-obligations-1";closingHash:string;claimantId:string;legalEntityId:string;currency:"USD";asOf:string;
 items:{id:string;sourceId:string;legalEntityId:string;claimantId:string;currency:"USD";accruedOn:string;
  account:"payables"|"tax"|"debt"|"nonCommon";openingUsd:number}[];
 allocations:{eventId:string;obligationId:string;usd:number}[];
}
/** Item matching is accounting evidence, not creditor priority or legal approval.
 * This version supports payment of existing liabilities only; no inferred
 * write-off, recovery entitlement or new expense is introduced. */
export function reconcileOpeningObligations(p:OpeningObligationRegister,closing:TerminalBalances,
 terminal:TerminalSettlement,cutoff:string,evidence:string[]){
 const day=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||
  new Date(s).toISOString().slice(0,10)!==s)throw Error("Exact obligation date required");return Date.parse(s);};
 if(p.version!=="opening-obligations-1"||p.closingHash!==contentHash(closing)||p.currency!=="USD"||
  !p.legalEntityId||p.claimantId!==terminal.claimantId||p.asOf!==cutoff)
  throw Error("Opening obligation parent/entity/claim mismatch");
 const ids=new Set<string>(),remaining=new Map<string,number>();
 const accounts=["payables","tax","debt","nonCommon"] as const;
 for(const i of p.items){
  if(!i.id||ids.has(i.id)||!accounts.includes(i.account)||!evidence.includes(i.sourceId)||
   i.legalEntityId!==p.legalEntityId||i.claimantId!==p.claimantId||i.currency!==p.currency||
   day(i.accruedOn)>=day(cutoff)||!Number.isFinite(i.openingUsd)||i.openingUsd<0)
   throw Error("Duplicate/invalid/borrowed opening obligation");
  ids.add(i.id);remaining.set(i.id,i.openingUsd);
 }
 for(const a of accounts){
  const amount=p.items.filter(i=>i.account===a).reduce((v,i)=>v+i.openingUsd,0);
  if(Math.abs(amount-closing[a])>1e-9)throw Error(`Opening ${a} items do not reconcile`);
 }
 const pairs=new Set<string>(),rows=[];
 for(const a of [...p.allocations].sort((a,b)=>{
  const ea=terminal.events.find(e=>e.id===a.eventId),eb=terminal.events.find(e=>e.id===b.eventId);
  return (ea?.on??"").localeCompare(eb?.on??"")||a.eventId.localeCompare(b.eventId);
 })){
  const i=p.items.find(i=>i.id===a.obligationId),e=terminal.events.find(e=>e.id===a.eventId),key=JSON.stringify([a.eventId,a.obligationId]);
  if(!i||!e||pairs.has(key)||e.kind!==i.account||day(e.on)<day(cutoff)||!e.evidenceIds.includes(i.sourceId)||
   !Number.isFinite(a.usd)||a.usd<0||a.usd>(remaining.get(i.id)??0)+1e-9)
   throw Error("Unmatched/duplicate/overpaid obligation allocation");
  pairs.add(key);const before=remaining.get(i.id)!;remaining.set(i.id,before-a.usd);
  rows.push({on:e.on,eventId:e.id,obligationId:i.id,account:i.account,openingUsd:before,settledUsd:a.usd,closingUsd:before-a.usd,newExpenseUsd:0});
 }
 for(const e of terminal.events){
  const allocated=p.allocations.filter(a=>a.eventId===e.id).reduce((v,a)=>v+a.usd,0);
  if(allocated>e.usd+1e-9)throw Error("Allocation exceeds actual cash payment");
 }
 if(Array.from(remaining.values()).some(v=>Math.abs(v)>1e-9))throw Error("Opening obligations remain unmatched/unsettled");
 return {version:p.version,inputHash:contentHash(p),rows,newExpenseUsd:0,
  scope:"Existing liability payments only; new costs remain separately accrued. Recovery/default/priority not inferred.",
  formula:"Closing item = opening item − explicitly allocated settlement; settlement is not a new expense"};
}
