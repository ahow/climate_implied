import {contentHash} from "./analysisManifest";
export interface RenewalFamily { declaredSets:string[];missing:{id:string;reason:string}[] }
export function reconcileRenewalFamily(input:any,members:any[]){
 const family:RenewalFamily=input.renewalFamily??{declaredSets:input.scenarios.filter((s:any)=>s.renewal).map((s:any)=>s.id),missing:[]};
 if(new Set(family.declaredSets).size!==family.declaredSets.length||new Set(family.missing.map(m=>m.id)).size!==family.missing.length||
  family.missing.some(m=>!family.declaredSets.includes(m.id)||!m.reason.trim()||input.scenarios.some((s:any)=>s.id===m.id))||
  input.scenarios.some((s:any)=>s.renewal&&!family.declaredSets.includes(s.id)))throw Error("Conflicting declared renewal family");
 const rows=family.declaredSets.map(id=>{
  const s=input.scenarios.find((s:any)=>s.id===id),m=members.find(m=>m.id===id),missing=family.missing.find(m=>m.id===id);
  if(!s){if(!missing)throw Error("Missing declared set requires explicit reason");return {id,status:"missing",reason:missing.reason,value:null,group:null,inverseStatus:"unavailable"};}
  if(!m?.renewal)return {id,status:"unavailable",reason:"No supported renewal result",value:null,group:null,inverseStatus:"unavailable"};
  const group=contentHash({claim:s.renewal.claim,claimantId:s.renewal.cashLedger?.claimantId??null,
   valuationOn:s.renewal.datedAccounting?.declaration.valuationOn??null,currency:s.specification.currency,
   serviceUnit:s.specification.cohorts[0].serviceUnit,law:s.renewal.version});
  return {id,status:m.renewal.conditionalPeriodicProjectValueUsd===null?"finite-only":"conditional-forward",
   reason:null,value:m.renewal.conditionalPeriodicProjectValueUsd,group,inverseStatus:m.renewalInverse?.status??"not-requested"};
 });
 const groups=Array.from(new Set(rows.flatMap(r=>r.group?[r.group]:[]))).map(group=>{
  const selected=rows.filter(r=>r.group===group&&typeof r.value==="number");
  return {group,includedSets:selected.map(r=>r.id),min:selected.length?Math.min(...selected.map(r=>r.value!)):null,
   max:selected.length?Math.max(...selected.map(r=>r.value!)):null};
 });
 return {version:"declared-renewal-family-1",definitionHash:contentHash(family),declared:rows.length,rows,groups,
  unavailableSets:rows.filter(r=>r.value===null).map(r=>r.id),scientificAcceptance:false,
  limitation:"All declared sets retained; numeric ranges do not erase missing/finite/refused inverse sets or establish identification"};
}
