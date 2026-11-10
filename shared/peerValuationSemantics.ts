import type { OutputFieldSemantic } from "./outputFieldSemantics";

const eligibility = "Latest raw row per company (strictly greater date replaces prior; equal date retains first ordered row). positivePE prefers finite positive supplied priceEarnings, otherwise finite positive marketCap/netProfit, otherwise excludes company. No emissions carry-forward.";
const peers = "method=absolute: all eligible selected companies; sector_relative/sub_sector_relative/industry_relative: respective selected-workbook classification, empty classification grouped as __ungrouped__; singleton allowed";
const context = {
  role:"Output" as const,
  dependencies:["selected workbook companies/timeSeries","geography","method","costOfEquity","positivePE","getPeerGroupKey"],
  source:"server/climateValuation/decarbGapCalculator.ts; valuationStatistics.ts; sharedUtils.ts; decarbConversion.ts; publicValuationContract.ts",
  period:"Summary uses latest available raw observation separately per company, potentially mixed dates; not a common reporting period",
  geography:"Requested geography filter applied before eligibility and peer construction",
  status:"Descriptive peer valuation diagnostic; NOT emissions reduction, climate projection, investable signal or scientific acceptance",
  missingness:eligibility+" Empty eligible universe gives zero counts and empty top/bottom arrays; missing classifications remain null in response.",
  uncertainty:"No calibrated uncertainty; ranks and peer medians are cross-sectional descriptive quantities",
  scope:"Selected immutable workbook plus ordered approved overlays, or live mutable source when snapshot absent. P/E is dimensionless; fallback uses workbook marketCap/netProfit in USD million. Currency compatibility is not independently verified; no FX conversion or future projection horizon.",
  asOfRule:"Selected dataset and overlay cutoff only; latest accounting dates are not publication dates. Current/revised classifications and observations do not establish historical point-in-time availability.",
};
const rowSpecs: [string,string,string,string][] = [
  ["companyId","Internal company identity, not verified issuer identifier","eligible company.id","identifier"],
  ["companyName","Selected company name","company.name || 'Unknown'","text"],
  ["sector","Selected company sector classification","company.sector || null","nullable label"],
  ["subSector","Selected company subsector classification","company.subSector || null","nullable label"],
  ["industry","Selected company industry classification","company.industry || null","nullable label"],
  ["pe","Positive P/E used for peer valuation, rounded after calculation","Math.round(positivePE(latestRawRow)*100)/100; supplied positive priceEarnings takes precedence over marketCap/netProfit","ratio"],
  ["impliedGrowth","Gordon constant-growth comparator, not measured growth or decarbonisation","Math.round((costOfEquity-1/unroundedPositivePE)*10000)/10000; costOfEquity default 0.08","fraction/year"],
  ["peerMedianGrowth","Unweighted peer median Gordon comparator, computed before rounding","sort eligible unrounded (costOfEquity-1/positivePE) ascending; odd n: value[floor(n/2)], even n: (value[n/2-1]+value[n/2])/2; then Math.round(median*10000)/10000; "+peers,"fraction/year"],
  ["score","Within-peer rank of negative Gordon-comparator difference, not physical gap","sort each peer by -100*(unroundedGrowth-unroundedPeerMedian) ascending, tie by companyId ascending; n<2 -> 0, else Math.round((2*i/(n-1)-1)*1000)/1000 for zero-based i; "+peers,"dimensionless [-1,1]"],
];
export const peerValuationSemantics: OutputFieldSemantic[] = [
  ...(["topCompanies","bottomCompanies"] as const).flatMap(group=>[
    ...rowSpecs.map(([field,meaning,formula,unit])=>({
      ...context,id:`peerValuation.${group}[].${field}`,meaning,formula,unit,
      period:context.period+`; ${group==="topCompanies" ? "first ten" : "last ten reversed"} after descending sort on Math.round(-100*(growth-peerMedianGrowth)*100)/100; lists overlap for fewer than twenty companies, ties retain input order`,
    })),
    {...context,id:`peerValuation.${group}[]`,meaning:`Empty ${group} when no eligible positive P/E`,formula:"[] when eligible count is zero",unit:"empty collection"},
    {...context,id:`peerValuation.display.${group}.gordonBaselinePct`,meaning:"Displayed fixed-8% Gordon baseline recomputed from rounded API P/E, not API impliedGrowth",
      formula:"gordonBaselinePct(api.pe)=8-100/api.pe; finite positive pe required; displayDiagnostic -> toFixed(2)+'%', invalid -> Unavailable",
      unit:"percent/year",source:"client/src/pages/decarb-gap-signal.tsx; client/src/lib/valuation-claims.ts"},
    {...context,id:`peerValuation.display.${group}.peerGapPp`,meaning:"Displayed difference of rounded company and peer Gordon comparators, not a physical decarbonisation gap",
      formula:"(api.impliedGrowth-api.peerMedianGrowth)*100; both must be numbers; displayDiagnostic -> toFixed(2)+' pp', nonfinite/missing -> Unavailable",
      unit:"percentage points/year",source:"client/src/pages/decarb-gap-signal.tsx; client/src/lib/valuation-claims.ts"},
  ]),
  ...([
    ["companyCount","Eligible companies, not identity-verified coverage","count(companies with positivePE on latest raw row)"],
    ["positiveSignalCount","Count with positive rounded negative peer-comparator difference, NOT positive score count","count(Math.round(-100*(growth-peerMedianGrowth)*100)/100 > 0); projectedRate is fixed zero at route"],
    ["negativeSignalCount","Count with negative rounded negative peer-comparator difference, NOT negative score count","count(Math.round(-100*(growth-peerMedianGrowth)*100)/100 < 0); rounded zeros are neither count"],
  ] as const).map(([field,meaning,formula])=>({...context,id:`peerValuation.${field}`,meaning,formula,unit:"companies"})),
  {...context,id:"peerValuationHistory.date",meaning:"Observation date for descriptive eligible-company count",
    formula:"groupTimeSeriesByDate uses full ISO timestamp; sorted ascending, output date=ISO.slice(0,10); distinct timestamps on same UTC date can produce duplicate displayed dates",
    unit:"ISO UTC date",period:"Each raw workbook timestamp group, not latest global observations",
    missingness:"Within each full ISO timestamp group choose first ordered row per company on equal date; use positivePE precedence and eligibility. Omit group with no finite eligible comparators; no across-date carry-forward."},
  {...context,id:"peerValuationHistory.companyCount",meaning:"Eligible positive-P/E companies at this observation timestamp",
    formula:"count(computePerCompanyImpliedDecarbRates on latest row per company within the full ISO timestamp group); omit timestamp if no finite eligible comparator statistics",
    unit:"companies",period:"Each raw workbook timestamp group; no across-date carry-forward",
    missingness:"Within each full ISO timestamp group choose first ordered row per company on equal date; use positivePE precedence and eligibility. Omit group with no finite eligible comparators; no across-date carry-forward."},
];
