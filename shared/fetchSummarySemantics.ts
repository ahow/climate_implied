import { z } from "zod";
import type { OutputFieldSemantic } from "./outputFieldSemantics";

export const FETCH_SUMMARY_PRODUCER = "server/dataIngestion/orchestrator.ts";
export const FETCH_SUMMARY_KIND = "indicator-fetch-summary";
export const FETCH_SUMMARY_VERSION = "indicator-fetch-summary-1";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const fetchSummaryManifestSchema = z.object({
  producer: z.literal(FETCH_SUMMARY_PRODUCER),
  kind: z.literal(FETCH_SUMMARY_KIND),
  version: z.literal(FETCH_SUMMARY_VERSION),
  runId: z.string().min(1),
  runHash: hash,
  summaryHash: hash,
  sourceHash: hash,
  sourceFiles: z.record(hash),
  adapters: z.array(z.object({
    id: z.string().min(1), keys: z.array(z.string().min(1)),
  }).strict()),
}).strict();
export type FetchSummaryManifest = z.infer<typeof fetchSummaryManifestSchema>;
export type FetchSummaryEvidence =
  | { availability: "verified"; manifestId: string; manifest: FetchSummaryManifest; reason: null }
  | { availability: "unverified"; manifestId: null; manifest: null; reason: string };
export function unverifiedFetchSummary(reason: string): FetchSummaryEvidence {
  return { availability: "unverified", manifestId: null, manifest: null, reason };
}

type Spec = [string, string, string, string];
const specs: Spec[] = [
  ["availability", "Whether the retained run matches a provisioned immutable prospective producer manifest",
    "verified only after archive kind, chunk identity, manifest hash, source hash, run hash and summary hash verification; otherwise unverified", "label"],
  ["manifestId", "Content address of the immutable prospective manifest; null when unverified",
    "contentHash(manifest), checked against immutable archive header ID", "SHA-256 identifier or null"],
  ["reason", "Explicit reason provenance is unavailable, not a scientific diagnosis",
    "null after verified archive read; otherwise explicit missing/archive verification reason", "text or null"],
  ["manifest", "No manifest supplied for unverified historical JSON",
    "null; verified manifests expose their separately documented leaves", "null"],
  ["manifest.producer", "Producer source path declared prospectively by the write path",
    `literal ${FETCH_SUMMARY_PRODUCER}`, "source path"],
  ["manifest.kind", "Immutable archive kind for this producer's ingestion summaries",
    `literal ${FETCH_SUMMARY_KIND}`, "label"],
  ["manifest.version", "Versioned summary producer contract, not historical inference",
    `literal ${FETCH_SUMMARY_VERSION}`, "contract version"],
  ["manifest.runId", "Run identity captured with the summary in the finishing transaction",
    "indicator_fetch_runs.id; must equal the selected retained run ID", "identifier"],
  ["manifest.runHash", "Hash binding the manifest to retained run identity, execution metadata and original summary JSON",
    "contentHash({id,trigger,status,startedAt,finishedAt,proposalsCreated,adaptersSucceeded,adaptersFailed,summary}); dates normalized to ISO", "SHA-256"],
  ["manifest.summaryHash", "Hash of the original JSON value, never a replacement for that JSON",
    "contentHash(run.summary) using canonical key order; original JSON value remains in runs[].summary", "SHA-256"],
  ["manifest.sourceHash", "Version identity of allowlisted producer source-file digests",
    "contentHash(manifest.sourceFiles); actual source bytes hashed by SHA-256 at prospective capture", "SHA-256"],
  ["manifest.sourceFiles", "Allowlisted source paths and actual byte digests, not private source exports",
    "exact producer-source allowlist; each value is SHA-256(file bytes); no source content, credentials, uploads or private fixtures", "path to SHA-256 map"],
  ["manifest.adapters[].id", "Ordered adapter identity declaration captured from the executing registry",
    "ADAPTERS.map(adapter => adapter.id); summary entries must be an ordered prefix", "identifier"],
  ["manifest.adapters[].keys[]", "Indicator keys the captured adapter declares it may fetch, not keys actually fetched",
    "ADAPTERS[].keys; declarations checked against INDICATORS keys at capture", "indicator key"],
  ["manifest.adapters[].keys", "Empty declared adapter-key list, if a future producer has one",
    "[]; not evidence of fetched values", "empty collection"],
];
const context = {
  role: "Output" as const,
  source: "server/dataIngestion/summaryContract.ts; summaryArchive.ts; dataStore.ts; orchestrator.ts",
  dependencies: ["indicator_fetch_runs", "cv_analysis_snapshots", "cv_analysis_chunks", "ADAPTERS", "INDICATORS"],
  period: "Prospective collection execution only; not source publication vintage",
  geography: "Operational global indicator acquisition; publisher coverage is separate",
  status: "Producer provenance only; neither source verification, approval nor scientific acceptance",
  missingness: "Historical untagged runs remain unverified. Missing, unprovisioned or corrupt archives never earn leaf binding. Original raw JSON stays unchanged.",
  uncertainty: "No calibrated uncertainty; a content hash authenticates identity, not truth",
  scope: "Sidecar metadata only; no new original public-slot completion credit",
  asOfRule: "Captured during the finishing transaction of future runs only; never backfilled from today's source",
};
export const fetchSummarySemantics: OutputFieldSemantic[] = specs.map(([field, meaning, formula, unit]) => ({
  id: `fetchSummaryEvidence.${field}`, meaning, formula, unit, ...context,
}));
fetchSummarySemantics.push({
  id:"fetchSummaryDisplay.claim",meaning:"Visible distinction between schema compatibility and verified prospective producer provenance",
  formula:"strict summary parse plus verified immutable sidecar -> verified producer; compatible raw JSON alone -> unverified; unknown raw JSON -> unavailable",
  unit:"disclosure text",...context,
});
