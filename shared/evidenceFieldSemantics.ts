import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { scientificEvidenceSemantics } from "./scientificEvidenceSemantics";

type Spec = [string, string, string, string, ("Input" | "Calculated" | "Output")?];
const families: { prefix:string; implementation:string; period:string; specs:Spec[] }[] = [
  {prefix:"ensembleSummary",implementation:"ensemble.ts:summarizeEnsemble",period:"Submitted ordered years; headline and histogram use last submitted year, not necessarily 2100",specs:[
    ["baseline","Declared temperature reference period","validated literal 1850-1900","reference period","Input"],
    ["members","Unique supplied member count","memberIds.length","members","Calculated"],
    ["status","Summary is not independent model validation","literal submitted-ensemble-summary-not-independent-model-validation","label"],
    ...["trajectory[]","headline"].flatMap((path):Spec[]=>[
      [`${path}.year`,"Submitted year; headline uses last year","years[i]; headline = trajectory[trajectory.length-1]","calendar year","Input"],
      [`${path}.mean`,"Equal-member annual temperature mean","sum(temperature[i])/memberIds.length","deg C above 1850-1900","Calculated"],
      ...([["p10",0.1],["median",0.5],["p90",0.9]] as const).map(([name,p]):Spec=>[
        `${path}.${name}`,"Interpolated empirical equal-member temperature quantile",
        `sort annual temperatures ascending; j=(N-1)*${p}; x[floor(j)]+(x[ceil(j)]-x[floor(j)])*(j-floor(j))`,
        "deg C above 1850-1900","Calculated"]),
      ...([["1_5",1.5],["2",2],["3",3]] as const).map(([name,t]):Spec=>[
        `${path}.probabilityAbove${name}`,"Strict threshold exceedance fraction, not calibrated event probability",
        `count(temperature[i] > ${t})/memberIds.length`,"fraction","Calculated"]),
    ]),
    ["density[].lower","Histogram bin lower edge","min(last)+i*w; w=max(last)==min(last) ? 1 : (max(last)-min(last))/20; i=0..19","deg C above 1850-1900","Calculated"],
    ["density[].upper","Histogram bin upper edge","min(last)+(i+1)*w; same width as lower edge","deg C above 1850-1900","Calculated"],
    ["density[].count","Members allocated to bin","count(min(19,floor((value-min(last))/w)) == i)","members","Calculated"],
    ["density[].probability","Bin probability mass, NOT probability density","density[i].count/memberIds.length; no division by bin width","fraction","Calculated"],
  ]},
  {prefix:"holdoutEvaluation",implementation:"evaluation.ts:evaluateHoldout",period:"Submitted holdout origins at/after holdoutStart; target year after origin year",specs:[
    ["protocolId","Digest of parsed supplied protocol, not proof of precommitment","SHA256(JSON.stringify(parsed protocol))","SHA-256"],
    ["count","Holdout row count","rows.length; minimum 5","rows","Calculated"],
    ["bias","Mean signed candidate error","mean(candidate-actual)","submitted outcome unit","Calculated"],
    ["mae","Candidate mean absolute error","mean(abs(candidate-actual))","submitted outcome unit","Calculated"],
    ["baselineMAE","Selected baseline mean absolute error","mean(abs(row[protocol.baseline]-actual)); baseline persistence or trend","submitted outcome unit","Calculated"],
    ["coverage","Inclusive supplied interval coverage","mean(Number(actual>=lower && actual<=upper))","fraction","Calculated"],
    ["pointInTime","Declared unrevised history only, not authenticated chronology","rows.every(row => !row.revisedHistory)","boolean","Calculated"],
    ["passed","Numerical criteria met with declared unrevised inputs","pointInTime && mae<=baselineMAE*(1+maxDeteriorationFraction) && abs(coverage-nominalCoverage)<=coverageTolerance","boolean"],
    ["limitation","Independent evidence verification remains required","literal warning: supplied dates, precommitment and source independence require verification","text"],
  ]},
  {prefix:"historyValidation",implementation:"historicalValidation.ts:historicalValidation",period:"Inclusive submitted reference.startYear through reference.endYear; complete window required",specs:[
    ["median","Median of member window-mean temperatures","m[j]=sum(temperature[year][j] over inclusive reference window)/window length; sort m; middle value for odd N, average two middle values for even N","deg C above 1850-1900","Calculated"],
    ["fractionWithinReferenceRange","Share of member window means inside supplied range","count(m[j]>=reference.lower && m[j]<=reference.upper)/N","fraction","Calculated"],
    ["medianWithinReferenceRange","Median window mean lies in supplied range","median>=reference.lower && median<=reference.upper","boolean","Calculated"],
    ...(["source","kind","baseline","startYear","endYear","lower","upper"] as const).map((key):Spec=>[
      `reference.${key}`,`Supplied reference ${key}; source is not fetched or authenticated`,
      `parsed reference.${key}; kind must match simulationKind; baseline=1850-1900; lower<upper`,
      key==="lower"||key==="upper"?"deg C above 1850-1900":key.endsWith("Year")?"calendar year":key==="source"?"HTTPS URL":"label","Input"]),
    ["simulationKind","Declared total or anthropogenic simulation kind","parsed simulationKind; must equal reference.kind","label","Input"],
    ["evidenceHash","Digest of parsed submitted evidence","SHA256(JSON.stringify(parsed input))","SHA-256"],
    ["status","Range diagnostic only","literal range-diagnostic-not-independent-validation","label"],
    ["limitations[]","Attribution and independence limitations","fixed warnings: range comparison is not independent implementation check; total warming cannot certify anthropogenic attribution","text"],
  ]},
  {prefix:"vintageAudit",implementation:"vintageAudit.ts:auditVintages",period:"Submitted company decision dates and subsequent return horizons",specs:[
    ["observations","Supplied row count including duplicates","rows.length","rows","Calculated"],
    ...([
      ["missingPublication","publicationDate is null"],["futurePublication","publicationDate > decisionDate"],
      ["missingUniverse","universeKnownAt is null"],["futureUniverse","universeKnownAt > decisionDate"],
      ["missingReturns","returnValue is null"],["invalidHorizon","returnEnd <= decisionDate"],
      ["corporateActionsUnverified","!corporateActionsVerified"],["delistingsUnverified","!delistingTreatmentVerified"],
      ["duplicates","companyId:decisionDate key already encountered; each occurrence after first counts"],
    ] as const).map(([key,condition]):Spec=>[`counts.${key}`,`Rows failing ${key} check; categories can overlap`,`count(rows where ${condition})`,"rows","Calculated"]),
    ["evidenceComplete","No declared chronology or completeness failures","Object.values(counts).every(n=>n===0)","boolean","Calculated"],
    ["classification","Declared completeness classification, not certification",'evidenceComplete ? "declared-evidence-complete-awaiting-source-review" : "revised-history-not-point-in-time"',"label"],
    ["certified","No scientific or source certification granted","literal false regardless of completeness","boolean"],
    ["limitation","Chronology cannot authenticate supplied declarations","fixed source-date, survivor-coverage and corporate-action authentication warning","text"],
  ]},
  {prefix:"signalEvaluation",implementation:"signalResearch.ts:evaluateSignal",period:"Training date < splitDate; holdout date >= splitDate; training outcomeAvailableAt < splitDate",specs:[
    ["baselineMSE","Holdout baseline squared prediction loss","mean((outcome-[1,...controls] dot betaBase)^2); betaBase=(X'X+1e-8 I)^-1 X'y on training only","squared submitted outcome unit","Calculated"],
    ["candidateMSE","Holdout extended squared prediction loss","mean((outcome-[1,...controls,signal] dot coefficients)^2)","squared submitted outcome unit","Calculated"],
    ["improvement","Relative reduction in holdout mean squared error","baselineMSE>1e-12 ? (baselineMSE-candidateMSE)/baselineMSE : 0","fraction","Calculated"],
    ["coefficients[]","Training extended model coefficients, intercept then controls then signal","(X'X+1e-8 I)^-1 X'y; X=[1,...controls,signal]; ridge includes intercept; pivoted elimination","outcome unit per corresponding feature unit","Calculated"],
    ["pairedLossImprovement95[]","Two bootstrap endpoints, not independently calibrated confidence","sort 500 resampled means of paired baseline-minus-candidate squared losses; return indexes 12 and 487; LCG seed 1741, multiplier 1664525, increment 1013904223 modulo 2^32; independent rows or circular date blocks retaining all rows/date","squared submitted outcome unit","Calculated"],
    ["trainingCount","Training rows","count(date<splitDate); >=20","rows","Calculated"],
    ["holdoutCount","Holdout rows","count(date>=splitDate); >=10","rows","Calculated"],
    ["holdoutDates","Distinct holdout date count","new Set(holdout.map(row=>row.date)).size","dates","Calculated"],
    ["evidenceMode","Declared vintage mode","parsed evidenceMode; default point-in-time","label","Input"],
    ["uncertainty","Requested resampling unit","parsed uncertainty; default independent-rows; alternative date-blocks","label","Input"],
    ["blockLength","Declared circular moving-block length; unused for independent rows","parsed blockLength; integer 1..24, default 3; date-blocks requires dates>=max(6,2*blockLength)","ordered distinct dates","Input"],
    ["decision","Further-validation or exploratory decision, never production approval","positive = improvement>=minimumMseImprovement && bootstrapSorted[12]>0; revised-history: exploratory-positive-not-validated or exploratory-no-improvement; point-in-time: go-for-further-validation or no-go-for-this-specification","label"],
    ["limitations[]","Source, clustering and retrospective caveats","fixed source verification warning plus mode-dependent independent-row/date-block warning and revised-history warning when applicable","text"],
  ]},
];
export const evidenceApiBindings = families.map(f=>({
  prefix:f.prefix,
  surface:`API POST "/api/calculation/${({ensembleSummary:"ensemble-summary",holdoutEvaluation:"evaluate-holdout",historyValidation:"validate-history",vintageAudit:"audit-vintages",signalEvaluation:"evaluate-signal"} as Record<string,string>)[f.prefix]}"`,
}));
export const evidenceFieldSemantics:OutputFieldSemantic[] = [...families.flatMap(f=>f.specs.map(([field,meaning,formula,unit,role="Output"])=>({
  id:`${f.prefix}.${field}`,meaning,formula,unit,role,
  dependencies:[`submitted request to ${f.implementation}`,formula],
  source:`server/calculation/${f.implementation}; caller-supplied evidence, no independently authenticated source archive`,
  period:f.period,geography:"Caller-supplied population; no geographic representativeness verified",
  status:"Submitted-evidence numerical diagnostic; not production promotion or independent scientific acceptance",
  missingness:"Schema-invalid inputs throw and route returns 422; no synthetic substitution. Audit nullable evidence is counted as missing. Signal near-zero baseline loss explicitly yields zero improvement.",
  uncertainty:"Conditional on submitted evidence. Ensemble fractions are empirical equal-member summaries, not calibrated probabilities; holdout coverage uses supplied bounds; signal bootstrap assumptions remain unverified; audit and range checks establish no uncertainty distribution.",
  scope:"Existing gated diagnostic POST response; public write policy unchanged",
  asOfRule:"Request-time computation is not original publication time. Submitted publication, availability and freeze dates are declarations, not independently verified original vintages.",
}))), ...scientificEvidenceSemantics("ensembleSummary.scientificEvidence"),
  ...scientificEvidenceSemantics("holdoutEvaluation.scientificEvidence")];
