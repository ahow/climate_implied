import { z } from "zod";
import type { OutputFieldSemantic } from "./outputFieldSemantics";
const hash = z.string().regex(/^[a-f0-9]{64}$/), time = z.string().datetime();
export const trackBAdmissionSchema = z.object({
  contract: z.literal("track-b-period-admission-1"), protocolHash: hash, corpusHash: hash,
  corpusCutoff: time,
  periods: z.array(z.object({
    specification: z.string().min(1), origin: time, informationCutoff: time,
    executionAt: time.nullable(), endAt: time.nullable(), manifestHash: hash.nullable(),
    stage9ContractSatisfied: z.boolean(), originalFilingsContractSatisfied: z.boolean(),
    status: z.literal("unavailable"), result: z.null(),
    reasons: z.array(z.object({
      gate: z.enum(["period", "stage9", "original-filings", "authenticity"]),
      code: z.string().min(1), companyId: z.string().nullable(), artifactHash: hash.nullable(), detail: z.string().min(1),
    }).strict()).min(1),
  }).strict()).min(1),
  scientificAcceptance: z.literal(false), investmentEvidence: z.literal(false), authenticityVerified: z.literal(false),
  limitation: z.string().min(1),
}).strict();
export type TrackBAdmissionReport = z.infer<typeof trackBAdmissionSchema>;
export const trackBAdmissionFieldSpecs: [string, string, string, string][] = [
  ["contract", "Per-period evidence assessment contract", "track-b-period-admission-1", "version identifier"],
  ["protocolHash", "Exact supplied frozen protocol identity", "SHA256(canonicalJson(protocolInput)); mismatch refuses", "SHA256"],
  ["corpusHash", "Exact strictly parsed retained corpus identity", "SHA256(canonicalJson(parsedCorpus)); not authenticity", "SHA256"],
  ["corpusCutoff", "Actual retained corpus cutoff", "corpus.dataEnd; never current time", "UTC timestamp"],
  ["periods[].specification", "Frozen model/peer/target identity", "JSON.stringify([model,peer,target])", "identifier"],
  ["periods[].origin", "Frozen evaluation origin", "Every frozen specification x expectedOrigin, including absent periods", "UTC timestamp"],
  ["periods[].informationCutoff", "Exact origin information cutoff", "Identity origin; original receipt/publication/lag checks compare to this time", "UTC timestamp"],
  ["periods[].executionAt", "Actual supplied execution time", "period.executionAt or null for absent/duplicate period", "UTC timestamp or null"],
  ["periods[].endAt", "Actual supplied holding-window end", "period.endAt or null; no manufactured date", "UTC timestamp or null"],
  ["periods[].manifestHash", "Referenced per-period manifest", "period.trackBManifestHash or null; unresolved/hash-mismatched reference fails", "SHA256 or null"],
  ["periods[].stage9ContractSatisfied", "Structural Stage9 conjunction only, not independent verification", "No period or Stage9 failure reasons; authentication reasons still withhold Track B", "boolean"],
  ["periods[].originalFilingsContractSatisfied", "Structural original-filing conjunction only", "No period or original-filings failures; authentication reasons still withhold Track B", "boolean"],
  ["periods[].status", "Actual Track B presentation state", "unavailable: no authenticated independent review is provisioned", "status"],
  ["periods[].result", "Withheld Track B numeric result", "literal null; no zero, TrackA, revised-history or fixture substitution", "unavailable result"],
  ["periods[].reasons[].gate", "Failed conjunct or independent review gate", "period | stage9 | original-filings | authenticity", "gate identifier"],
  ["periods[].reasons[].code", "Machine-readable exact period failure", "One code per detected failing requirement; not a mode-only disclaimer", "reason identifier"],
  ["periods[].reasons[].companyId", "Company to which this failure applies", "Actual retained companyId, or null for period-wide reasons", "identifier or null"],
  ["periods[].reasons[].artifactHash", "Actual failed referenced receipt", "Supplied hash or null when no reference exists; no raw payload or originUri export", "SHA256 or null"],
  ["periods[].reasons[].detail", "Precise unavailable explanation", "Public gate-specific reason; no private source bytes", "explanatory text"],
  ["scientificAcceptance", "No scientific acceptance", "literal false", "boolean"],
  ["investmentEvidence", "No investment efficacy", "literal false", "boolean"],
  ["authenticityVerified", "No authenticated independent Stage9/original-source review authority", "literal false; publication authorization,self-hashes and caller classifications are insufficient", "boolean"],
  ["limitation", "Scope of per-period contract checks", "Synthetic/contract-passing sources do not establish historical efficacy", "explanatory text"],
];
export const trackBAdmissionSemantics: OutputFieldSemantic[] = trackBAdmissionFieldSpecs.map(([path, meaning, formula, unit]) => ({
  id: `trackBAdmission.${path}`, meaning, formula, unit, role: "Output",
  dependencies: ["frozen protocol", "retained corpus and period/Stage9/original-filing manifests"],
  source: "server/calculation/trackBAdmission.ts; strict canonical hashes, actual retained timestamps and frozen filing lag",
  period: "Each frozen origin/execution/end; availability at origin and retained corpus cutoff separately",
  geography: "Frozen specification/corpus population; no invented historical issuer coverage",
  status: "Unavailable per period until independent Stage9 AND original-filing evidence review exists",
  missingness: "Absent periods/companies/manifests/filings keep named reasons and null result; never zero or survivor-only evidence",
  uncertainty: "No historical forecast/return distribution or efficacy estimate is supplied by an admission contract",
  scope: "Contract checks only; no physical, financial, scientific or investment promotion",
  asOfRule: "Exact frozen origin; original captures/availability/publication plus precommitted lag must satisfy cutoff; no current substitution",
}));
export const trackBAdmissionHttpSemantics: OutputFieldSemantic[] = [{
  ...trackBAdmissionSemantics[trackBAdmissionSemantics.length - 1], id: "trackBAdmissionHttp.error",
  meaning: "GET admission/export read refusal, not a Track B evidence result",
  formula: "HTTP400 invalid selection;403 unauthorized/unpublished;404 unlisted/missing;409 changed exact report/disclosure;503 unprovisioned/corrupt/identity failure; explicit refusal only",
  unit: "refusal text", dependencies: ["query.protocolHash", "strict public report resolver/contract"],
  missingness: "No retained assessment is404, never fabricated empty history, zero result or an alternative protocol",
  source: "server/trackBAdmissionApi.ts; server/trackBDisclosureStore.ts: exact selection,source-catalog authorization and retained-file validation",
  period: "Request-time publication/selection control; report information cutoffs never rewritten",
  geography: "Control metadata only; missing report does not establish population coverage",
  status: "Explicit read refusal; no disclosure authorization or scientific acceptance granted",
  uncertainty: "No numerical evidence or efficacy estimate in an HTTP refusal",
  scope: "Read-only catalog/report/JSON/XLSX; no caller review,public mutation,private provider bytes or filesystem paths",
  asOfRule: "Exact selected protocol/report/disclosure pins and retained source dates; no latest/current replacement",
}];
export function bindTrackBAdmission(input: unknown) {
  const report = trackBAdmissionSchema.parse(input);
  const ids = new Set<string>();
  const visit = (value: unknown, path: string) => {
    if (Array.isArray(value)) value.forEach(v => visit(v, `${path}[]`));
    else if (value !== null && typeof value === "object")
      Object.entries(value).forEach(([key, v]) => visit(v, path ? `${path}.${key}` : key));
    else {
      const id = `trackBAdmission.${path}`;
      if (!trackBAdmissionSemantics.some(s => s.id === id)) throw new Error(`Unmapped Track B field ${id}`);
      ids.add(id);
    }
  };
  visit(report, "");
  return { report, ids: Array.from(ids).sort() };
}
export const trackBAdmissionExportBindings = {
  "Protocol SHA256": "protocolHash", "Corpus SHA256": "corpusHash", "Corpus cutoff": "corpusCutoff",
  Specification: "periods[].specification", Origin: "periods[].origin", "Information cutoff": "periods[].informationCutoff",
  Execution: "periods[].executionAt", End: "periods[].endAt", "Period manifest": "periods[].manifestHash",
  "Stage9 contract satisfied (not authenticated)": "periods[].stage9ContractSatisfied",
  "Original filings contract satisfied (not authenticated)": "periods[].originalFilingsContractSatisfied",
  "Track B status": "periods[].status", "Track B result": "periods[].result",
  "Failed gate": "periods[].reasons[].gate", "Reason code": "periods[].reasons[].code",
  Company: "periods[].reasons[].companyId", "Referenced artifact": "periods[].reasons[].artifactHash", Reason: "periods[].reasons[].detail",
} as const;
export function trackBAdmissionExportDocument(input: unknown) {
  const { report, ids } = bindTrackBAdmission(input);
  const rows = report.periods.flatMap(period => period.reasons.map(reason => ({
    "Protocol SHA256": report.protocolHash, "Corpus SHA256": report.corpusHash, "Corpus cutoff": report.corpusCutoff,
    Specification: period.specification, Origin: period.origin, "Information cutoff": period.informationCutoff,
    Execution: period.executionAt, End: period.endAt, "Period manifest": period.manifestHash,
    "Stage9 contract satisfied (not authenticated)": period.stage9ContractSatisfied,
    "Original filings contract satisfied (not authenticated)": period.originalFilingsContractSatisfied,
    "Track B status": period.status, "Track B result": period.result, "Failed gate": reason.gate,
    "Reason code": reason.code, Company: reason.companyId, "Referenced artifact": reason.artifactHash, Reason: reason.detail,
  })));
  return { report, rows, fieldSemantics: trackBAdmissionSemantics,
    fieldIds: ids, columnBindings: Object.fromEntries(Object.entries(trackBAdmissionExportBindings).map(([column, path]) =>
      [column, { id: `trackBAdmission.${path}`, transform: "Identity; one row per exact period failure, nulls preserved" }])) };
}
/** Exact JSON serialization domain: report/row cardinalities are schema paths,
 * dictionary/ID/binding metadata is a finite constant domain, not fake reports. */
export function trackBAdmissionExportLeafBindings() {
  const bindings: Record<string, { id: string; transform: string }> = {};
  for (const [path] of trackBAdmissionFieldSpecs)
    bindings[`report.${path}`] = { id: `trackBAdmission.${path}`, transform: "Identity; strict report, explicit null retained" };
  for (const [column, path] of Object.entries(trackBAdmissionExportBindings))
    bindings[`rows[].${column}`] = { id: `trackBAdmission.${path}`, transform: "Identity; one row per exact period failure, nulls preserved" };
  const metadata = (value: unknown, path: string, id: string) => {
    if (value !== null && typeof value === "object") Object.entries(value).forEach(([key, v]) => metadata(v, `${path}.${key}`, id));
    else bindings[path] = { id, transform: "Exact definition/identity/binding metadata serialization; not an additional measured value" };
  };
  trackBAdmissionSemantics.forEach((semantic, i) => metadata(semantic, `fieldSemantics.${i}`, semantic.id));
  trackBAdmissionSemantics.map(s => s.id).sort().forEach((id, i) => metadata(id, `fieldIds.${i}`, id));
  for (const [column, path] of Object.entries(trackBAdmissionExportBindings))
    metadata({ id: `trackBAdmission.${path}`, transform: "Identity; one row per exact period failure, nulls preserved" },
      `columnBindings.${column}`, `trackBAdmission.${path}`);
  return bindings;
}
