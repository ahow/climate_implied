import * as XLSX from "xlsx";
import {contentHash} from "./calculation/analysisManifest";
import {economicBridgeCells,readEconomicBridgeCells} from "../shared/economicBridgeSchema";

/** Private operator document. No disclosure authorization is created here. */
export function finiteCompanyDocument(retained:{input:any;result:any;computedResult:any;decision:any;proposal:any;proposalId:string}){
 return companyDocument(retained,false);
}
export function renewalCompanyDocument(retained:Parameters<typeof finiteCompanyDocument>[0]){
 return companyDocument(retained,true);
}
function companyDocument(retained:Parameters<typeof finiteCompanyDocument>[0],renewal:boolean){
 const {input,result,computedResult,decision,proposal,proposalId}=retained,binding=result.producerManifest?.[renewal?"renewalExecution":"finiteExecution"];
 if(!binding||binding.inputHash!==contentHash(input))throw Error("Finite document material mismatch");
 if(contentHash(proposal)!==proposalId||contentHash(proposal.input)!==contentHash(input)||
  contentHash(proposal.producer)!==contentHash(result.producerManifest)||
  contentHash(proposal.sourceArchiveIds)!==contentHash(result.sourceEvidence.archiveHashes))
  throw Error("Finite document proposal/source identity mismatch");
 if(contentHash(computedResult)!==binding.resultHash||result.producerManifest.resultId!==binding.resultHash||
  contentHash(result.members)!==contentHash(computedResult.members)||
  contentHash(result.covered)!==contentHash(computedResult.covered)||
  contentHash(result.modelVersions)!==contentHash(computedResult.modelVersions))
  throw Error("Finite document result mismatch");
 if(contentHash(decision)!==result.operatingDecisionId||decision.proposalId!==proposalId||
  decision.financialReviewId!==result.financialReviewId||decision.decision!=="approved"||
  Date.parse(decision.decidedAt)>Date.parse(result.informationCutoff))
  throw Error("Finite document review identity mismatch");
 if(!["stored","recalculate"].includes(result.retrievalMode)||result.executionVerifiedNow!==(result.retrievalMode==="recalculate"))
  throw Error("Finite retrieval mode mismatch");
 const body={version:renewal?"private-renewal-company-document-1":"private-finite-company-document-1",decisionId:result.operatingDecisionId,
  retrievalMode:result.retrievalMode,executionVerifiedNow:result.executionVerifiedNow,
  financialReviewId:result.financialReviewId,cutoff:result.informationCutoff,
  producer:result.producerManifest,sourceIds:result.producerManifest.sourceIds,
  variables:{
   Input:{value:input,editable:"Declared assumptions require a NEW proposal/review; immutable result is read-only"},
   Calculated:{value:computedResult.members,editable:false,units:"USD cash/accrual; physical units declared per cohort; UTC dates",
    equations:renewal?["service = dated exposure × utilization × degradation",
     "charging = delivered service / round-trip efficiency; losses = charging − delivery",
     "periodic value = dated146097day net common cash PV / (1 − (1+r)^(-146097/365.25))",
     "affine inverse varies declared price only, NOT deployment growth",
     "stationary nominal assumptions are not observed future inputs or original whole-equity terminal treatment"]:
    ["service = dated exposure × utilization × degradation",
     "operating cash adjustment = accrued variable/energy costs − their cash settlements",
     "closing AP = opening AP + payable accrual − classified settlements",
     "other WC excludes AR/AP/tax already bridged",
     "recognition ≤ modeled service earned through end of recognition day under earned-service-prefix-1"]},
   Output:{value:{covered:computedResult.covered,modelVersions:computedResult.modelVersions,...(renewal?{renewalFamilyCoverage:computedResult.renewalFamilyCoverage}:{})},editable:false,
    claim:renewal?"Conditional stationary project cash and price-domain result; NOT implied deployment growth, whole equity, source/owner/science acceptance":
    "Conditional finite project distributions, not whole equity/FCFE, market identification, legal/GAAP acceptance or calibrated science"}
  },scientificAcceptance:false,publicDisclosureAuthorized:false};
 return {...body,id:contentHash(body)};
}
export function finiteCompanyWorkbook(document:ReturnType<typeof finiteCompanyDocument>){
 const {id,...body}=document;if(contentHash(body)!==id)throw Error("Finite document hash mismatch");
 const cells=economicBridgeCells(document);
 const sheet=XLSX.utils.aoa_to_sheet([["pointer","jsonValue"],...cells.map(c=>[c.pointer,c.jsonValue])]);
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,document.version==="private-renewal-company-document-1"?"Renewal accounting":"Finite accounting");
 const bytes=XLSX.write(book,{type:"buffer",bookType:"xlsx"});
 const read=XLSX.read(bytes,{type:"buffer"}),rows=XLSX.utils.sheet_to_json<string[]>(read.Sheets[read.SheetNames[0]],{header:1,raw:true});
 const reconstructed=readEconomicBridgeCells(rows.slice(1).map(r=>({pointer:r[0],jsonValue:r[1]})));
 if(contentHash(reconstructed)!==contentHash(document))throw Error("Finite workbook readback mismatch");
 for(const [key,cell] of Object.entries(read.Sheets[read.SheetNames[0]]))
  if(!key.startsWith("!")&&((cell as any).f||(cell as any).l))throw Error("Nonliteral finite workbook");
 return bytes as Buffer;
}
