import { indicatorFieldSemantics } from "./indicatorFieldSemantics";
import { regionalFieldSemantics } from "./regionalFieldSemantics";
import { sensitivityFieldSemantics } from "./sensitivityFieldSemantics";
import { projectionFieldSemantics } from "./projectionFieldSemantics";
import { historicalFieldSemantics } from "./historicalFieldSemantics";
import { nativeOutputSemantics } from "./nativeOutputSemantics";
import { companyReviewSemantics } from "./companyReviewSemantics";
import {companyReplaySemantics} from "./companyReplaySemantics";
import { companyAbatementSemantics } from "./companyAbatementSemantics";
import { companyCoverageSemantics } from "./companyCoverageSemantics";
import { researchFieldSemantics } from "./researchFieldSemantics";
import { companySummarySemantics } from "./companySummarySemantics";
import { backtestFieldSemantics } from "./backtestFieldSemantics";
import { peerValuationSemantics } from "./peerValuationSemantics";
import { newsFieldSemantics } from "./newsFieldSemantics";
import { dataManagementSemantics } from "./dataManagementSemantics";
import { evidenceFieldSemantics } from "./evidenceFieldSemantics";
import { targetInputSemantics } from "./targetInputSemantics";
import { diagnosticMetadataSemantics, signalComparisonSemantics } from "./diagnosticMetadataSemantics";
import { remainingFieldSemantics } from "./remainingFieldSemantics";
import { nativePathwaySemantics } from "./nativePathwaySemantics";
import { thresholdDiagnosticSemantics } from "./thresholdDiagnosticSemantics";
import { nativeThresholdSemantics } from "./nativeThresholdSemantics";
import { conditionalCompanySemantics } from "./companyConditionalSemantics";
import { warmingValidationReferenceSemantics } from "./warmingValidationReferenceSemantics";
import { trackBAdmissionSemantics, trackBAdmissionHttpSemantics } from "./trackBAdmissionContract";
import { trackBPublicCatalogSemantics } from "./trackBDisclosureContract";
import { stage10CoverageSemantics } from "./stage10Coverage";
import { FIXED_5GT_DESCRIPTOR } from "./quantityDescriptors";
export interface OutputFieldSemantic {
  id:string; meaning:string; role:"Input"|"Calculated"|"Output"; formula:string;
  dependencies:string[]; unit:string; source:string; period:string; geography:string;
  status:string; missingness:string; uncertainty:string; scope:string; asOfRule:string;
}
const financial = {
  source:"Selected immutable workbook and ordered approved overlays; source hash in request manifest; original publication dates unknown",
  period:"Monthly workbook observation date",geography:"Selected company population/geography",
  status:"Descriptive revised-history diagnostic; not validated forecast",
  missingness:"Require marketCap > 0 and non-null netProfit; negative individual profits retained. Omit date if either group is empty or aggregate profit <= 0, or resulting P/E is nonfinite/nonpositive.",
  uncertainty:"No calibrated uncertainty distribution",scope:"Current or explicitly selected historical workbook; not original-vintage evidence",
  asOfRule:"Selected workbook observation rows and declared overlay availability/approval cutoff; original publication availability remains unknown",
};
const peFinancial={...financial,geography:"Selected workbook universe; this endpoint does not apply a geography filter",
  missingness:"Require positive marketCap and positive netProfit for each member; omit dates unless both terciles contain eligible records. No missing-value replacement with zero."};
export const outputFieldSemantics:OutputFieldSemantic[]=[
  ...trackBAdmissionSemantics,
  ...trackBAdmissionHttpSemantics,
  ...trackBPublicCatalogSemantics,
  ...stage10CoverageSemantics,
  ...warmingValidationReferenceSemantics,
  ...conditionalCompanySemantics,
  ...indicatorFieldSemantics,
  ...regionalFieldSemantics,
  ...sensitivityFieldSemantics,
  ...projectionFieldSemantics,
  ...historicalFieldSemantics,
  ...nativeOutputSemantics,
  ...companyReviewSemantics,
  ...companyReplaySemantics,
  ...companyAbatementSemantics,
  ...companyCoverageSemantics,
  ...researchFieldSemantics,
  ...companySummarySemantics,
  ...backtestFieldSemantics,
  ...peerValuationSemantics,
  ...newsFieldSemantics,
  ...dataManagementSemantics,
  ...evidenceFieldSemantics,
  ...targetInputSemantics,
  ...diagnosticMetadataSemantics,
  ...signalComparisonSemantics,
  ...remainingFieldSemantics,
  ...nativePathwaySemantics,
  ...thresholdDiagnosticSemantics,
  ...nativeThresholdSemantics,
  {id:"pe.date",meaning:"Date of the compared carbon-intensity terciles",role:"Input",
    formula:"Workbook date grouping key",dependencies:["timeSeries.date"],unit:"ISO-8601 date",...peFinancial},
  ...["top","bottom"].flatMap(group=>[
    {id:`pe.${group}TercileAvgPE`,meaning:`Aggregate P/E of ${group} carbon-intensity tercile, not mean individual P/E`,
      role:"Output" as const,formula:`sum(${group}.marketCap) / sum(${group}.netProfit)`,
      dependencies:["marketCap","netProfit","carbonIntensity","method"],unit:"ratio",...peFinancial,
      missingness:"Only positive marketCap and positive netProfit rows; emit a date only if both terciles contain eligible records"},
    {id:`pe.${group}Count`,meaning:`Eligible company count in ${group} carbon-intensity tercile`,
      role:"Calculated" as const,formula:`count(${group} records with marketCap > 0 and netProfit > 0)`,
      dependencies:["marketCap","netProfit","carbonIntensity","method"],unit:"companies",...peFinancial},
    ...["MarketCap","Profit"].map(metric=>({id:`pe.${group}Total${metric}`,
      meaning:`Total ${metric==="MarketCap"?"market capitalisation":"profit"} for eligible ${group} tercile members`,
      role:"Calculated" as const,formula:`sum(${group}.${metric==="MarketCap"?"marketCap":"netProfit"} where marketCap > 0 and netProfit > 0)`,
      dependencies:["marketCap","netProfit","carbonIntensity","method"],unit:"USD million",...peFinancial})),
  ]),
  {id:"pe.premium",meaning:"Bottom-intensity tercile valuation premium relative to top-intensity tercile",
    role:"Output",formula:"100 * (bottomTercileAvgPE - topTercileAvgPE) / topTercileAvgPE",
    dependencies:["pe.bottomTercileAvgPE","pe.topTercileAvgPE"],unit:"percent",...peFinancial},
  {id:"sdg.date",meaning:"Workbook observation date shared by the two SDG groups",
    role:"Input",formula:"Date key of the grouped workbook observations",dependencies:["timeSeries.date"],
    unit:"ISO-8601 date",...financial},
  ...["clean","dirty"].flatMap(group=>[
    {id:`sdg.${group}PE`,meaning:`Aggregate P/E of ${group==="clean"?"positive":"nonpositive"} SDG-score companies`,
      role:"Calculated" as const,formula:"round(sum(eligible marketCap) / sum(eligible netProfit), 2)",
      dependencies:["marketCap","netProfit","sdgAlignmentScore"],unit:"ratio",...financial},
    {id:`sdg.${group}Growth`,meaning:`Gordon comparator for the ${group} SDG group`,
      role:"Output" as const,formula:"round(costOfEquity - sum(netProfit) / sum(marketCap), 4)",
      dependencies:["costOfEquity","marketCap","netProfit","sdgAlignmentScore"],unit:"fraction/year",...financial},
    {id:`sdg.${group}Count`,meaning:`Eligible companies in the ${group} SDG group`,
      role:"Calculated" as const,formula:"count(group members with eligible financial observations)",
      dependencies:["marketCap","netProfit","sdgAlignmentScore"],unit:"companies",...financial},
    ...["MarketCap","Profit"].map(metric=>({id:`sdg.${group}${metric}`,
      meaning:`Total ${metric==="MarketCap"?"market capitalisation":"profit"} in the ${group} SDG group`,
      role:"Calculated" as const,formula:`sum(eligible ${metric==="MarketCap"?"marketCap":"netProfit"})`,
      dependencies:[metric==="MarketCap"?"marketCap":"netProfit","sdgAlignmentScore"],unit:"USD million",...financial})),
  ]),
  {id:"legacy.threshold5GtYear",meaning:FIXED_5GT_DESCRIPTOR.label,
    role:"Output",formula:"min(year where trajectory[year].p50 <= 5), or null if not reached within simulated horizon",
    dependencies:["trajectory.year","trajectory.p50"],unit:"calendar year",
    source:"historicalTrajectoryMetrics; source version retained in material archive",period:"Simulated horizon through 2100",
    geography:"Global",status:"Unsupported legacy conditional diagnostic",missingness:"Null means not reached within horizon; never replace with 2200",
    uncertainty:"Median-trajectory threshold only, not member-level arrival uncertainty",scope:`${FIXED_5GT_DESCRIPTOR.description} Current-code or selected-input reconstruction, not historical forecast`,
    asOfRule:"Reconstruction for the input year; not a forecast originally issued at that date"},
];
export function requireOutputSemantic(id:string) {
  const entry=outputFieldSemantics.find(f=>f.id===id);
  if(!entry) throw new Error(`Unmapped field semantics: ${id}`);
  return entry;
}
export function bindOutputFields(prefix:string,rows:object[]) {
  const fields=Array.from(new Set(rows.flatMap(row=>Object.keys(row)))).sort();
  return fields.map(field=>requireOutputSemantic(`${prefix}.${field}`));
}
export type ExportFieldBinding={id:string;transform:string};
export function bindNestedOutput(prefix:string,value:unknown) {
  const paths=new Set<string>();
  function visit(item:unknown,path:string) {
    if(Array.isArray(item)) {
      if(!item.length) paths.add(`${path}[]`);
      for(const row of item) visit(row,`${path}[]`);
    } else if(item!==null && typeof item==="object") {
      const children=Object.entries(item);
      if(!children.length) paths.add(path);
      for(const [key,child] of children) visit(child,path?`${path}.${key}`:key);
    } else paths.add(path);
  }
  if(Array.isArray(value)) value.forEach(row=>visit(row,""));
  else visit(value,"");
  return Array.from(paths).sort().map(path=>requireOutputSemantic(`${prefix}.${path}`));
}
export function bindExportColumns(rows:Record<string,unknown>[],bindings:Record<string,ExportFieldBinding>) {
  const columns=Array.from(new Set(rows.flatMap(Object.keys))).sort();
  if(columns.some(c=>!bindings[c]) || Object.keys(bindings).some(c=>!columns.includes(c)))
    throw new Error("Unmapped or conflicting export columns");
  return columns.map(column=>({Column:column,FieldID:bindings[column].id,
    Transformation:bindings[column].transform,...requireOutputSemantic(bindings[column].id)}));
}
