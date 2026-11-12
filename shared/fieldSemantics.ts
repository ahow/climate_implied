export { outputFieldSemantics,requireOutputSemantic,bindOutputFields } from "./outputFieldSemantics";
import { outputFieldSemantics } from "./outputFieldSemantics";
export type FieldSemantic = {
  field:string; role:"Input"|"Calculated"|"Output"; unit:string; formula:string;
  dependencies:string[]; source:string; vintage:string; asOf:string;
};
const workbook = { source:"Selected workbook plus ordered approved overlays",
  vintage:"Revised history; original publication vintage not certified",
  asOf:"Observation date; overlays additionally require source availability and approval by UTC end-of-day cutoff" };
const calculated = { source:"Calculation implementation in the archived source bundle",
  vintage:"Source content hash in analysis manifest",
  asOf:"Same selected inputs and information cutoff; not a new source observation" };
export const fieldSemantics: FieldSemantic[] = [
  ...["scope1Emissions","scope2Emissions","scope3Emissions"].map(field=>({field,role:"Input" as const,unit:"tCO2e",formula:"Reported scope emissions; null is unavailable, not zero",dependencies:[],...workbook})),
  ...["marketCap","netProfit"].map(field=>({field,role:"Input" as const,unit:"Native reported monetary unit; USD million only after qualified conversion",formula:"Retain source numeric amount and original date; currency, magnitude/minor-unit scale and any exact-source-day FX must be evidenced before monetary aggregation or raw-amount ratios. Missing evidence withholds derived values, not the original number; no implicit USD or FX.",dependencies:[],...workbook})),
  {field:"priceEarnings",role:"Input",unit:"ratio",formula:"Workbook P/E input; invalid/nonpositive values excluded by calculator",dependencies:[],...workbook},
  {field:"totalReturnIndex",role:"Input",unit:"index",formula:"Reported cumulative total-return index; period return = ending index / starting index - 1 for finite strictly positive levels",dependencies:[],...workbook,
    asOf:"Selected workbook observation label, not independently verified exchange-close time. Exact market-calendar and cash-dividend/split conventions require source evidence; no nearest-trading-date substitution or original-vintage claim."},
  {field:"sdgAlignmentScore",role:"Input",unit:"score",formula:"Workbook static SDG score; not a dated historical SDG series",dependencies:[],...workbook},
  {field:"costOfEquity",role:"Input",unit:"fraction/year",formula:"Explicit query assumption; common default 0.08, not automatically replaced by sensitivity beta rates",dependencies:[],source:"User assumption",vintage:"Exact query settings in manifest",asOf:"Scenario setting, not source observation"},
  {field:"carbonIntensity",role:"Calculated",unit:"tCO2e / USD million market cap",formula:"(scope1 + scope2 [+ scope3 if selected]) / marketCap; missing required scopes => null",dependencies:["scope1Emissions","scope2Emissions","scope3Emissions","marketCap"],...calculated},
  {field:"impliedGrowth",role:"Calculated",unit:"fraction/year",formula:"costOfEquity - 1 / positive PE",dependencies:["costOfEquity","priceEarnings"],...calculated},
  {field:"growthDifferential",role:"Output",unit:"percentage points/year",formula:"Difference in compared Gordon growth rates, multiplied by 100 for percentage-point display",dependencies:["costOfEquity","priceEarnings"],...calculated},
  {field:"fcfe",role:"Calculated",unit:"nominal major currency",formula:"netIncome + depreciation + otherCashAdjustments - capex - increaseWorkingCapital + netBorrowing",dependencies:["netIncome","depreciation","otherCashAdjustments","capex","increaseWorkingCapital","netBorrowing"],...calculated},
  {field:"carbonDrag",role:"Calculated",unit:"nominal major currency/year",formula:"(scope1 * scope1LiableFraction + scope2 * scope2LiableFraction) * effectiveCarbonPrice * (1 - passThrough)",dependencies:["scope1","scope2","scope1LiableFraction","scope2LiableFraction","effectiveCarbonPrice","passThrough"],...calculated},
  {field:"cashTax",role:"Calculated",unit:"nominal major currency/year",formula:"max(0, preTaxIncome) * taxRate; no automatic loss tax refund",dependencies:["preTaxIncome","taxRate"],...calculated},
  {field:"companyProjectedGrowth",role:"Output",unit:"fraction/year",formula:"(finalYearFCFE / baseFCFE)^(1/5) - 1; nonpositive endpoint unavailable",dependencies:["fcfe","baseFCFE"],...calculated},
];
export function semanticRows() {
  return [...fieldSemantics.map(f=>({Field:f.field,Classification:f.role,Unit:f.unit,Formula:f.formula,
    Dependencies:f.dependencies.join(", "),Source:f.source,Vintage:f.vintage,AsOf:f.asOf})),
    ...outputFieldSemantics.map(f=>({Field:f.id,Classification:f.role,Unit:f.unit,Formula:f.formula,
      Dependencies:f.dependencies.join(", "),Source:f.source,Vintage:f.source,AsOf:f.asOfRule,
      Meaning:f.meaning,Period:f.period,Geography:f.geography,Status:f.status,
      Missingness:f.missingness,Uncertainty:f.uncertainty}))];
}
