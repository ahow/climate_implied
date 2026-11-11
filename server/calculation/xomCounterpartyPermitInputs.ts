/** Independent source qualification. CF capture-unit costs NEVER become XOM CCS costs/fees. */
function plain(s:string){return s.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&#8217;/g,"'")
  .replace(/\bCO\s+2\b/g,"CO2").replace(/\s+/g," ").trim();}
function needs(s:string,q:string){if(!s.includes(q))throw new Error(`Required primary clause absent: ${q}`);}
export type CfCaptureProject={
  site:string;captureOriginState:string;gas:"CO2";massUnit:"metric tonnes/year";annualCapacityUpper:number;
  expectedStartYear:number;cfCaptureUnitCapitalApproxUsd:number;captureEquipmentScope:"dehydration/compression";
  xomTransportStorageContractDisclosed:true;observedOperatingVolume:null;minimumBillableVolume:null;
  xomFeePerTonne:null;xomOpex:null;xomCapital:null;
};
export function extractCfFy2024Projects(html:string):CfCaptureProject[]{
  const s=plain(html);
  for(const q of ["Donaldsonville","Yazoo City","estimated total cost of approximately $200 million over the life of the project",
    "expected to cost approximately $100 million over the life of the project",
    "For each facility we have contracted with ExxonMobil to transport and sequester",
    "At Donaldsonville, CCS is expected to commence in 2025",
    "up to approximately 2 million metric tons of CO2",
    "At Yazoo City, CCS is expected to commence in 2028",
    "up to approximately 500,000 metric tons of CO2"])needs(s,q);
  needs(s,"dehydration and compression unit at our Donaldsonville complex is in advanced stages, with an estimated total cost of approximately $200 million");
  needs(s,"dehydration and compression unit at our Yazoo City complex is expected to cost approximately $100 million");
  return[
    {site:"Donaldsonville",captureOriginState:"Louisiana",annualCapacityUpper:2e6,expectedStartYear:2025,
      cfCaptureUnitCapitalApproxUsd:200e6},
    {site:"Yazoo City",captureOriginState:"Mississippi",annualCapacityUpper:500000,expectedStartYear:2028,
      cfCaptureUnitCapitalApproxUsd:100e6}
  ].map(p=>({...p,gas:"CO2" as const,massUnit:"metric tonnes/year" as const,
    captureEquipmentScope:"dehydration/compression" as const,xomTransportStorageContractDisclosed:true as const,
    observedOperatingVolume:null,minimumBillableVolume:null,xomFeePerTonne:null,xomOpex:null,xomCapital:null}));
}
export function corroborateYazooAnnouncement(html:string,p:CfCaptureProject){
  const s=plain(html);
  for(const q of ["July 25, 2024","Yazoo City, Mississippi",
    "signed a definitive commercial agreement with ExxonMobil",
    "Sequestration is expected to start in 2028",
    "CF Industries will invest approximately $100 million",
    "up to 500,000 metric tons of CO2","expects the project to qualify for tax credits under Section 45Q"])
    needs(s,q);
  if(p.site!=="Yazoo City"||p.annualCapacityUpper!==500000||p.cfCaptureUnitCapitalApproxUsd!==100e6||p.expectedStartYear!==2028)
    throw new Error("Annual/announcement project mismatch");
  return{publicationDate:"2024-07-25",issuer:"CF Industries Holdings, Inc.",announcedContractCounterpartyGroup:"ExxonMobil",
    signedOperatingLegalEntitiesIdentified:false,expected45QByIssuer:true,currentLegalEligibilityCertified:false,
    taxCreditRateUsdPerTonne:null,creditBeneficiaryContractAllocation:null,feePerTonne:null,
    gas:"CO2",massUnit:"metric tonnes/year",sourceCorroborated:true};
}
export function examineCfAgreementAndExhibits(html:string,year:2022|2024){
  const s=plain(html),start=s.lastIndexOf("EXHIBIT INDEX");
  if(start<0)throw new Error("Required complete annual exhibit index absent");
  const index=s.slice(start);
  if(year===2022){
    needs(s,"definitive CO2 offtake agreement with ExxonMobil to transport and permanently sequester");
    needs(s,"capacity to dehydrate and compress up to 2 million tons per year of CO2");
    needs(s,"References to tons refer to short tons and references to tonnes refer to metric tons.");
  }
  const matched=index.match(/ExxonMobil|carbon capture|sequestration/gi)??[];
  if(matched.length)throw new Error("CCS agreement candidate in exhibit index requires actual linked contract retrieval");
  return{fiscalYear:year,locator:"Part IV Item15 / final EXHIBIT INDEX",exhibitIndexCharacters:index.length,
    matchingNamedAgreementDescriptions:matched.length,termsLocatedInExhibitIndex:false,
    scope:"Only this retrieved annual exhibit index; NOT proof a contract is globally unfiled/undisclosed",
    original2022CapacityMetricUnitCertified:year===2022?false:null,
    original2022ReportedCapacityShortTonsPerYear:year===2022?2e6:null,
    original2022CapacityMetricTonnesPerYear:null,
    unitHistoryNote:year===2022?"2022explicit short-ton convention;2024explicit metric tons retained separately, no silent historical unit substitution":null,
    feeSchedule:null};
}
export function extractHistoricalEprSite(pdfText:string){
  const pages=pdfText.split("\f"),page=pages.findIndex(p=>/Notice of variation and consolidation/.test(p)&&/00026538/.test(p));
  if(page<0)throw new Error("Exact company-number/notice page absent");
  const s=plain(pages[page]);
  for(const q of ["The Environmental Permitting (England and Wales) Regulations 2016",
    "EPR/BR6996IC","Esso Petroleum Company, Limited","company registration number 00026538",
    "to operate a regulated facility at Esso Refinery Marsh Lane Fawley Southampton Hampshire SO45 1TX",
    "take effect from 04/03/2019"])needs(s,q);
  return{scheme:"Environmental Permitting Regulations / industrial installation",permitId:"EPR/BR6996IC",
    variation:"V008",effectiveDate:"2019-03-04",operator:"Esso Petroleum Company, Limited",
    companyRegistrationNumber:"00026538",page:page+1,
    regulatedFacilityAddress:"Esso Refinery, Marsh Lane, Fawley, Southampton, Hampshire SO45 1TX",
    registeredOfficeIsNotFacilityAddress:true,certifiedCurrentAtFy2024:false,
    mappedUkEtsPermitId:null,ukEts11402SiteQualified:false,ukEtsGasMonitoringBoundaryQualified:false,
    nativeCo2Tonnes:null,ukEtsIdOccurrences:Array.from(pdfText.matchAll(/UK[- ]E[- ]IN[- ]\d+/gi)).length};
}
export function sourceBoundCaptureCapacity(projects:CfCaptureProject[]){
  if(projects.length!==2||new Set(projects.map(p=>p.site)).size!==2)throw new Error("Exact two distinct source projects required");
  for(const p of projects)if(p.gas!=="CO2"||p.massUnit!=="metric tonnes/year"||!(p.annualCapacityUpper>0)||
    !(p.cfCaptureUnitCapitalApproxUsd>0)||!Number.isInteger(p.expectedStartYear))throw new Error("Mass/capital/start bound invalid");
  const capacity=projects.reduce((s,p)=>s+p.annualCapacityUpper,0),capital=projects.reduce((s,p)=>s+p.cfCaptureUnitCapitalApproxUsd,0);
  const annual=Array.from({length:5},(_,i)=>({year:2025+i,
    conditionalPhysicalCapacityUpperMetricTonnes:projects.filter(p=>p.expectedStartYear<=2025+i).reduce((s,p)=>s+p.annualCapacityUpper,0),
    observedOrMinimumBillableVolume:null,commonCashRevenue:null}));
  return{conditionalYears2025To2029:annual,cumulativeFiveYearCapacityUpperMetricTonnes:annual.reduce((s,r)=>s+r.conditionalPhysicalCapacityUpperMetricTonnes,0),
    conditions:"Only if source expected commissioning years are met; annual ceilings, NOT assumed first-year/full utilization or contracted minimum billings",
    totalMatureAnnualCapacityUpperMetricTonnes:capacity,cfCaptureUnitCapitalApproxUsd:capital,
    atStatedUpperCapacityCfCapitalUsdPerAnnualMetricTonne:projects.map(p=>({site:p.site,value:p.cfCaptureUnitCapitalApproxUsd/p.annualCapacityUpper})),
    aggregateCfCapitalUsdPerAnnualMetricTonne:capital/capacity,
    ratioIsNotAnnualOpexLcoeTariffOrXomCost:true,xomRevenue:null,xomProjectCashValue:null,
    xomWholeCashModelStatus:"refused-missing-fee-opex-replacement-funding-and-common-cash-terms"};
}
