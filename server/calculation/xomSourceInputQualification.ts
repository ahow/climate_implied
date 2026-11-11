/** NEW source adapters only: no frozen XOM valuation kernel, price fitting or stress grid. */
const text=(s:string)=>s.replace(/<script\b[\s\S]*?<\/script>/gi," ").replace(/<style\b[\s\S]*?<\/style>/gi," ")
  .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/g," ").replace(/&amp;/g,"&").replace(/&gt;/g,">").replace(/\s+/g," ").trim();
function requireText(body:string,need:string){if(!body.includes(need))throw new Error(`Missing source clause: ${need}`);}
function element(xml:string,id:string){
  const escaped=id.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const match=new RegExp(`<([\\w:-]+)\\b[^>]*\\bid="${escaped}"[^>]*>([\\s\\S]*?)<\\/\\1>`).exec(xml);
  if(!match)throw new Error(`Missing legal locator ${id}`);
  return match[0];
}
export type QualifiedUkLaw={
  asOf:"2024-12-31";madeDate:string;tonnesCo2ePerAllowance:1;registryAccountsRequired:true;
  reportDueMonthDay:"03-31";surrenderDueMonthDay:"04-30";
  listedActivityGas:Record<string,string[]>;
  locators:{allowance:string;reportable:string;surrender:string;reporting:string;gasAnnex:string};
};
export function extractFy2024UkLaw(article4:string,schedule2:string,fullOrder:string):QualifiedUkLaw{
  for(const [name,source]of [["article4",article4],["schedule2",schedule2],["fullOrder",fullOrder]])
    if(!source.includes("/2024-12-31"))throw new Error(`Wrong legal point-in-time view ${name}`);
  const allowance=text(element(fullOrder,"article-18"));
  requireText(allowance,"An allowance is an allowance to emit 1 tonne of carbon dioxide equivalent.");
  requireText(allowance,"Allowances may be held only in accounts in the registry.");
  const reportable=text(article4);
  requireText(reportable,"total specified emissions (in tonnes of carbon dioxide equivalent");
  const surrender=text(element(fullOrder,"schedule-6-paragraph-4-3"));
  requireText(surrender,"surrender allowances equal to the installation");
  requireText(surrender,"on or before 30th April in the following year");
  const reporting=text(element(fullOrder,"schedule-6-paragraph-4-2"));
  requireText(reporting,"on or before 31st March in the following year");
  const rows=Array.from(schedule2.matchAll(/<(?:\w+:)?tr\b[^>]*>([\s\S]*?)<\/(?:\w+:)?tr>/gi))
    .map(m=>Array.from(m[1].matchAll(/<(?:\w+:)?td\b[^>]*>([\s\S]*?)<\/(?:\w+:)?td>/gi)).map(c=>text(c[1])));
  const definitions:[string,RegExp][]=[
    ["COMBUSTION_OF_FUELS",/^Combustion of fuels on a site where/i],
    ["REFINING_OF_MINERAL_OIL",/^Refining of mineral oil$/i],
    ["PRODUCTION_OF_HYDROGEN_AND_SYNTHESIS_GAS",/^Production of hydrogen.*synthesis gas/i]];
  const listedActivityGas:Record<string,string[]>={};
  for(const[code,pattern]of definitions){
    const row=rows.find(r=>pattern.test(r[0]??""));
    if(!row||row[1]!=="Carbon dioxide")throw new Error(`Missing/changed actual activity gas ${code}`);
    listedActivityGas[code]=["CO2"];
  }
  const madeDate=/<ukm:Made\b[^>]*Date="([^"]+)"/.exec(fullOrder)?.[1];
  if(!madeDate)throw new Error("Original statute made date missing");
  return{asOf:"2024-12-31",madeDate,tonnesCo2ePerAllowance:1,registryAccountsRequired:true,
    reportDueMonthDay:"03-31",surrenderDueMonthDay:"04-30",listedActivityGas,
    locators:{allowance:"article-18-2; article-18-3",reportable:"article-4 term-reportable-emissions",
      surrender:"schedule-6-paragraph-4-3",reporting:"schedule-6-paragraph-4-2-b",gasAnnex:"schedule-2 paragraph3/table1"}};
}
export type SourcePermit={
  permitId:string;operator:string;regulatedActivity:string;period:number;reportedUnit:string;
  recordedCoveredEmissions:number;allocationDelivered:number;allocationUnit:string;
};
export function qualifyPermitUnits(p:SourcePermit,law:QualifiedUkLaw){
  if(p.period!==2024||p.reportedUnit!=="tCO2e"||p.allocationUnit!=="UKA"||
    p.operator!=="Esso Petroleum Company Limited"||
    !["UK-E-IN-12019","UK-E-IN-11402"].includes(p.permitId))
    throw new Error("Exact retained operator/permit/period/units required");
  if(![p.recordedCoveredEmissions,p.allocationDelivered].every(x=>Number.isFinite(x)&&x>=0))
    throw new Error("Invalid source emissions/allocation");
  const activities=p.regulatedActivity.split(";").map(x=>x.trim());
  if(!activities.length||activities.some(a=>!law.listedActivityGas[a]))throw new Error("Unmapped statutory activity");
  const statutoryGasesForListedRegistryActivities=Array.from(new Set(activities.flatMap(a=>law.listedActivityGas[a])));
  return{permitId:p.permitId,operator:p.operator,period:p.period,reportedUnit:"tCO2e",
    statutoryGasesForListedRegistryActivities,
    // Listed registry activities are not a retrieved complete installation monitoring-plan/gas annex.
    nativeCo2Tonnes:null,permitGasBoundaryCertified:false,corporateGhgScope:null,equityEmissionsAllocation:null,
    requiredSurrenderUnits:p.recordedCoveredEmissions/law.tonnesCo2ePerAllowance,
    actualDeliveredFreeUnits:p.allocationDelivered,
    uncoveredUnitsBeforeBankOrTransfers:Math.max(0,p.recordedCoveredEmissions/law.tonnesCo2ePerAllowance-p.allocationDelivered),
    verifiedReportDue:"2025-03-31",statutorySurrenderDue:"2025-04-30",
    actualUncommittedBankUnits:null,actualPurchasedUnits:null,actualPaidPrice:null,actualCashPurchaseDates:null,
    cashSettlementYear:null,incrementalCostValuationPermitted:false};
}

export type QualifiedXomPlan={
  publicationDate:"2024-12-11";budgetYears:number[];
  corporateNetCashCapex2025Usd:[number,number];corporateNetCashCapex2026To2030Usd:[number,number];
  lowerEmissionCashCapexUpper2025To2030Usd:number;lcsIncrementalEarnings2030Vs2024Usd:number;
  lowerEmissionScope:string[];ccsFeePerTonne:null;ccsAnnualOpex:null;ccsReplacementCapex:null;
  ccsOnlyCapitalBudget:null;projectNciOrAdvancesCash:null;
};
export function extractOriginalXomPlan(html:string):QualifiedXomPlan{
  const s=text(html);
  for(const clause of ["December 11, 2024","$27-$29 billion of cash capex in 2025",
    "$28-$33 billion annually in 2026-2030","up to $30 billion",
    "Low Carbon Solutions business to grow earnings contributions by $2 billion in 2030 versus 2024",
    "Lower emissions cash capex includes cash capex attributable to carbon capture and storage, hydrogen, lithium, biofuels",
    "Planned spend is from 2025-2030",
    "Other investing activities including collection of advances; reduced by Inflows from noncontrolling interests for major projects"])
    requireText(s,clause);
  return{publicationDate:"2024-12-11",budgetYears:[2025,2026,2027,2028,2029,2030],
    corporateNetCashCapex2025Usd:[27e9,29e9],corporateNetCashCapex2026To2030Usd:[28e9,33e9],
    lowerEmissionCashCapexUpper2025To2030Usd:30e9,lcsIncrementalEarnings2030Vs2024Usd:2e9,
    lowerEmissionScope:["CCS","hydrogen","lithium","biofuels","Proxxima","Carbon Materials","own/third-party emission reduction"],
    ccsFeePerTonne:null,ccsAnnualOpex:null,ccsReplacementCapex:null,ccsOnlyCapitalBudget:null,projectNciOrAdvancesCash:null};
}
export function extractBaytownFunding(html:string){
  const s=text(html);
  for(const clause of ["September 04, 2024","ADNOC will acquire a 35% equity stake",
    "proposed low-carbon hydrogen and ammonia production facility in Baytown, Texas",
    "Contingent on supportive government policy and necessary regulatory permits",
    "1 billion cubic feet (bcf) daily","98%","final investment decision (FID) is expected in 2025","anticipated startup in 2029"])
    requireText(s,clause);
  return{publicationDate:"2024-09-04",site:"Baytown, Texas, US",project:"proposed hydrogen and ammonia facility",
    announcedCounterparty:"ADNOC",announcedEquityFraction:.35,transactionClosedObserved:null,
    paidContributionUsd:null,exxonFinalEquityFraction:null,
    expectedHydrogenVolume:{upper:1e9,unit:"cubic feet/day",gas:"hydrogen",standardStateDisclosed:false,observed:false},
    forecastCo2RemovalFraction:.98,absoluteCo2CapturedTonnesPerYear:null,
    expectedFidYear:2025,expectedStartupYear:2029,policyAndPermitsConditional:true,actualCommissioningObserved:null};
}
export function qualifiedPlanEnvelope(p:QualifiedXomPlan){
  const lower=p.corporateNetCashCapex2025Usd[0]+5*p.corporateNetCashCapex2026To2030Usd[0];
  const upper=p.corporateNetCashCapex2025Usd[1]+5*p.corporateNetCashCapex2026To2030Usd[1];
  return{years:[2025,2030],netCashCapexArithmeticEnvelopeUsd:[lower,upper],
    endpointsAreJointIssuerGuidance:false,grossCapitalEnvelopeUsd:null,ccsOnlyCapitalAllocationUsd:null,
    capitalAlreadyIncludesLowerEmissionOpportunities:true,
    lcsEarningsNotCcsFcfe:p.lcsIncrementalEarnings2030Vs2024Usd,
    fullCcsCashValuationStatus:"refused-missing-project-economics",
    missing:["contracted/billable CO2 mass and fee schedule","project cash opex",
      "project gross capex/commissioning/replacement schedule","NCI/advance funding cash and common ownership waterfall",
      "policy credit cash entitlement/timing","earnings-to-common-cash reconciliation"]};
}
