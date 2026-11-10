import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { companySummarySemantics } from "./companySummarySemantics";
import { z } from "zod";
export const FETCH_SUMMARY_CONTRACT="indicator-fetch-producer-schema-v1";
export const persistedSummarySchema=z.object({
  perAdapter:z.array(z.object({
    id:z.string().min(1),values:z.number().int().nonnegative(),error:z.string().optional(),
  }).strict()),
  error:z.string().optional(),
}).strict();
/** Optional interpretation only. Never substitutes for the retained raw JSON value. */
export function describePersistedSummary(value:unknown) {
  const result=persistedSummarySchema.safeParse(value);
  return result.success
    ? {contract:FETCH_SUMMARY_CONTRACT,availability:"available" as const,claims:result.data,reason:null}
    : {contract:FETCH_SUMMARY_CONTRACT,availability:"unavailable" as const,claims:null,
      reason:"Unknown historical or absent summary schema; raw JSON remains available unchanged"};
}

type Spec = [string,string,string,string];
const definitions: Spec[] = [
  ["key","Registered historical-indicator property key","INDICATORS[].key","identifier"],
  ["label","Registered display label","INDICATORS[].label","text"],
  ["unit","Stored value unit, not display scaling","INDICATORS[].unit; fraction and percent are distinct","unit label"],
  ["category","Registered thematic category","INDICATORS[].category","label"],
  ["source","Registered expected publisher, not proof of retrieval","INDICATORS[].source","text"],
  ["tier","Registered acquisition tier A/B/C, not evidence acceptance","INDICATORS[].tier","label"],
  ["fetchMethod","Registered acquisition method","INDICATORS[].fetchMethod: api, websearch, derived or manual","label"],
  ["decimals","Suggested display decimal places, not measurement precision","INDICATORS[].decimals","decimal places"],
  ["searchHint","Optional continuity prompt for source search","INDICATORS[].searchHint; omitted when absent","text"],
];
const proposals: Spec[] = [
  ["id","Stored indicator proposal identity","indicator_values.id; generated UUID","identifier"],
  ["indicatorKey","Indicator property associated with proposal","indicator_values.indicator_key","identifier"],
  ["year","Proposed annual observation year, not availability date","indicator_values.year","calendar year"],
  ["value","Stored candidate value; approval state is separate","indicator_values.value, without numeric transformation","unit selected by indicatorKey from INDICATORS[].unit"],
  ["source","Submitted provenance source description","indicator_values.source","text"],
  ["sourceUrl","Submitted provenance link","indicator_values.source_url; nullable","URL"],
  ["asOfDate","Submitted information-as-of declaration; not independently verified","indicator_values.as_of_date; nullable","date text"],
  ["method","Submitted acquisition method","indicator_values.method; api, websearch, manual or curated","label"],
  ["status","Workflow state, not scientific acceptance","indicator_values.status; pending, approved, rejected or superseded","label"],
  ["rawContext","Stored acquisition context, not certified evidence","indicator_values.raw_context; nullable","text"],
  ["note","Stored operator/acquisition note","indicator_values.note; nullable","text"],
  ["runId","Associated ingestion-run identifier, absent for manual rows","indicator_values.run_id; nullable","identifier"],
  ["createdAt","Database ingestion time, NOT source publication time","indicator_values.created_at; defaultNow()","ISO timestamp"],
  ["decidedAt","Workflow decision time, NOT source publication time","indicator_values.decided_at; nullable","ISO timestamp"],
];
const specs: [string,Spec[]][] = [
  ["indicatorDetail",[
    ["proposals[]","All stored proposals for requested key, empty when none","SELECT indicator_values WHERE indicator_key = key ORDER BY created_at DESC","proposal rows"],
    ["series[]","Resolved historical and nowcast annual cells","getAllHistoricalIndicatorsWithNowcast().map(row => selected key and provenance)","annual rows"],
    ...definitions.map(([f,...rest]):Spec=>[`def.${f}`,...rest]),
    ...proposals.map(([f,...rest]):Spec=>[`proposals[].${f}`,...rest]),
    ["series[].year","Resolved annual observation year","getAllHistoricalIndicatorsWithNowcast()[].year","calendar year"],
    ["series[].value","Value consumed by legacy projection, not approved native driver","resolvedRow[requested key]; curated history plus nowcast and approved cell overrides","unit selected by def.key from def.unit; see indicator.<key> semantic for the underlying quantity"],
    ["series[].source","Resolved cell source label","override ? override.source : row.isNowcast ? 'Nowcast (estimated)' : 'Curated baseline'","text"],
    ["series[].method","Resolved cell method","override ? override.method : row.isNowcast ? 'nowcast' : 'curated'","label"],
    ["series[].asOfDate","Override-declared availability date only","override?.asOfDate ?? null","date text"],
    ["series[].sourceUrl","Override provenance link only","override?.sourceUrl ?? null","URL"],
    ["series[].overridden","Whether an approved cell override exists","!!getOverrideMeta(key,row.year)","boolean"],
    ["series[].isNowcast","Nowcast flag suppressed for approved override; false is not vintage certification","override ? false : row.isNowcast","boolean"],
  ]],
  ["indicatorInventory",[
    ["indicators[]","Registered indicator operational inventory","INDICATORS.map(def => resolved last cell, provenance and pending count)","indicator rows"],
    ...definitions.filter(([f])=>f!=="searchHint").map(([f,...rest]):Spec=>[`indicators[].${f}`,...rest]),
    ["baselineYear","Route-declared curated baseline year","constant 2024","calendar year"],
    ["latestYear","Last resolved nowcast observation year","resolved[resolved.length-1].year","calendar year"],
    ["indicators[].appliedYear","Last resolved model-input observation year","latestRow.year","calendar year"],
    ["indicators[].appliedValue","Value consumed by legacy model at latest resolved year","latestRow[def.key] without scaling","unit selected by indicators[].key from indicators[].unit; see indicator.<key> semantic"],
    ["indicators[].appliedIsNowcast","Resolved last-cell nowcast flag","getOverrideMeta(def.key,appliedYear) ? false : latestRow.isNowcast","boolean"],
    ["indicators[].provenance","Resolved last-cell acquisition method","meta ? meta.method : latestRow.isNowcast ? 'nowcast' : 'curated'","label"],
    ["indicators[].provenanceSource","Override source or registry publisher label","meta ? meta.source : def.source","text"],
    ["indicators[].provenanceAsOf","Declared override as-of, never inferred from year","meta ? meta.asOfDate ?? null : null","date text"],
    ["indicators[].curatedLatest","Latest static curated value, not latest resolved/override value","HISTORICAL_INDICATORS.at(-1)?.[def.key]","unit selected by indicators[].key from indicators[].unit"],
    ["indicators[].pendingCount","Pending proposals for this indicator across all years","count(getPendingValues() where indicatorKey === def.key); absent key gives 0","proposals"],
  ]],
];
const context = {
  role:"Output" as const, dependencies:["INDICATORS","getAllHistoricalIndicatorsWithNowcast","getOverrideMeta","indicator_values"],
  source:"server/routes.ts data indicator GET routes; server/dataIngestion/indicatorRegistry.ts and dataStore.ts; shared/schema.ts",
  period:"Annual observations; metadata dates describe workflow or declared provenance",
  geography:"Global indicator definitions; publisher-specific coverage limitations remain",
  status:"Operational descriptive metadata; approval/nowcast flags do not confer scientific acceptance or point-in-time certification",
  missingness:"Nullable provenance/context/decision fields stay null; absent optional registry searchHint and curated value may be omitted. No numeric zero imputation. Empty proposal history is [].",
  uncertainty:"No calibrated uncertainty attached to acquisition metadata or resolved values",
  scope:"Read-only inventory of current resolved legacy inputs and all proposals for the requested key, newest creation first; not native-driver admission",
  asOfRule:"Current stored approved overrides and static history/nowcast. Proposal createdAt/decidedAt are ingestion/decision timestamps; asOfDate is a nullable declaration, not verified source publication.",
};
export const dataManagementSemantics:OutputFieldSemantic[] = [
  ...proposals.map(([field,meaning,formula,unit])=>({
    id:`indicatorProposal.${field}`,meaning,formula,unit,...context,
    source:"server/routes.ts operator approve/reject/manual responses; server/dataIngestion/dataStore.ts; shared/schema.ts",
  })),
  ...specs.flatMap(([prefix,rows])=>rows.map(([field,meaning,formula,unit])=>({
    id:`${prefix}.${field}`,meaning,formula,unit,...context,
  }))),
  ...companySummarySemantics.filter(f=>f.id.startsWith("companySummary.latestUpload.")).map(f=>({
    ...f,id:f.id.replace("companySummary.latestUpload.","upload."),
    source:"shared/schema.ts cvDataUploads; server/routes.ts GET /api/cv/uploads and /api/cv/upload/:id/status",
    formula:f.formula.replace("latest cv_data_uploads","selected cv_data_uploads").replace("cv_data_uploads ORDER BY id DESC LIMIT 1: id","selected cv_data_uploads.id"),
    meaning:f.meaning.replace("Most recent upload by descending database identity","Upload database identity"),
    scope:"Live ingestion metadata; uploads listed by descending id, status selects requested id",
    asOfRule:"Current database row; createdAt/completedAt are ingestion events, never original publication availability",
  })),
];
