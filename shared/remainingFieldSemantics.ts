import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { gordonBaselineSemantics } from "./gordonBaselineSemantics";
import { originalNominalAssessmentSemantics } from "./originalNominalAssessmentSemantics";

type Spec = [string,string,string,string];
const financial = {
  role:"Output" as const, dependencies:["selected workbook companies/timeSeries","query method/geography/settings"],
  source:"server/climateValuation/carbonPriceCalculator.ts; decarbBandCalculator.ts; decarbTercileCalculator.ts; sharedUtils.ts; publicValuationContract.ts",
  period:"Workbook timestamp groups, sorted ascending; target classifications are static revised company attributes",
  geography:"Requested geography for carbon-price and terciles; bands use the whole selected workbook",
  status:"Descriptive revised-history valuation/target diagnostic; no physical inference or scientific acceptance",
  missingness:"No across-date carry-forward. Endpoint-specific eligibility and omissions apply; reported band zero can mean no eligible records, not observed zero P/E.",
  uncertainty:"No calibrated uncertainty; static targets are not verified realised reductions",
  scope:"Immutable selected workbook and ordered overlays, or live mutable workbook without selection. Monetary fields use workbook USD million; no implicit FX conversion.",
  asOfRule:"Observation timestamps and current/revised target classifications do not certify original publication availability",
};
const carbon:Spec[] = [
  ["date","Group observation timestamp","new Date(groupTimeSeriesByDate ISO key)","ISO timestamp"],
  ["inferenceMethod","Requested grouping method, not a validated inference","query.inferenceMethod || 'carbon_intensity'; carbon_intensity, climate_revenue or decarbonization_ambition","label"],
  ["highGroupLabel","Higher-risk grouping label","carbon_intensity: 'Most Carbon-Intensive'; climate_revenue: 'Non-Climate-Aligned'; decarbonization_ambition: 'Weak/No Targets'","text"],
  ["lowGroupLabel","Lower-risk grouping label","carbon_intensity: 'Cleanest'; climate_revenue: 'Climate-Aligned Revenue'; decarbonization_ambition: 'Ambitious Targets'","text"],
  ...(["top","bottom"] as const).flatMap(group=>[
    [`${group}TercileEmissions`,"Group reported emissions total, not emissions caused by valuation","sum(eligible scope1||0 + scope2||0 + (includeScope3 ? scope3||0 : 0)); each company sum independently winsorized if enabled and n>10","tCO2e"],
    [`${group}TercileProfit`,"Aggregate reported profit, with negative members retained","sum(eligible netProfit); independently winsorized if enabled and n>10","USD million"],
    [`${group}TercileMarketCap`,"Aggregate market capitalisation","sum(eligible marketCap); independently winsorized if enabled and n>10","USD million"],
    [`${group}TercilePeRatio`,"Aggregate P/E, not average individual P/E","totalProfit>0 ? totalMarketCap/totalProfit : 0; date subsequently omitted unless both group ratios finite and positive","ratio"],
    [`${group}TercileCompanyCount`,"Eligible records, not necessarily distinct company identities","count(group rows with non-null marketCap and netProfit and at least one of scope1/scope2 non-null)","records"],
  ] as Spec[]),
];
const grouping = "carbon_intensity: scope emissions/marketCap terciles per timestamp, absolute or within nonempty sectors. climate_revenue: static sdgAlignmentScore>0 lower risk, <=0 higher, null excluded. decarbonization_ambition: static target<=upper median lower risk; missing target higher risk when any target exists. Top means higher risk; bottom lower. Winsorization independently clamps each vector to sorted floor(n*p/100) and floor(n*(100-p)/100)-1 values. Omit date if either count=0, high emissions<=0, or either group P/E is not finite positive. Legacy missing scopes use ||0; this limitation is described, not endorsed.";
const bands:Spec[] = [
  ["date","Target-band observation timestamp","new Date(groupTimeSeriesByDate ISO key)","ISO timestamp"],
  ["bands[].label","Declared-target band label with explicit legacy representative exceptions","BAND_LABELS[i]: <1% (rep. 0%),1-2%,2-3%,3-4%,4-5%,5-7%,7-10%,Unused legacy index 7,10%+ (rep. 12%); getBandIndex loops edges [0,1,2,3,4,5,7,10], returns max(0,i-1) at first rate<edge, otherwise 8; thus index7 is unreachable, index0 also includes negative rates","text"],
  ["bands[].midpoint","Legacy representative, not measured target or guaranteed interval midpoint","i=0 =>0; i>=8 =>12; otherwise (BAND_EDGES[i]+BAND_EDGES[i+1])/2; index7 representative11.5 is unused. Relabelling does not change these numerical values or assignments.","percent/year"],
  ["bands[].pe","Rounded aggregate band P/E","positive aggregate profit ? round(100*totalMarketCap/totalProfit)/100 : 0; empty band =>0","ratio"],
  ["bands[].companyCount","Eligible observation records in band","count(rows assigned band with marketCap>0 and non-null netProfit)","records"],
  ["bands[].totalMarketCap","Band market capitalisation","sum(eligible marketCap); empty band =>0","USD million"],
  ["bands[].totalProfit","Band profit including negative members","sum(eligible netProfit); empty band =>0","USD million"],
  ["peakBand","Legacy band with highest unrounded aggregate P/E and at least three records","strict > update while iterating ascending bands; earliest band wins ties; omit date if peakPE<=0","text"],
  ["peakBandMidpoint","Representative of peak P/E band, not inferred physical rate","getBandMidpoint(peakBandIdx)","percent/year"],
  ["weightedAvgDecarbRate","Legacy P/E-weighted band representative, not measured decarbonisation","round(1000*sum(b.midpoint*b.pe)/sum(b.pe))/1000 over positive rounded P/E, nonempty bands; not market-cap weighted","percent/year"],
];
const terciles:Spec[] = [
  ["date","Target-tercile observation timestamp","new Date(groupTimeSeriesByDate ISO key)","ISO timestamp"],
  ["growthPremium","Difference in unrounded Gordon comparators, rounded after subtraction","round(10000*((r-1/bestPE)-(r-1/worstPE)))/10000; not difference of rounded API growth values","fraction/year"],
  ...(["best","worst"] as const).flatMap(group=>[
    [`${group}TercilePE`,"Aggregate target-group P/E","round(100*sum(eligible marketCap)/sum(eligible netProfit))/100","ratio"],
    [`${group}TercileAvgDecarbRate`,"Mean declared annualised target rate, not realised emissions change","round(100*mean(rateMap[companyId] for eligible observation rows))/100; rate=100*(1-(1+emissionTarget2050)^(1/(2050-targetEvidence.baseYear))); targetEvidence schema must parse, finite target>-1, integer baseYear<2050; positive signed target yields negative rate","percent/year"],
    [`${group}TercileCompanyCount`,"Eligible target-group records at timestamp","count(group rows with marketCap>0 and non-null netProfit)","records"],
    [`${group}TercileMarketCap`,"Aggregate target-group market capitalisation","sum(eligible marketCap)","USD million"],
    [`${group}TercileProfit`,"Aggregate target-group profit including negative members","sum(eligible netProfit)","USD million"],
    [`${group}ImpliedGrowth`,"Gordon comparator, not measured company growth","round(10000*(costOfEquity-1/unroundedGroupPE))/10000; default r=.08","fraction/year"],
  ] as Spec[]),
];
const operational = {
  role:"Output" as const,dependencies:["route response","stored workflow records"],
  source:"server/routes.ts; server/dataIngestion/orchestrator.ts; dataStore.ts; summaryContract.ts; shared/schema.ts",
  period:"Current workflow execution or current stored ingestion history",geography:"Not applicable to operational metadata",
  status:"Operational metadata; not scientific acceptance, source verification or a forecast",
  missingness:"Nullable event timestamps remain null; skipped runs use empty id, zero counts and empty perAdapter; errors are explicit",
  uncertainty:"No statistical uncertainty attached to workflow metadata",
  scope:"Operator mutation responses remain protected; describing them does not authorize execution",
  asOfRule:"Workflow/ingestion timestamps are not observation or original publication dates",
};
const operations:[string,Spec[]][] = [
  ["snapshotList",[
    ["status","Snapshot inventory availability","snapshotsAvailable() ? 'available' : 'not-provisioned'","label"],
    ["nextCursor","Exclusive next snapshot id or null","rows.length>100 ? items.at(-1).id : null; unprovisioned =>null","nullable identifier"],
    ["items[]","Empty inventory page","[] when unprovisioned or no matching records; never fabricated entries","empty collection"],
    ["items[].id","Immutable snapshot content identity","cvAnalysisSnapshots.id; page ordered ascending id, exclusive cursor, max100 rows","SHA-256 identifier"],
    ["items[].kind","Stored snapshot material kind","cvAnalysisSnapshots.kind; optional validated kind filter","label"],
    ["items[].companyCount","Stored company-row count, not accepted issuer coverage","cvAnalysisSnapshots.companyCount; nullable for non-workbook material","nullable rows"],
    ["items[].observationCount","Stored observation-row count","cvAnalysisSnapshots.observationCount; nullable for non-workbook material","nullable rows"],
    ["items[].createdAt","Snapshot archive creation time, not input publication time","cvAnalysisSnapshots.createdAt","ISO timestamp"],
  ]],
  ["health",[["status","Database readiness, not analytical validity","SELECT 1 FROM indicator_values succeeds => 'ok'; exception => 'unavailable' and HTTP503","label"]]],
  ["refreshCache",[
    ["success","Cache refresh acknowledgement","true after cache invalidation completes","boolean"],
    ["message","Cache refresh response message","literal 'All caches cleared. Analysis will re-run on next request.' after cache invalidation; not a data quality verdict","text"],
  ]],
  ["uploadAccepted",[
    ["uploadId","New upload database identity","insert(cvDataUploads).returning().id","integer identifier"],
    ["status","Upload acceptance state, not completion","constant 'processing'; parser runs asynchronously","label"],
  ]],
  ["uploadReset",[
    ["companiesCount","Current company count after operator reset","COUNT(*) from cvCompanies","records"],
    ["timeSeriesCount","Current observation count after operator reset","COUNT(*) from cvTimeSeries","records"],
    ["message","Reset acknowledgement","tsCount>0 && compCount>0 ? 'Upload recovered' : 'Upload marked as failed - no data found. Please re-upload.'","text"],
  ]],
  ["fetchSummary",[
    ["runId","Ingestion run database identity","created run.id; skipped lock/stale-running case =>empty string","identifier"],
    ["status","Execution state, not source acceptance","completed after adapter loop even if some failed; failed on outer error; skipped on lock/running refusal","label"],
    ["proposalsCreated","Inserted pending proposal rows","insertProposals(allValues,run.id) returned length; skipped/failed =>0","rows"],
    ["adaptersSucceeded","Adapters returning without exception","increment per successful adapter.fetch, including empty return","adapters"],
    ["adaptersFailed","Adapters throwing exceptions","increment per caught adapter.fetch exception","adapters"],
    ["perAdapter[].id","Registered adapter identity","ADAPTERS[].id","identifier"],
    ["perAdapter[].values","Fetched rows per adapter","returned values.length; exception =>0","rows"],
    ["perAdapter[].error","Adapter failure message, absent on success","caught Error.message ?? String(error)","text"],
  ]],
  ["fetchRuns",[
    ["runs[].id","Stored ingestion run identity","indicator_fetch_runs.id","identifier"],
    ["runs[].trigger","How collection was invoked","manual or scheduled","label"],
    ["runs[].status","Stored execution state","running, completed or failed; completed need not mean all adapters succeeded","label"],
    ["runs[].startedAt","Database run creation timestamp","indicator_fetch_runs.started_at","ISO timestamp"],
    ["runs[].finishedAt","Run completion timestamp","finishFetchRun assigns new Date(); null while running","nullable ISO timestamp"],
    ["runs[].proposalsCreated","Stored pending proposal insertion count","finishFetchRun.proposalsCreated","rows"],
    ["runs[].adaptersSucceeded","Stored adapter successes","finishFetchRun.adaptersSucceeded","adapters"],
    ["runs[].adaptersFailed","Stored adapter failures","finishFetchRun.adaptersFailed","adapters"],
    ["runs[].summary","Unmodified retained ingestion-summary JSON container; unknown historical leaves remain semantically unresolved",
      "identity(indicator_fetch_runs.summary JSONB). Current orchestrator producer stores {perAdapter:[{id,values,error?}],error?}; optional strict producer interpretation never replaces raw value. Arbitrary historical shapes remain in the API unchanged; container documentation is NOT exhaustive leaf coverage and earns no original opaque-slot completion credit.",
      "retained JSON value; historical leaf units unknown"],
  ]],
  ["fetchSummaryProducer",[
    ["perAdapter[]","Known producer's empty retained adapter-result list","[] when stored perAdapter is empty and strict producer schema parses; not historical-schema completeness","empty collection"],
    ["perAdapter[].id","Retained adapter identity declaration","orchestrator perAdapter.push({id: adapter.id,...}); nonempty string; not source verification","identifier"],
    ["perAdapter[].values","Retained adapter fetched-row count, not approved values or unique indicators","orchestrator assigns fetched values.length (or0 in caught adapter failure); finite nonnegative integer; unchanged;0 is producer result, not missing-source imputation","fetched rows"],
    ["perAdapter[].error","Retained optional adapter failure message","orchestrator caught adapter error message; absent on success; stored text unchanged","text"],
    ["error","Retained optional outer ingestion failure message","orchestrator outer caught error message; absent when not stored; unchanged","text"],
  ]],
];
export const remainingFieldSemantics:OutputFieldSemantic[] = [
  ...gordonBaselineSemantics,
  ...originalNominalAssessmentSemantics,
  ...([["carbonGroups",carbon],["targetBands",bands],["targetTerciles",terciles]] as [string,Spec[]][]).flatMap(([prefix,specs])=>
    specs.map(([field,meaning,formula,unit])=>({...financial,id:`${prefix}.${field}`,meaning,formula,unit,
      scope:financial.scope+(prefix==="carbonGroups" ? ` ${grouping}` :
        " Target eligibility requires parsed targetEvidence and finite signed target>-1, integer baseYear<2050; rate=100*(1-(1+target)^(1/(2050-baseYear))). Missing target base year is never assumed2024."),
      missingness:prefix==="targetTerciles" ? "Static target rates sorted ascending; floor(n/3) worst/best, within selected peer groups (n<3 excluded) or absolute universe. Per timestamp require nonempty groups, positive aggregate profits and finite positive P/E; no carry-forward." :
        prefix==="targetBands" ? "Exclude companies without valid based target evidence; [] if no valid targets. Within each timestamp use non-null marketCap/netProfit then marketCap>0. Empty bands emit zero count/totals/P/E; nonpositive aggregate profit emits P/E0. Omit date unless a band with at least3 records has unrounded P/E>0. No across-date carry-forward." : financial.missingness}))),
  ...operations.flatMap(([prefix,specs])=>specs.map(([field,meaning,formula,unit])=>({
    ...operational,id:`${prefix}.${field}`,meaning,formula,unit,
  }))),
];

/** Exact original route families; metadata alone never changes route authorization. */
export const remainingApiBindings = [
  ['API GET "/api/analysis/snapshots"',"snapshotList"],
  ['API GET "/api/health"',"health"],
  ['API POST "/api/refresh"',"refreshCache"],
  ['API POST "/api/cv/upload"',"uploadAccepted"],
  ['API POST "/api/cv/upload/:id/reset"',"uploadReset"],
  ['API GET "/api/cv/carbon-price"',"carbonGroups"],
  ['API GET "/api/cv/decarb-bands"',"targetBands"],
  ['API GET "/api/cv/decarb-terciles"',"targetTerciles"],
  ['API POST "/api/data/refresh"',"fetchSummary"],
  ['API GET "/api/data/runs"',"fetchRuns"],
  ['API POST "/api/data/proposals/:id/approve"',"indicatorProposal"],
  ['API POST "/api/data/proposals/:id/reject"',"indicatorProposal"],
  ['API POST "/api/data/indicator/:key/manual"',"indicatorProposal"],
] as const;
