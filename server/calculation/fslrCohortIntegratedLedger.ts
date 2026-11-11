/** Source-bound finite cash splice. Does not invoke frozen issuer kernels or reverse solvers. */
export function plainFslr(s:string){return s.replace(/<[^>]*>/g," ").replace(/&nbsp;|&#160;/g," ")
  .replace(/&#8217;|&rsquo;/g,"'").replace(/\$\s+/g,"$").replace(/\s+/g," ");}
export function extractFslrLegacyRecognition(html:string){
  const text=plainFslr(html),contexts=new Map(Array.from(html.matchAll(/<xbrli:context id="([^"]+)">([\s\S]*?)<\/xbrli:context>/g)).map(m=>[m[1],m[2]]));
  const facts=Array.from(html.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/gi));
  function fact(name:string,year:number,instant=false,expected?:number){
    const values=facts.filter(m=>{
      const n=m[1].match(/\bname="([^"]+)"/)?.[1],ref=m[1].match(/contextRef="([^"]+)"/)?.[1];
      const c=contexts.get(ref??"")??"";
      return n===name&&m[1].includes('unitRef="usd"')&&c.includes(">0001274494</xbrli:identifier>")&&
        (expected!==undefined||!c.includes("<xbrli:segment>"))&&
        (instant?c.includes(`<xbrli:instant>${year}-12-31</xbrli:instant>`):
          c.includes(`<xbrli:startDate>${year}-01-01</xbrli:startDate>`)&&c.includes(`<xbrli:endDate>${year}-12-31</xbrli:endDate>`));
    }).map(m=>{
      const v=plainFslr(m[2]).replace(/,/g,""),zero=/fixed-zero/.test(m[1]);
      return(zero?0:Number(v))*10**Number(m[1].match(/scale="([^"]+)"/)?.[1]??0)*(m[1].includes('sign="-"')?-1:1);
    }).filter(v=>expected===undefined||v===expected);
    const unique=Array.from(new Set(values));if(unique.length!==1||!Number.isFinite(unique[0]))throw new Error(`Exact authentic FY${year}fact ${name}`);
    return unique[0];
  }
  for(const q of ["two agreements with Fiserv","sale of $687.2 million","aggregate cash proceeds of $659.7 million",
    "loss of $27.5 million during the year ended December 31, 2023",
    "full cash proceeds during the year ended December 31, 2024",
    "Operating Activities The increase in net cash provided by operating activities during 2024 was primarily driven by proceeds from the sale of Section 45X tax credits",
    "paid in six annual installments thereafter","24% subsidy"])
    if(!text.includes(q))throw new Error(`Missing actual primary clause ${q}`);
  const incomeGrants2024=[1009451e3,4186e3,484e3].map(e=>fact("us-gaap:GovernmentAssistanceAmount",2024,false,e));
  return{fiscalYear:2024,currency:"USD",operatingCashFlowUsd:fact("us-gaap:NetCashProvidedByUsedInOperatingActivities",2024),
    governmentGrantsReceivableCfoEffectUsd:-fact("fslr:IncreaseDecreaseInGovernmentGrantsReceivable",2024),
    currentGrantReceivableUsd:fact("us-gaap:GrantsReceivableCurrent",2024,true),
    noncurrentGrantReceivableUsd:fact("us-gaap:GrantsReceivableNoncurrent",2024,true),
    priorCurrentGrantReceivableUsd:fact("us-gaap:GrantsReceivableCurrent",2023,true),
    priorNoncurrentGrantReceivableUsd:fact("us-gaap:GrantsReceivableNoncurrent",2023,true),
    incomeGrants2024ByExpenseUsd:incomeGrants2024,
    incomeGrants2023Usd:fact("us-gaap:GovernmentAssistanceAmount",2023,false,659745e3),
    governmentGrantReceivableCfoEffect2023Usd:-fact("fslr:IncreaseDecreaseInGovernmentGrantsReceivable",2023),
    fiserv:{generationYear:2023,agreementPeriod:"2023-12",buyer:"Fiserv",faceUsd:687.2e6,
      proceedsUsd:659.7e6,lossRecognitionYear:2023,lossRoundedUsd:27.5e6,cashYear:2024,cashUsd:659.7e6},
    otherCurrentAssetsUsd:fact("us-gaap:OtherAssetsCurrent",2024,true),
    otherGrants:{indiaAssetSubsidyFraction:.24,sourceInstallments:6,
      cashCollectionDates:null,cashAmounts:null,governmentReviewConditional:true,
      totalGrantBalancesNotAssumed45x:true,unidentifiedAmountsNotReleased:true}};
}
export function historicalFslrCashBridge(legacy:ReturnType<typeof extractFslrLegacyRecognition>,visa2024CashUsd:number){
  const selectedCreditCash=legacy.fiserv.cashUsd+visa2024CashUsd;
  const allIncome=legacy.incomeGrants2024ByExpenseUsd.reduce((s,v)=>s+v,0);
  const bookDecrease=legacy.priorCurrentGrantReceivableUsd+legacy.priorNoncurrentGrantReceivableUsd-
    legacy.currentGrantReceivableUsd-legacy.noncurrentGrantReceivableUsd;
  return{selected2024CreditCashUsd:selectedCreditCash,
    cfoLessSelectedCreditCashUsd:legacy.operatingCashFlowUsd-selectedCreditCash,
    selectedTwoRoundedReceiptsCombinedRoundingBoundUsd:100000,
    allIncomeGrantBenefitsUsd:allIncome,
    grantRecognitionPlusReceivableCfoAdjustmentUsd:allIncome+legacy.governmentGrantsReceivableCfoEffectUsd,
    unallocatedGrantBridgeResidualUsd:allIncome+legacy.governmentGrantsReceivableCfoEffectUsd-selectedCreditCash,
    residualIsNotObservedOtherGrantCash:true,
    grantBookDecreaseUsd:bookDecrease,
    cashflowVersusBookMovementUnattributedUsd:legacy.governmentGrantsReceivableCfoEffectUsd-bookDecrease,
    priorYearAllIncomeGrantPlusGrantCfoAdjustmentUsd:legacy.incomeGrants2023Usd+legacy.governmentGrantReceivableCfoEffect2023Usd,
    historicalCfoRestatementApplied:false,creditCashNotRemovedTogetherWithRecognizedGrantAndWcAgain:true};
}
export type SourceDatedLeg={date:string;cashUsd:number;kind:string;dateIsAssumption:boolean};
export function datedCashPv(legs:SourceDatedLeg[],referenceDate:string,rate:number){
  if(!(rate>0))throw new Error("Positive original USD discount rate required");
  return legs.reduce((s,l)=>{
    const days=(Date.parse(`${l.date}T00:00:00Z`)-Date.parse(`${referenceDate}T00:00:00Z`))/86400000;
    if(!Number.isFinite(days)||days<=0||!Number.isFinite(l.cashUsd))throw new Error("Cash leg is not dated after cutoff");
    return s+l.cashUsd/(1+rate)**(days/365.25);
  },0);
}
export function rowFcfeFromFundedCash(y:any){
  return(y.nonClimateRevenue+y.climateRevenue)*y.operatingMarginBeforeClimateCostsAndCredits-y.climateOperatingCost+
    y.depreciation+y.otherNonCash+y.cashPolicyCredit-(y.closingReceivables-y.openingReceivables)-
    y.increaseOtherOperatingWorkingCapital-y.interestPaid-y.cashTax+y.otherOperatingCash-
    y.capitalSpend+y.debtProceeds-y.debtRepayments-y.nonCommonCashClaims;
}
/** Replaces ONLY the source-identified 2025-origin subset of a retained conditional forecast.
 * Actual sold face is NOT all reported production/recognized credit; unmatched forecast stays labelled. */
export function integrateFslrSourceCohorts(input:{
  baseline:any;parameters:{fslrForecastCredit2025:number;fslrCashPerFaceCredit:number;fslrCreditReceivableYears:number};
  facts:{transfers:{id:string;generationYear:number;faceUsd:number;contractProceedsUsd:number;
    receipts:{year:number;cashUsd:number}[]}[];treasuryCashOnly:{cashUsd:number;generationYear:number}};
  visaTiming:"pre-cutoff-reserved"|"post-cutoff-march31";
}){
  const b=input.baseline,p=input.parameters,e=b.built.engineInput,reference=e.referenceDate;
  if(reference!=="2025-02-21"||e.currency!=="USD"||e.firstYear!==2026||e.terminalGrowth!==.025)throw new Error("Exact retained original USDcase/cutoff required");
  const lots=input.facts.transfers.filter(l=>l.generationYear===2025),face=lots.reduce((s,l)=>s+l.faceUsd,0);
  if(lots.length!==2||face>p.fslrForecastCredit2025)throw new Error("Identified subset exceeds frozen conditional forecast; full recognition rebuild required");
  const oldNet=face*p.fslrCashPerFaceCredit,oldCarry=oldNet*p.fslrCreditReceivableYears;
  const oldCash2025=oldNet-oldCarry;
  const actual2025=lots.flatMap(l=>l.receipts).filter(r=>r.year===2025).reduce((s,r)=>s+r.cashUsd,0);
  const actual2026=lots.flatMap(l=>l.receipts).filter(r=>r.year===2026).reduce((s,r)=>s+r.cashUsd,0);
  if(Math.abs(actual2025+actual2026-lots.reduce((s,l)=>s+l.contractProceedsUsd,0))>.01)throw new Error("Source transfer cash not complete");
  const fraction=(Date.parse("2025-12-31T00:00:00Z")-Date.parse(reference+"T00:00:00Z"))/(86400000*365.25);
  const visa=input.facts.transfers.find(l=>l.generationYear===2024);if(!visa)throw new Error("Prior Visa identified cohort absent");
  const visaCash2025=visa.receipts.filter(r=>r.year===2025).reduce((s,r)=>s+r.cashUsd,0);
  const legs:SourceDatedLeg[]=[
    {date:"2025-12-31",cashUsd:-oldCash2025*fraction,kind:"remove-overlapping-forecast-2025-cohort-stub-cash",dateIsAssumption:true},
    {date:"2025-12-31",cashUsd:actual2025,kind:"source-identified-2025-cash-yearend-convention-not-prorated",dateIsAssumption:true},
    {date:"2026-12-31",cashUsd:-oldCarry,kind:"remove-overlapping-forecast-2025-carry-from-2026",dateIsAssumption:true},
    {date:"2026-02-28",cashUsd:actual2026,kind:"actual-February2026-receipt-monthend-convention",dateIsAssumption:true},
    {date:"2026-01-31",cashUsd:input.facts.treasuryCashOnly.cashUsd,kind:"actual-January2026-2024-origin-Treasury-monthend-convention",dateIsAssumption:true},
  ];
  if(input.visaTiming==="post-cutoff-march31")legs.push({date:"2025-03-31",cashUsd:visaCash2025,
    kind:"conditional-Q1Visa-after-reference-latest-date-bound",dateIsAssumption:true});
  const sourceAnnualRows=[...e.years,...e.continuation.years,e.continuation.terminalYear];
  const annualRows=sourceAnnualRows.map((y:any)=>{
    const sourceRebuilt=rowFcfeFromFundedCash(y),oldStored=[...b.built.ledger.years,...b.built.ledger.continuationYears,b.built.ledger.terminalYear].find((r:any)=>r.year===y.year);
    if(!oldStored||Math.abs(sourceRebuilt-oldStored.fcfe)>.001)throw new Error("Frozen source funded-cash row mismatch");
    const adjusted={...y,cashPolicyCredit:y.cashPolicyCredit-(y.year===2026?oldCarry:0)};
    const datedExtra=legs.filter(l=>l.date.startsWith(String(y.year))&&l.cashUsd>0).reduce((s,l)=>s+l.cashUsd,0);
    const rebuilt=rowFcfeFromFundedCash(adjusted),expected=sourceRebuilt+(y.year===2026?actual2026+input.facts.treasuryCashOnly.cashUsd-oldCarry:0);
    if(Math.abs(rebuilt+datedExtra-expected)>.001)throw new Error("Integrated annual funded cash did not rebuild");
    return{...adjusted,fcfeBeforeSourceDatedCollections:rebuilt,separatelyDatedCollectionsUsd:datedExtra,
      fcfe:rebuilt+datedExtra,cashRebuildResidualUsd:rebuilt+datedExtra-expected};
  });
  const originalStub=e.stub.cashFlows.reduce((s:number,l:any)=>s+l.fcfe,0);
  const adjustedStub=originalStub+legs.filter(l=>l.date==="2025-12-31").reduce((s,l)=>s+l.cashUsd,0);
  const deltaPv=datedCashPv(legs,reference,e.discountRate);
  const terminal=annualRows[annualRows.length-1],oldTerminal=b.built.ledger.terminalYear;
  if(terminal.fcfe!==oldTerminal.fcfe)throw new Error("Finite cohort integration changed original terminal");
  return{version:"fslr-source-cohort-integrated-1",visaTiming:input.visaTiming,referenceDate:reference,currency:"USD",
    originalFiveYearRows:e.years.length,originalFadeRows:e.continuation.years.length,originalTerminalGrowth:e.terminalGrowth,
    originalHistoricalBaseFcfe:e.baseFcfe,sourceDatedCashAdjustmentLegs:legs,
    source2025IdentifiedFaceUsd:face,oldIdentifiedForecastNetProceedsUsd:oldNet,oldIdentifiedForecastCarryUsd:oldCarry,
    conditionalUnmatched2025ForecastCreditFaceUsd:p.fslrForecastCredit2025-face,
    unmatchedAmountIsNotObservedEligibleCredits:true,source2025ActualCashUsd:actual2025,source2026PriorCreditCashUsd:actual2026+input.facts.treasuryCashOnly.cashUsd,
    visaPreCutoffCashReservedNotDistributedUsd:input.visaTiming==="pre-cutoff-reserved"?visaCash2025:0,
    originalStubFcfe:originalStub,adjustedYearendStubFcfe:adjustedStub,
    additionalVisaStubPaymentUsd:input.visaTiming==="post-cutoff-march31"?visaCash2025:0,
    annualRows,finiteCashDeltaPvUsd:deltaPv,
    conditionalIntegratedWholeEquityUsd:b.assessed.forward.forwardWholeEquity+deltaPv,
    terminalFcfeUnchanged:terminal.fcfe,terminalUnchanged:true,
    recognitionIncomeOrTaxOrOtherWcAdjustmentUsd:0,secondDiscountOrExcessCashAdditionUsd:0,
    sourceReceiptsAreNotNewGenerationOrCfoAddedTwice:true,
    technicalSourceIntegrationExecuted:true,technicalOriginalIssuerCompletion:false,ownerReview:"pending-not-requested",
    legalEligibilityCertified:false,qualifiedOriginalIssuers:0,oldIssuerKernelExecutions:0,newReverseOrRootAttempts:0};
}
