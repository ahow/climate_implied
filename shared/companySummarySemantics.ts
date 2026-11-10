import type { OutputFieldSemantic } from "./outputFieldSemantics";

export const companySummarySpecs: [string,string,string,string][] = [
  ["companiesCount","Company rows in the selected dataset, not investable/eligible count","companies.length after loadCompaniesAndTimeSeries(false)","companies"],
  ["dateRange.minDate","Earliest raw time-series observation date","min(rawTimeSeries[].date), initialized null for no rows","ISO timestamp"],
  ["dateRange.maxDate","Latest raw time-series observation date","max(rawTimeSeries[].date), initialized null for no rows","ISO timestamp"],
  ["dateRange.recordCount","Raw company/date records before emissions carry-forward","rawTimeSeries.length","records"],
  ["sectors","Distinct nonempty company sectors","new Set(companies.map(c=>c.sector).filter(Boolean)).size","sectors"],
  ["geographies","Distinct nonempty company geographies","new Set(companies.map(c=>c.geography).filter(Boolean)).size","geographies"],
  ["snapshotId","Selected immutable snapshot ID, absent for live selection","snapshotContext.getStore()?.id ?? null","identifier"],
  ["imputation.totalRecords","Records evaluated for emissions carry-forward","carryForwardEmissions(rawTimeSeries).length","records"],
  ["imputation.imputedRecords","Records with at least one carried-forward emissions scope","count(records where isImputed); carry-forward uses last non-null observation by company in ascending date order, separately for each scope","records"],
  ["imputation.imputedFraction","Fraction of records with any carried-forward scope, not percent","totalRecords > 0 ? imputedRecords / totalRecords : 0","fraction"],
  ...(["scope1","scope2","scope3"] as const).map((scope): [string,string,string,string]=>[
    `imputation.imputedByScope.${scope}`,`Records with carried-forward ${scope}; scopes can overlap`,
    `count(records where isImputed and imputedScopes includes "${scope}"); only null/undefined values with a prior non-null ${scope} are filled`,"records"]),
  ["latestUpload","Latest upload metadata is deliberately absent in snapshot context","snapshotContext.getStore() ? null : uploads[0] || null","nullable upload record"],
  ["latestUpload.id","Most recent upload by descending database identity, not source vintage","cv_data_uploads ORDER BY id DESC LIMIT 1: id","identifier"],
  ["latestUpload.filename","Stored uploaded filename, not a content hash","latest cv_data_uploads.filename","text"],
  ["latestUpload.status","Stored upload processing state, not calculation readiness","latest cv_data_uploads.status; processing default, subsequently updated by upload workflow","label"],
  ["latestUpload.companiesCount","Stored upload company count, not necessarily current selected company count","latest cv_data_uploads.companies_count populated from parsed stats.totalCompanies (or recovery count)","companies"],
  ["latestUpload.timePeriodsCount","Stored parsed workbook time-period count","latest cv_data_uploads.time_periods_count populated from parsed stats.totalTimePeriods","periods"],
  ["latestUpload.errorMessage","Stored upload processing error, if any","latest cv_data_uploads.error_message","text"],
  ["latestUpload.createdAt","Upload record creation timestamp, NOT original publication availability","latest cv_data_uploads.created_at; database defaultNow()","ISO timestamp"],
  ["latestUpload.completedAt","Upload processing completion timestamp, NOT source vintage","latest cv_data_uploads.completed_at","ISO timestamp"],
];
const context = {
  role:"Output" as const,
  source:"server/routes.ts /api/cv/summary; climateValuation/sharedUtils.ts; emissionsCarryForward.ts; shared/schema.ts cvDataUploads",
  dependencies:["loadCompaniesAndTimeSeries(false)","snapshotContext","cvDataUploads","carryForwardEmissions","computeImputationStats"],
  period:"Selected workbook raw observation span; upload timestamps describe ingestion only",
  geography:"Selected company universe; no endpoint geography filter",
  status:"Descriptive dataset/imputation metadata, not valuation or physical inference",
  missingness:"Empty raw history yields null date bounds; snapshot mode or no uploads yields null latestUpload. Nullable upload counters/timestamps/errors remain null. Scope carry-forward never fills leading missing observations.",
  uncertainty:"No calibrated uncertainty; carry-forward is an imputation disclosure, not observed emissions",
  scope:"Selected snapshot or live workbook rows and declared overlays; latest upload is live-only metadata",
  asOfRule:"Selected snapshot context when present; otherwise current stored rows. Original publication dates are not inferred from ingestion timestamps",
};
export const companySummarySemantics: OutputFieldSemantic[] = [
  ...companySummarySpecs.map(([field,meaning,formula,unit])=>({id:`companySummary.${field}`,meaning,formula,unit,...context})),
  ...(["sectors","geographies"] as const).map(field=>({
    id:`companyDimensions.${field}[]`,meaning:`Sorted distinct nonempty ${field} in the selected company universe`,
    formula:`Array.from(new Set(companies.map(c=>c.${field==="sectors"?"sector":"geography"}).filter(Boolean))).sort()`,
    unit:"label",...context,source:"server/routes.ts /api/cv/dimensions; loadCompaniesAndTimeSeries(false)",
    missingness:"Null/empty labels excluded; empty universe returns []; no replacement category invented",
  })),
];
