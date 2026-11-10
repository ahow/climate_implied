import { describePersistedSummary } from "../../shared/dataManagementSemantics";
import { bindNestedOutput } from "../../shared/outputFieldSemantics";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { contentHash } from "../calculation/analysisManifest";
import { persistedSummarySchema } from "../../shared/dataManagementSemantics";
import {
  FETCH_SUMMARY_KIND, FETCH_SUMMARY_PRODUCER, FETCH_SUMMARY_VERSION,
  fetchSummaryManifestSchema, type FetchSummaryEvidence,
} from "../../shared/fetchSummarySemantics";
export { describePersistedSummary,FETCH_SUMMARY_CONTRACT } from "../../shared/dataManagementSemantics";

/** Metadata only: strict producer-schema claims are bound separately.
 * Unknown historical JSON is neither traversed as known claims nor replaced,
 * stringified, hashed, dropped, or rewritten. The API returns the original runs.
 */
export function bindKnownPersistedSummary(value:unknown, evidence?:FetchSummaryEvidence) {
  const interpretation=describePersistedSummary(value,evidence);
  if(evidence?.availability==="verified" && (
    contentHash(evidence.manifest)!==evidence.manifestId ||
    contentHash(value)!==evidence.manifest.summaryHash))
    throw new Error("Summary leaf binding does not match the verified manifest");
  return interpretation.availability==="available" && interpretation.provenance==="verified"
    ? bindNestedOutput("fetchSummaryProducer",interpretation.claims) : [];
}

/** Sidecar metadata uses a run-ID map on the wire; IDs and source paths are
 * identifiers, not dynamically invented semantic fields. Bind their declared
 * finite structure explicitly instead of traversing arbitrary raw summaries.
 */
export function bindFetchSummaryEvidence(evidence:FetchSummaryEvidence) {
  const {manifest,...state}=evidence;
  const fields=bindNestedOutput("fetchSummaryEvidence",state);
  if(manifest===null) return [...fields,...bindNestedOutput("fetchSummaryEvidence",{manifest:null})];
  const {sourceFiles,...metadata}=manifest;
  return [
    ...fields,...bindNestedOutput("fetchSummaryEvidence",{manifest:metadata}),
    ...bindNestedOutput("fetchSummaryEvidence",{manifest:{sourceFiles:null}}),
  ];
}

/** Only code/config dependencies of this producer. Digest bytes, never export files. */
export const FETCH_SUMMARY_SOURCE_FILES = [
  "server/dataIngestion/orchestrator.ts", "server/dataIngestion/dataStore.ts",
  "server/dataIngestion/summaryContract.ts", "server/dataIngestion/summaryArchive.ts",
  "server/dataIngestion/indicatorRegistry.ts", "server/dataIngestion/collectionLock.ts",
  "server/dataIngestion/adapters/index.ts", "server/dataIngestion/adapters/types.ts",
  "server/dataIngestion/adapters/noaa.ts", "server/dataIngestion/adapters/owid.ts",
  "server/dataIngestion/adapters/worldBank.ts", "server/dataIngestion/adapters/perplexity.ts",
  "server/dataIngestion/adapters/derived.ts", "server/calculation/historicalIndicators.ts",
  "server/calculation/analysisManifest.ts", "shared/dataManagementSemantics.ts",
  "shared/fetchSummarySemantics.ts", "shared/indicatorFieldSemantics.ts",
  "package.json", "package-lock.json",
] as const;
export interface SummaryRun {
  id:string; trigger:string; status:string; startedAt:Date|string; finishedAt:Date|string|null;
  proposalsCreated:number; adaptersSucceeded:number; adaptersFailed:number; summary:unknown;
}
export interface SummaryProducer {
  adapters:{id:string; keys:readonly string[]}[];
  indicatorKeys:readonly string[];
}
function hashableRun(run:SummaryRun) {
  return {
    id:run.id,trigger:run.trigger,status:run.status,
    startedAt:new Date(run.startedAt).toISOString(),
    finishedAt:run.finishedAt===null ? null : new Date(run.finishedAt).toISOString(),
    proposalsCreated:run.proposalsCreated,adaptersSucceeded:run.adaptersSucceeded,
    adaptersFailed:run.adaptersFailed,summary:run.summary,
  };
}
export function readFetchSummarySourceHashes() {
  return Object.fromEntries(FETCH_SUMMARY_SOURCE_FILES.map(path=>[
    path,createHash("sha256").update(readFileSync(path)).digest("hex"),
  ]));
}
function validateProducerSummary(run:SummaryRun, adapters:SummaryProducer["adapters"]) {
  const summary=persistedSummarySchema.parse(run.summary);
  if(!["completed","failed"].includes(run.status) || run.finishedAt===null)
    throw new Error("Producer manifest requires a finished ingestion run");
  if(new Set(adapters.map(a=>a.id)).size!==adapters.length || adapters.length===0)
    throw new Error("Producer adapter identities must be nonempty and unique");
  if(summary.perAdapter.length>adapters.length ||
    summary.perAdapter.some((row,index)=>row.id!==adapters[index].id))
    throw new Error("Summary adapter order does not match captured producer registry");
  if(run.status==="completed" && summary.perAdapter.length!==adapters.length)
    throw new Error("Completed summary must contain every attempted adapter");
  if(summary.perAdapter.some(row=>row.error!==undefined && row.values!==0))
    throw new Error("Failed adapter cannot report fetched values");
  const failures=summary.perAdapter.filter(row=>row.error!==undefined).length;
  if(run.adaptersFailed!==failures || run.adaptersSucceeded!==summary.perAdapter.length-failures)
    throw new Error("Run adapter counters do not match summary");
  // Pending insert counts may differ from fetched row counts; never infer one from the other.
}
export function packFetchSummaryManifest(run:SummaryRun,producer:SummaryProducer,
  sourceFiles:Record<string,string>=readFetchSummarySourceHashes()) {
  validateProducerSummary(run,producer.adapters);
  if(producer.adapters.some(a=>a.keys.some(key=>!producer.indicatorKeys.includes(key))))
    throw new Error("Adapter declares an unregistered indicator key");
  if(JSON.stringify(Object.keys(sourceFiles).sort())!==JSON.stringify([...FETCH_SUMMARY_SOURCE_FILES].sort()))
    throw new Error("Incomplete producer source allowlist");
  const manifest=fetchSummaryManifestSchema.parse({
    producer:FETCH_SUMMARY_PRODUCER,kind:FETCH_SUMMARY_KIND,version:FETCH_SUMMARY_VERSION,
    runId:run.id,runHash:contentHash(hashableRun(run)),summaryHash:contentHash(run.summary),
    sourceHash:contentHash(sourceFiles),sourceFiles,
    adapters:producer.adapters.map(a=>({id:a.id,keys:[...a.keys]})),
  });
  return {id:contentHash(manifest),manifest};
}
export function verifyFetchSummaryManifest(run:SummaryRun,id:string,input:unknown):FetchSummaryEvidence {
  const manifest=fetchSummaryManifestSchema.parse(input);
  if(contentHash(manifest)!==id || manifest.runId!==run.id ||
    manifest.runHash!==contentHash(hashableRun(run)) || manifest.summaryHash!==contentHash(run.summary) ||
    manifest.sourceHash!==contentHash(manifest.sourceFiles))
    throw new Error("Producer manifest identity, run, summary or source hash mismatch");
  if(JSON.stringify(Object.keys(manifest.sourceFiles).sort())!==JSON.stringify([...FETCH_SUMMARY_SOURCE_FILES].sort()))
    throw new Error("Producer manifest source allowlist mismatch");
  validateProducerSummary(run,manifest.adapters);
  return {availability:"verified",manifestId:id,manifest,reason:null};
}
