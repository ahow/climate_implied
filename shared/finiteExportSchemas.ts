import { bindExportColumns, type ExportFieldBinding } from "./outputFieldSemantics";
import { indicatorFieldSpecs } from "./indicatorFieldSemantics";

export type FiniteExportFamily="categoryTrend"|"indicatorCards"|"valuationPE"|"indicatorDetail"|"groupGap"|"signalCumulative";
export const categoryExportNames={
  all:"All (Baseline)",technology:"Technology",policy:"Policy",corporate:"Corporate",
  socioeconomic:"Socioeconomic",financial:"Financial Flows",emissions:"Emissions",
};
export const categoryExportKeys=Object.keys(categoryExportNames) as (keyof typeof categoryExportNames)[];
export const finiteMeasures={
  carbon_intensity:{label:"Carbon Intensity",id:"signalComparison.carbonIntensity"},
  sdg_alignment:{label:"SDG Alignment",id:"signalComparison.sdgExposure"},
  decarb_ambition:{label:"Decarb Ambition",id:"signalComparison.decarbAmbition"},
};
export const finiteSignals={
  carbon_intensity:"Carbon Intensity",sdg_exposure:"SDG Exposure",decarb_ambition:"Decarb Ambition",
};
const valuationCases={
  carbon:{high:"Low Carbon (Clean)",low:"High Carbon (Dirty)",highId:"carbonGroups.bottomTercilePeRatio",lowId:"carbonGroups.topTercilePeRatio",date:"carbonGroups.date"},
  sdg:{high:"Positive SDG (Clean)",low:"Negative SDG (Dirty)",highId:"sdg.cleanPE",lowId:"sdg.dirtyPE",date:"sdg.date"},
  ambition:{high:"Most Ambitious",low:"Least Ambitious",highId:"targetTerciles.bestTercilePE",lowId:"targetTerciles.worstTercilePE",date:"targetTerciles.date"},
};
export type FiniteExportSettings={metric?:string;keys?:string[];case?:string;key?:string;measure?:string;signal?:string};
function indicator(key:string|undefined) {
  const spec=indicatorFieldSpecs.find(s=>s[0]===key);
  if(!spec) throw new Error(`Unknown indicator export key: ${String(key)}`);
  return spec;
}
export function indicatorExportColumn(key:string) {
  const [,_meaning,unit]=indicator(key);
  // Quantity names and native numeric units are from the qualified dictionary,
  // not presentation units that may have already multiplied a fraction by100.
  return `${key} (${unit})`;
}
export function indicatorValueColumn(key:string|undefined) {
  return `Value (${indicator(key)[2]})`;
}
export function groupGapExportColumn(measure:string) {
  const selected=finiteMeasures[measure as keyof typeof finiteMeasures];
  if(!selected) throw new Error(`Unknown group-gap export measure: ${measure}`);
  return `Group earnings-yield gap - ${selected.label} (pp)`;
}
export function signalCumulativeColumn(signal:string) {
  const label=finiteSignals[signal as keyof typeof finiteSignals];
  if(!label) throw new Error(`Unknown cumulative export signal: ${signal}`);
  return `${label} Portfolio Cumulative Return (%)`;
}
const binding=(id:string,transform:string):ExportFieldBinding=>({id,transform});
/** Every dynamic label belongs to an explicit finite domain, never arbitrary keys. */
export function finiteExportBindings(family:FiniteExportFamily,settings:FiniteExportSettings={}):Record<string,ExportFieldBinding> {
  switch(family) {
    case "categoryTrend": {
      if(!["median","reductionRate","netZeroYear"].includes(settings.metric??""))
        throw new Error(`Unknown category export metric: ${settings.metric}`);
      return {
        Year:binding("categoryHistory.year","Identity"),
        Estimated:binding("categoryHistory.isNowcast","true -> yes; false -> no; not vintage certification"),
        "Historical type code":binding("categoryHistory.historicalTypeCode","Identity; missing or inconsistent historical class refuses export"),
        "Historical type label":binding("categoryHistory.historicalTypeLabel","Exact S09-001 original child-clause label"),
        ...Object.fromEntries(categoryExportKeys.map(key=>[categoryExportNames[key],
          binding(`categoryHistory.${key}.${settings.metric}`,"Identity; null/undefined -> blank; fixed5Gt threshold is not5% or net zero")])),
      };
    }
    case "indicatorCards": {
      if(!settings.keys || new Set(settings.keys).size!==settings.keys.length)
        throw new Error("Indicator export requires unique explicit registry keys");
      return {
        Year:binding("indicator.year","Identity"),
        Estimated:binding("indicator.isNowcast","true -> yes; false -> no; not original-vintage certification"),
        ...Object.fromEntries(settings.keys.map(key=>[indicatorExportColumn(key),
          binding(`indicator.${key}`,"Identity in dictionary native unit; no display percent scaling")])),
      };
    }
    case "valuationPE": {
      const selected=valuationCases[settings.case as keyof typeof valuationCases];
      if(!selected) throw new Error(`Unknown valuation export case: ${settings.case}`);
      return {
        Date:binding(selected.date,"ISO observation -> chart milliseconds -> toLocaleDateString en-US year:numeric month:short day:numeric; browser local timezone"),
        [`${selected.high} P/E (x)`]:binding(selected.highId,"Math.round(API P/E*100)/100; SDG and target API already rounded; ratio, not growth"),
        [`${selected.low} P/E (x)`]:binding(selected.lowId,"Math.round(API P/E*100)/100; SDG and target API already rounded; ratio, not growth"),
      };
    }
    case "indicatorDetail": {
      indicator(settings.key);
      return {
        Year:binding("indicatorDetail.series[].year","Identity"),
        [indicatorValueColumn(settings.key)]:binding(`indicator.${settings.key}`,"Identity in selected indicator native numeric unit; no zero imputation"),
        Type:binding("indicatorDetail.series[].isNowcast","true -> Estimated (nowcast); false -> Retained (not nowcast); false does not certify observations/vintage"),
        Source:binding("indicatorDetail.series[].source","Identity"),
        Method:binding("indicatorDetail.series[].method","Identity"),
        "As Of Date":binding("indicatorDetail.series[].asOfDate","null -> empty text; declared provenance only"),
      };
    }
    case "groupGap": {
      const selected=finiteMeasures[settings.measure as keyof typeof finiteMeasures];
      if(!selected) throw new Error(`Unknown group-gap export measure: ${settings.measure}`);
      return {
        Date:binding("signalComparison.date","Observation milliseconds -> toLocaleDateString en-US month:short year:numeric; browser local timezone"),
        [groupGapExportColumn(settings.measure!)]:binding(selected.id,"Identity in percentage points; missing/nonfinite P/E produces unavailable blank, not zero"),
      };
    }
    case "signalCumulative": return {
      Date:binding("backtest.date","Identity UTC YYYY-MM"),
      "Benchmark Cumulative Return (%)":binding("backtest.benchmarkCumulative","Math.round((wealth-1)*10000)/100"),
      [signalCumulativeColumn(settings.signal!)]:binding("backtest.portfolioCumulative","Math.round((wealth-1)*10000)/100; finite selected signal label"),
    };
    default: throw new Error(`Unknown finite export family: ${String(family)}`);
  }
}
export function finiteExportCellDomains(family:FiniteExportFamily,settings:FiniteExportSettings) {
  return Object.fromEntries(Object.keys(finiteExportBindings(family,settings)).map(column=>{
    const type=column==="Year"?"integer":
      ["Date","Estimated","Type","Source","Method","As Of Date","Historical type code","Historical type label"].includes(column)?"text":
      "finite-number";
    const allowed=column==="Estimated"?["yes","no"]:
      column==="Type"?["Estimated (nowcast)","Retained (not nowcast)"]:null;
    return [column,{type,nullable:!["Year","Date","Estimated","Type","Source","Method","As Of Date","Historical type code","Historical type label"].includes(column),
      allowed,
      pattern:family==="signalCumulative"&&column==="Date"?"^\\d{4}-(0[1-9]|1[0-2])$":null}];
  }));
}
/** Called on the actual production row builder; returns the same typed rows.
 * Empty data is not an export and grants no runtime coverage. Nonempty rows
 * must have exactly the finite schema, on EVERY row, not merely the union.
 */
export function certifyFiniteExport<T extends object>(family:FiniteExportFamily,rows:T[],settings:FiniteExportSettings):T[] {
  if(!rows.length) return rows;
  const bindings=finiteExportBindings(family,settings);
  const domains=finiteExportCellDomains(family,settings);
  const expected=Object.keys(bindings).sort();
  for(const row of rows) {
    if(JSON.stringify(Object.keys(row).sort())!==JSON.stringify(expected))
      throw new Error(`Finite export row/schema mismatch: ${family}`);
    for(const [column,value] of Object.entries(row)) {
      const domain=domains[column];
      if(value===null||value===undefined) {
        if(domain.nullable) continue;
        throw new Error(`Invalid export cell: ${family}`);
      }
      if(domain.type==="text" ? typeof value!=="string"||value==="Invalid Date"||
          !!domain.allowed&&!domain.allowed.includes(value) ||
          !!domain.pattern&&!new RegExp(domain.pattern).test(value) :
        typeof value!=="number"||!Number.isFinite(value)||
          domain.type==="integer"&&!Number.isInteger(value))
        throw new Error(`Invalid export cell: ${family}.${column}`);
    }
  }
  bindExportColumns(rows as Record<string,unknown>[],bindings);
  return rows;
}

/** Machine-readable, supplemental concrete domain. These columns do not become
 * new ORIGINAL slots: a reviewed original dynamic slot is one schema boundary.
 */
export function finiteExportDomainCases():{family:FiniteExportFamily;settings:FiniteExportSettings}[] {
  return [
    ...["median","reductionRate","netZeroYear"].map(metric=>({family:"categoryTrend" as const,settings:{metric}})),
    {family:"indicatorCards",settings:{keys:indicatorFieldSpecs.map(s=>s[0])}},
    ...Object.keys(valuationCases).map(value=>({family:"valuationPE" as const,settings:{case:value}})),
    ...indicatorFieldSpecs.map(s=>({family:"indicatorDetail" as const,settings:{key:s[0]}})),
    ...Object.keys(finiteMeasures).map(measure=>({family:"groupGap" as const,settings:{measure}})),
    ...Object.keys(finiteSignals).map(signal=>({family:"signalCumulative" as const,settings:{signal}})),
  ];
}
