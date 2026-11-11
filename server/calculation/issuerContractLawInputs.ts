/** New source-only adapters. No old unit/capacity/valuation kernels imported or executed. */
function htmlText(s:string){return s.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/\bCO\s+2\b/g,"CO2").replace(/\s+/g," ").trim();}
function pdfText(s:string){return s.replace(/([A-Za-z])-\s*\n\s*([A-Za-z])/g,"$1$2").replace(/\s+/g," ").trim();}
function needs(s:string,q:string){if(!s.includes(q))throw new Error(`Missing actual source clause: ${q}`);}
export function originalCfContractFacts(announcement:string,annual2022:string,ex991:string){
  const a=htmlText(announcement),annual=htmlText(annual2022),e=htmlText(ex991);
  for(const q of ["October 12, 2022","up to 2 million metric tons of CO2 emissions annually",
    "Donaldsonville, Louisiana","Vermilion Parish","ExxonMobil has signed an agreement with EnLink Midstream",
    "125K-acre CO2 storage location"])needs(a,q);
  needs(annual,"References to tons refer to short tons and references to tonnes refer to metric tons.");
  needs(annual,"capacity to dehydrate and compress up to 2 million tons per year of CO2");
  needs(e,"secure geologic storage it owns in Vermilion Parish");
  needs(e,"ExxonMobil has signed an agreement with EnLink Midstream");
  return{publicationDate:"2022-10-12",gas:"CO2",announcementCapacityUpper:{value:2e6,unit:"metric tonnes/year"},
    annual2022ReportedCapacity:{value:2e6,unit:"short tons/year"},crossDocumentMassLabelConflict:true,
    conflictTreatment:"Preserve each document's native label; no retrospective unit substitution or physical-capacity-change claim",
    captureOrigin:"Donaldsonville, Louisiana",announcedStorageGeography:"Vermilion Parish, Louisiana",
    announcedStoragePositionAcres:125000,storageAcreageIsNotInjectableCapacity:true,
    transportNetworkCounterparty:"EnLink Midstream",storageStatementByIssuer:"ExxonMobil group storage it owns",
    registeredStorageSpvOrOwnershipFraction:null,storageInjectionPermitId:null,
    contractFeePerTonne:null,contractTermYears:null,xomTransportStorageOpex:null,
    fullExecutedContractLocated:false,corporateGhgScopeOrEquityAllocation:null};
}
export function metsDiscoveryBoundary(guide:string,landing:string,client:string){
  const g=htmlText(guide);
  needs(g,"Your METS online account");
  needs(guide,"https://manage-emissions-reporting.service.gov.uk/landing");
  needs(landing,"main-IFRZ7ZHG.js");
  needs(client,"Sign in to installations");needs(client,"Create an installations sign in");
  return{regulatorDeclaredService:"Manage your UK ETS reporting service",
    publicLandingReached:true,clientSignInBoundaryObserved:true,
    publicRegisterRouteStringLocated:/public-register|publicRegister/.test(client),
    exactUkEts11402DocumentRetrieved:false,permitSiteCrosswalk:null,permitGasMonitoringAnnex:null,
    authenticationAttempted:false,accountCreationAttempted:false,contactOrDocumentRequestSubmitted:false,
    findingScope:"Only actual regulator guide, landing shell and declared public client; no anonymous permit document obtained, not proof of global absence"};
}
export type SolarPolicy={
  framework:"PL117-169 plus PL119-21 and IRSNotice2026-15";
  sourceFrameworkNotExhaustiveCurrentLawCertification:true;
  solarMacrMinimum:Record<number,number>;phaseout:Record<number,number>;
  embeddedPrimaryUsCostMinimum:.65;embeddedRuleStartsCalendarTaxYear:2027;
  companyEligibilityCertified:false;
};
export function extractAmendedSolarPolicy(ira:string,obbba:string,notice:string,issuer2025:string):SolarPolicy{
  const i=pdfText(ira),o=pdfText(obbba),n=pdfText(notice),f=htmlText(issuer2025);
  needs(i,"SEC. 13502.");needs(o,"SEC. 70514.");
  for(const [year,percent]of [[2030,75],[2031,50],[2032,25]])needs(i,`sold during calendar year ${year}, ${percent} percent`);
  needs(i,"sold after December 31, 2032, 0 percent");
  const solar=o.slice(o.indexOf("in the case of any solar energy component"),o.indexOf("in the case of any wind energy component",o.indexOf("in the case of any solar energy component")));
  if(!solar)throw new Error("Solar MACR legal category not located");
  for(const [year,percent]of [[2026,50],[2027,60],[2028,70],[2029,80]])needs(solar,`during calendar year ${year}, ${percent} percent`);
  needs(solar,"after December 31, 2029, 85 percent");
  for(const q of ["same manufacturing facility as","not less than 65 percent","beginning after December 31, 2026",
    "MATERIAL ASSISTANCE FROM PROHIBITED FOREIGN ENTITIES"])needs(o,q);
  needs(n,"Notice 2026-15");needs(n,"interim guidance");
  needs(n,"Eligible Component MACR cannot be less than 50%");
  needs(n,"Total Direct Material Costs");needs(f,"with material assistance from");
  needs(f,"phase down beginning in 2030");
  return{framework:"PL117-169 plus PL119-21 and IRSNotice2026-15",sourceFrameworkNotExhaustiveCurrentLawCertification:true,
    solarMacrMinimum:{2026:.5,2027:.6,2028:.7,2029:.8,2030:.85},
    phaseout:{2030:.75,2031:.5,2032:.25,2033:0},embeddedPrimaryUsCostMinimum:.65,
    embeddedRuleStartsCalendarTaxYear:2027,companyEligibilityCertified:false};
}
export type SolarGateInput={
  calendarSaleYear:number;calendarTaxpayer:true;claimPath:"direct-module-sale"|"embedded-primary-component";
  usProductionAndEligibleSale:boolean|null;pfeEntityAndControlClear:boolean|null;
  sameManufacturingFacility:boolean|null;secondaryDirectMaterialCostShareFromUsPrimaryEligibleComponents:number|null;
  totalDirectMaterialCosts:number|null;pfeDirectMaterialCosts:number|null;costAttributionEvidenceValidated:boolean|null;
};
export function solarPolicyConstraints(p:SolarPolicy,x:SolarGateInput){
  if(x.calendarTaxpayer!==true||!Number.isInteger(x.calendarSaleYear)||x.calendarSaleYear<2026)
    throw new Error("Adapter restricted to2026+calendar taxpayers; no unexamined fiscal-year interpretation");
  if(!["direct-module-sale","embedded-primary-component"].includes(x.claimPath))throw new Error("Unexamined component claim path");
  const y=x.calendarSaleYear,phaseout=y>=2033?0:y>=2030?p.phaseout[y]:1;
  const threshold=y>=2030?p.solarMacrMinimum[2030]:p.solarMacrMinimum[y];
  const embedded=x.claimPath==="embedded-primary-component"&&y>=p.embeddedRuleStartsCalendarTaxYear;
  let macr:number|null=null;
  const costs=[x.totalDirectMaterialCosts,x.pfeDirectMaterialCosts];
  if(costs.some(v=>v!==null&&(!Number.isFinite(v)||v<0)))throw new Error("Invalid actual/conditional cost input");
  if(x.totalDirectMaterialCosts!==null&&x.pfeDirectMaterialCosts!==null){
    if(x.totalDirectMaterialCosts<=0||x.pfeDirectMaterialCosts>x.totalDirectMaterialCosts)throw new Error("Invalid MACR cost denominator/attribution");
    macr=(x.totalDirectMaterialCosts-x.pfeDirectMaterialCosts)/x.totalDirectMaterialCosts;
  }
  const share=x.secondaryDirectMaterialCostShareFromUsPrimaryEligibleComponents;
  if(share!==null&&(!Number.isFinite(share)||share<0||share>1))throw new Error("Invalid embedded primary-component cost share");
  const missing:string[]=[],failures:string[]=[];
  for(const[k,v]of [["US production and eligible sale",x.usProductionAndEligibleSale],
    ["PFE entity/contractual effective-control clearance",x.pfeEntityAndControlClear],
    ["cost attribution and component-type/year evidence",x.costAttributionEvidenceValidated]]as const){
    if(v===null)missing.push(k);else if(!v)failures.push(k);
  }
  if(macr===null)missing.push("component-specific total/PFE direct-material costs");
  else if(macr<threshold)failures.push("solar component MACR");
  if(embedded){
    if(x.sameManufacturingFacility===null)missing.push("same manufacturing facility");
    else if(!x.sameManufacturingFacility)failures.push("same manufacturing facility");
    if(share===null)missing.push("secondary direct-material costs attributable to US primary eligible components");
    else if(share<p.embeddedPrimaryUsCostMinimum)failures.push("65% US-primary eligible-component cost requirement");
  }
  return{calendarSaleYear:y,claimPath:x.claimPath,sourceFramework:p.framework,
    conditionalPhaseoutMultiplier:phaseout,solarMacrMinimum:threshold,maximumPfeDirectCostFraction:Number((1-threshold).toFixed(2)),
    computedMacr:macr,embedded65PercentRuleApplies:embedded,missing,failures,
    status:phaseout===0?"statutory-phaseout-zero":failures.length?"fails-specified-source-framework":missing.length?"unresolved-source-inputs":"conditionally-passes-specified-framework",
    creditCashUsd:null,currentCompanyEligibilityCertified:false};
}
