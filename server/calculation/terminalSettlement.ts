import {contentHash} from "./analysisManifest";
import {reconcileOpeningObligations,type OpeningObligationRegister} from "./terminalObligations";
export type TerminalBalances={cash:number;receivables:number;payables:number;tax:number;otherWC:number;debt:number;nonCommon:number};
export interface TerminalSettlement{
 version:"terminal-settlement-1";currency:"USD";claimantId:string;physicalParentHash:string;
 accrualScope:"complete-declared-post-cutoff-schedule";priority:"common-after-declared-liabilities";
 opening:TerminalBalances;
 openingObligations?:OpeningObligationRegister;
 events:{id:string;on:string;kind:"receivables"|"receivable-default"|"payables"|"tax"|"otherWC"|"debt"|"nonCommon"|"contribution"|"distribution"|"debt-funding"|"payable-accrual"|"tax-accrual"|"nonCommon-accrual";usd:number;evidenceIds:string[];
  costBasis?:"retirement"|"remediation"|"interest"|"holding"|"other-operating"}[];
}
/** Source-dated settlement of existing balances only: no inferred salvage, new
 * operating income or automatic parent-equity valuation. */
export function settleTerminal(p:TerminalSettlement,closing:TerminalBalances,parent:string,claimant:string,
 cutoff:string,valuationOn:string,rate:number,evidence:string[]){
 const day=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||!Number.isFinite(Date.parse(s))||
  new Date(s).toISOString().slice(0,10)!==s)throw Error("Exact terminal date required");return Date.parse(s);};
 const end=day(cutoff),origin=day(valuationOn);
 if(p.version!=="terminal-settlement-1"||p.currency!=="USD"||p.claimantId!==claimant||
  p.accrualScope!=="complete-declared-post-cutoff-schedule"||p.priority!=="common-after-declared-liabilities"||
  p.physicalParentHash!==parent||!claimant||origin>end||!Number.isFinite(rate)||rate<0||rate>=1)
  throw Error("Terminal claim/physical/valuation mismatch");
 const b={...closing};
 for(const k of Object.keys(b) as (keyof TerminalBalances)[])
  if(!Number.isFinite(b[k])||b[k]<0||p.opening[k]!==b[k])throw Error("Swapped or invalid terminal opening balance");
 const ids=new Set<string>(),events=p.events.slice().sort((a,b)=>a.on.localeCompare(b.on)||a.id.localeCompare(b.id));
 const kinds=["receivables","receivable-default","payables","tax","otherWC","debt","nonCommon","contribution","distribution","debt-funding","payable-accrual","tax-accrual","nonCommon-accrual"];
 for(const e of events){
  if(!e.id||ids.has(e.id)||!kinds.includes(e.kind)||day(e.on)<end||!Number.isFinite(e.usd)||e.usd<0||
   !e.evidenceIds.length||e.evidenceIds.some(id=>!evidence.includes(id)))throw Error("Invalid terminal event/source/date");
  ids.add(e.id);
  if(e.kind==="payable-accrual"&&!["retirement","remediation","interest","holding","other-operating"].includes(e.costBasis!))
   throw Error("Explicit post-cutoff payable cost basis required");
 }
 let pv=0,common=0,defaults=0,subsequentCost=0;
 const rows=[];
 for(const on of Array.from(new Set(events.map(e=>e.on)))){
  const opening={...b};let net=0;
  // Intraday priority is not inferred: only civil-day batches are supported.
  for(const e of events.filter(e=>e.on===on)){
   if(e.kind==="payable-accrual"||e.kind==="tax-accrual"||e.kind==="nonCommon-accrual"){
    b[e.kind==="payable-accrual"?"payables":e.kind==="tax-accrual"?"tax":"nonCommon"]+=e.usd;subsequentCost+=e.usd;
   }
   else if(e.kind==="debt-funding"){b.cash+=e.usd;b.debt+=e.usd;}
   else if(e.kind==="contribution"){b.cash+=e.usd;net-=e.usd;}
   else if(e.kind==="distribution"){b.cash-=e.usd;net+=e.usd;}
   else if(e.kind==="receivable-default"){b.receivables-=e.usd;defaults+=e.usd;}
   else {b[e.kind]-=e.usd;b.cash+=(["receivables","otherWC"].includes(e.kind)?1:-1)*e.usd;}
  }
  if(Object.values(b).some(v=>v < -1e-9))throw Error("Terminal funding or balance shortfall");
  // Residual common distributions cannot precede settlement of senior balances.
  if(events.some(e=>e.on===on&&e.kind==="distribution"&&e.usd>0)&&b.payables+b.tax+b.debt+b.nonCommon>1e-9)
   throw Error("Common distribution precedes liability settlement");
  const present=net/(1+rate)**((day(on)-origin)/86400000/365.25);
  common+=net;pv+=present;rows.push({on,opening,closing:{...b},commonNetCash:net,presentCommonCash:present});
 }
 if(Object.values(b).some(v=>Math.abs(v)>1e-9))throw Error("Terminal balances remain unsettled");
 const conserved=closing.cash+closing.receivables+closing.otherWC-closing.payables-closing.tax-closing.debt-closing.nonCommon-defaults-subsequentCost;
 if(Math.abs(common-conserved)>1e-9*Math.max(1,Math.abs(common),Math.abs(conserved)))throw Error("Terminal cash conservation failed");
 const openingObligations=p.openingObligations?reconcileOpeningObligations(p.openingObligations,closing,p,cutoff,evidence):undefined;
 return {version:p.version,inputHash:contentHash(p),physicalParentHash:parent,rows,closing:b,...(openingObligations?{openingObligations}:{}),
  commonNetCash:common,presentCommonCashUsd:pv,receivableDefaultsUsd:defaults,subsequentAccruedCostUsd:subsequentCost,
  periodicValueUsd:null,wholeEquityValueUsd:null,scientificAcceptance:false,
  claim:"declared-project-common-distribution-not-whole-equity",
  scope:"Declared financial balances only; not valuation or disposition of surviving physical assets",
  formula:"Opening cash + collected receivables + otherWC release - opening liabilities - subsequent accrued costs = distributions - contributions; defaults are noncash; financing principal cancels once"};
}
