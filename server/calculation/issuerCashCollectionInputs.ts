/** NEW source-tagged cash collection ledger, not an old valuation/Article18/capacity rerun. */
export function disclosureText(s:string){return s.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&#8217;|&rsquo;/g,"'")
  .replace(/\$\s+/g,"$").replace(/\bCO\s+2\b/g,"CO2").replace(/\s+/g," ").trim();}
function needs(s:string,q:string){if(!s.includes(q))throw new Error(`Missing original source clause: ${q}`);}
export type TaggedTransfer={
  id:string;generationYear:number;agreementYear:number;agreementPeriod:string;buyer:string|null;
  faceUsd:number;contractProceedsUsd:number;receipts:{period:string;year:number;cashUsd:number}[];
};
export function extractFslrActualCollections(q125:string,q126:string,q326:string){
  const a=disclosureText(q125),b=disclosureText(q126),c=disclosureText(q326);
  for(const q of ["two agreements with Visa Inc.","sale of $857.2 million","aggregate cash proceeds of $818.6 million",
    "initial cash proceeds of $616.0 million in December 2024",
    "remaining cash proceeds of $202.6 million during the three months ended March 31, 2025"])needs(a,q);
  for(const q of ["sale of $701.9 million","aggregate cash proceeds of $668.1 million",
    "full cash proceeds during the year ended December 31, 2025",
    "sale of $699.7 million","aggregate cash proceeds of $668.2 million",
    "initial cash proceeds of $573.0 million","remaining cash proceeds of $95.2 million in February 2026",
    "In January 2026, we also received $117.6 million from the U.S. Department of the Treasury"])needs(b,q);
  for(const q of ["$117.6 million from the U.S. Department of the Treasury related to Section 45X tax credits generated during 2024",
    "remaining cash proceeds of $95.2 million during the nine months ended September 30, 2026",
    "up to approximately 17 cents per watt for each module fully produced in the United States",
    "For each module that is initiated by our international fleet and then completed in the United States",
    "approximately 7 cents per watt"])needs(c,q);
  const transfers:TaggedTransfer[]=[
    {id:"2024-Visa-two-agreements",generationYear:2024,agreementYear:2024,agreementPeriod:"2024-12",buyer:"Visa Inc.",
      faceUsd:857.2e6,contractProceedsUsd:818.6e6,receipts:[{period:"2024-12",year:2024,cashUsd:616e6},{period:"2025-Q1",year:2025,cashUsd:202.6e6}]},
    {id:"2025-June-July-two-agreements",generationYear:2025,agreementYear:2025,agreementPeriod:"2025-06/07",buyer:null,
      faceUsd:701.9e6,contractProceedsUsd:668.1e6,receipts:[{period:"2025",year:2025,cashUsd:668.1e6}]},
    {id:"2025-October-two-agreements",generationYear:2025,agreementYear:2025,agreementPeriod:"2025-10",buyer:null,
      faceUsd:699.7e6,contractProceedsUsd:668.2e6,receipts:[{period:"2025",year:2025,cashUsd:573e6},{period:"2026-02",year:2026,cashUsd:95.2e6}]}
  ];
  return{transfers,treasuryCashOnly:{id:"2024-origin-Treasury-cash",generationYear:2024,
    receiptPeriod:"2026-01",receiptYear:2026,cashUsd:117.6e6,
    creditFaceUsd:null,principalVersusInterestBreakdown:null,openingReportedBookBalanceUsd:null,
    parRealizationAssumed:false},
    sourcePolicyChannels:{fullyUsProducedIssuerRateUpperUsdPerWatt:.17,
      foreignInitiatedUsCompletedIssuerExpectedRateUsdPerWatt:.07,
      currentIssuerModuleFormFactorOnly:true,notAStatutoryMaximumRate:true,
      productionWattAllocation:null,componentMaterialCostAllocation:null,
      futureOrCurrentLegalEligibilityCertified:false,faceRatesAreNotCashPrices:true,
      taxCreditBuyerIsNotComponentDeemedSaleProof:true},
    exclusions:["India/TamilNadu asset grants are not US45Xcash","Government-grants receivable aggregate is not this tagged45Xlot ledger",
      "Future credits/discounts/collection timing not inferred from observed lots","No cash added to already reported CFO/FCFE"]};
}
export function rebuildTaggedTransferCollections(lots:TaggedTransfer[]){
  if(!lots.length||new Set(lots.map(l=>l.id)).size!==lots.length)throw new Error("Nonempty uniquely tagged source lots required");
  const lotChecks=lots.map(l=>{
    if(!Number.isInteger(l.generationYear)||!Number.isInteger(l.agreementYear)||l.generationYear>l.agreementYear||
      !Number.isFinite(l.faceUsd)||!Number.isFinite(l.contractProceedsUsd)||!(l.faceUsd>0)||
      !(l.contractProceedsUsd>0)||l.contractProceedsUsd>l.faceUsd)throw new Error("Invalid source face/proceeds/origin");
    for(const p of l.receipts)if(!(p.cashUsd>=0)||!Number.isFinite(p.cashUsd)||!Number.isInteger(p.year)||
      p.year<l.agreementYear||!p.period.startsWith(String(p.year)))throw new Error("Invalid cash period/amount");
    const observedCashUsd=l.receipts.reduce((s,p)=>s+p.cashUsd,0);
    if(observedCashUsd>l.contractProceedsUsd+.01)throw new Error("Cash exceeds identified contract; check duplicate receipts");
    return{id:l.id,faceUsd:l.faceUsd,contractProceedsUsd:l.contractProceedsUsd,observedCashUsd,
      faceLessContractProceedsUsd:l.faceUsd-l.contractProceedsUsd,
      observedProceedsPerFaceDollar:l.contractProceedsUsd/l.faceUsd,
      outstandingContractProceedsUsd:l.contractProceedsUsd-observedCashUsd};
  });
  const first=Math.min(...lots.map(l=>l.agreementYear)),last=Math.max(...lots.map(l=>l.agreementYear),...lots.flatMap(l=>l.receipts.map(p=>p.year)));
  let opening=0;
  const years=Array.from({length:last-first+1},(_,i)=>{
    const year=first+i,contractProceedsAgreed=lots.filter(l=>l.agreementYear===year).reduce((s,l)=>s+l.contractProceedsUsd,0);
    const receipts=lots.flatMap(l=>l.receipts).filter(p=>p.year===year).reduce((s,p)=>s+p.cashUsd,0);
    const closing=opening+contractProceedsAgreed-receipts;
    const row={year,openingIdentifiedContractProceedsUsd:opening,netContractProceedsAgreedUsd:contractProceedsAgreed,
      observedCashCollectionsUsd:receipts,closingIdentifiedContractProceedsUsd:closing,
      cashIdentityResidualUsd:opening+contractProceedsAgreed-receipts-closing};
    opening=closing;return row;
  });
  return{lotChecks,years,totalFaceUsd:lotChecks.reduce((s,l)=>s+l.faceUsd,0),
    totalContractProceedsUsd:lotChecks.reduce((s,l)=>s+l.contractProceedsUsd,0),
    totalObservedTransferCashUsd:lotChecks.reduce((s,l)=>s+l.observedCashUsd,0),
    totalFaceLessContractProceedsUsd:lotChecks.reduce((s,l)=>s+l.faceLessContractProceedsUsd,0),
    finalIdentifiedContractProceedsOutstandingUsd:opening,
    isEntireGovernmentGrantsGaapRollforward:false,containsFuturePricingOrCollectionAssumptions:false,
    proceedsAlreadyNetNoSecondDiscountDeduction:true,reportedCfoOrFcfeAdjusted:false};
}
export function extractEnlinkProjectBoundary(annual22:string,annual23:string,q324:string,startup25:string){
  const a=disclosureText(annual22),b=disclosureText(annual23),c=disclosureText(q324),d=disclosureText(startup25);
  for(const q of ["transportation services agreement with a subsidiary of ExxonMobil",
    "up to 10 million metric tonnes per year","initial reserved capacity of 3.2 million metric tonnes per year"])needs(a,q);
  needs(b,"In February 2024");needs(b,"agreed to reassess the Pecan Island project's near-term role");
  for(const q of ["unable to identify alternative CO2 transportation projects for EnLink",
    "pursuing a financial arrangement for the value to EnLink","There can be no assurance that we would recover"])needs(c,q);
  for(const q of ["July 14, 2025","On an interim basis, ExxonMobil is storing CO2",
    "through enhanced oil recovery","Upon receiving its applicable permits",
    "starting with its Rose CCS project","draft Class VI permit for Rose"])needs(d,q);
  const indexes=[{year:2022,text:a},{year:2023,text:b}].map(v=>{
    const matches=Array.from(v.text.matchAll(/Item\s+15\.\s*Exhibits and Financial Statement Schedules/gi));
    if(!matches.length)throw new Error("Actual annual Item15index not located");
    const start=matches[matches.length-1].index!,index=v.text.slice(start);
    const named=index.match(/Exxon|carbon capture|\bCO2\b|sequestr|transportation services/gi)??[];
    if(named.length)throw new Error("Declared CCScontract candidate requires actual linked exhibit retrieval");
    return{year:v.year,locator:"Final Item15Exhibits and Financial Statement Schedules",indexCharacters:index.length,namedCcsContractDescriptions:0};
  });
  return{historicalInitialReservedMetricTonnesPerYear:3.2e6,historicalAvailableUpToMetricTonnesPerYear:10e6,
    reservedCapacityIsNotMinimumBillableVolume:true,minimumBillingsUsd:null,transportFeeUsdPerTonne:null,
    counterparty:"Unnamed subsidiary of ExxonMobil",currentTransportForecastMetricTonnes:null,
    projectStatusAsOf2024Q3:"No alternative transportation project identified; pursuing uncertain financial arrangement",
    contractRecoveryOrXomObligationUsd:null,recoveryCashTiming:null,
    startup2025Source:{captureOrigin:"Donaldsonville, Louisiana",issuerAnnouncedStartup:true,
      interimStorageMethod:"enhanced oil recovery",dedicatedProject:"Rose",roseStatusAtAnnouncement:"draft ClassVIpermit; final not established by this source",
      applicablePermitsReceivedObserved:null,actualAnnualInjectionTonnes:null,storageFee:null},
    indexes,doNotApplyHistoricalEnlinkReservationToObservedCfBillings:true,fullXomCcsCashValue:null};
}
