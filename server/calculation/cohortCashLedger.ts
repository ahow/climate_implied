import type {calculateOperatingCohorts} from "./operatingCohorts";
export interface CohortCashYear {
 year:number;openingReceivables:number;closingReceivables:number;collections:number;
 openingOtherWorkingCapital:number;closingOtherWorkingCapital:number;
 openingUnpaidTax:number;closingUnpaidTax:number;taxAccrual:number;
 openingDebt:number;closingDebt:number;
 openingNonCommonLiability:number;closingNonCommonLiability:number;nonCommonAccrual:number;
 operatingFixedCash:number;holdingCash:number;transactionCash:number;
 openingCash:number;closingCash:number;commonContribution:number;commonDistribution:number;
 evidenceIds:string[];
}
export interface CohortCashLedger {
 version:"cohort-cash-ledger-1";currency:"USD";claimantId:string;
 claim:"declared-project-common-distribution-not-whole-equity";
 distributionRightsEvidenceId:string;years:CohortCashYear[];
}
export function reconcileCohortCash(model:ReturnType<typeof calculateOperatingCohorts>,ledger:CohortCashLedger,evidenceIds:string[]){
 if(ledger.version!=="cohort-cash-ledger-1"||ledger.currency!=="USD"||!ledger.claimantId||
  ledger.claim!=="declared-project-common-distribution-not-whole-equity"||
  !evidenceIds.includes(ledger.distributionRightsEvidenceId)||ledger.years.length!==model.rows.length)
  throw Error("Explicit complete cash/claim/evidence boundary required");
 const eq=(a:number,b:number)=>{if(!Number.isFinite(a)||!Number.isFinite(b)||Math.abs(a-b)>1e-9*Math.max(1,Math.abs(a),Math.abs(b)))throw Error("Accrual/cash balance reconciliation failed");};
 const balances=["Receivables","OtherWorkingCapital","UnpaidTax","Debt","NonCommonLiability","Cash"] as const;
 return ledger.years.map((y,i)=>{
  const r=model.rows[i],a=r.inputs;
  if(y.year!==r.year||!y.evidenceIds.length||y.evidenceIds.some(id=>!evidenceIds.includes(id)))throw Error("Cash year/source mismatch");
  const required=["collections","taxAccrual","nonCommonAccrual","operatingFixedCash","holdingCash","transactionCash","commonContribution","commonDistribution",
   ...balances.flatMap(b=>[`opening${b}`,`closing${b}`])];
  for(const key of required){const value=(y as unknown as Record<string,unknown>)[key];if(typeof value!=="number"||!Number.isFinite(value)||value<0)throw Error(`Missing/invalid cash field ${key}`);}
  for(const b of balances)if(i)eq(y[`opening${b}`],ledger.years[i-1][`closing${b}`]);
  eq(y.closingReceivables,y.openingReceivables+r.revenue-y.collections);
  eq(a.increaseOperatingWorkingCapitalUsd,y.closingReceivables-y.openingReceivables+y.closingOtherWorkingCapital-y.openingOtherWorkingCapital);
  eq(y.closingUnpaidTax,y.openingUnpaidTax+y.taxAccrual-a.cashTaxUsd);
  eq(y.closingDebt,y.openingDebt+a.debtRaisedUsd-a.debtRepaidUsd);
  eq(y.closingNonCommonLiability,y.openingNonCommonLiability+y.nonCommonAccrual-a.nonCommonCashUsd);
  eq(a.fixedCashCostUsd,y.operatingFixedCash+y.holdingCash+y.transactionCash);
  // FCFE already includes total operating WC, cash tax, debt and non-common cash.
  // Collections and balances reconcile that same cash, not additional deductions.
  const available=y.openingCash+r.fcfe+y.commonContribution;
  if(available<0||y.commonDistribution>available+1e-9)throw Error("Unfunded cash or distribution exceeds available declared cash");
  eq(y.closingCash,available-y.commonDistribution);
  return {year:y.year,fcfe:r.fcfe,commonNetCash:y.commonDistribution-y.commonContribution,
   fundingContribution:y.commonContribution,closingCash:y.closingCash,
   formula:"commonNetCash=distribution-contribution; closingCash=openingCash+FCFE-commonNetCash",
   legalQualification:"Declared rights evidence only; no independent legal/owner authentication"};
 });
}
