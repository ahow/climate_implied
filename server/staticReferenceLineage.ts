import type { Response } from "express";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { contentHash } from "./calculation/analysisManifest";
import { readCalculationSourceArtifact } from "./snapshots/materialInputs";
import { WARMING_VALIDATION_REFERENCE } from "../shared/warmingValidationReference";
import { warmingReferenceExportDocument } from "../shared/warmingValidationReferenceSemantics";
import { getCarbonPassThroughReview } from "./calculation/carbonPassThroughAdmission";

export const staticReferenceContracts = {
  "warming-validation": {
    route: "/api/reference/warming-validation/export.json",
    claim: "Dated human-induced GMST validation reference only; not an offset, calculation input, model run or scientific model acceptance",
    files: ["shared/warmingValidationReference.ts", "shared/warmingValidationReferenceSemantics.ts",
      "server/warmingValidationReferenceApi.ts"],
  },
  "carbon-pass-through-evidence": {
    route: "/api/cv/carbon-pass-through-evidence/export.json",
    claim: "Public historical product-price evidence and bibliographic context only; not an issuer assumption, issuer study, observed issuer cash or source/model approval",
    files: ["shared/carbonPassThroughEvidence.ts", "shared/carbonPassThroughSemantics.ts",
      "server/calculation/carbonPassThroughAdmission.ts", "server/carbonPassThroughApi.ts"],
  },
} as const;
export type StaticReferenceKey = keyof typeof staticReferenceContracts;
const commonFiles = ["server/staticReferenceLineage.ts", "server/downloadManifestMiddleware.ts",
  "server/snapshots/materialInputs.ts", "server/calculation/analysisManifest.ts",
  "shared/downloadManifest.ts", "shared/serverDownloadRegistry.ts", "shared/outputFieldSemantics.ts",
  "package.json", "package-lock.json", "tsconfig.json"];
const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
// Release-local public source bytes captured alongside the imported reference
// modules. Later on-disk edits may not acquire the running module's identity.
const releaseFiles = Object.fromEntries(Array.from(new Set([
  ...commonFiles, ...Object.values(staticReferenceContracts).flatMap(contract => [...contract.files]),
])).map(path => [path, readFileSync(path, "utf8")]));
export interface StaticReferenceArchiveReader {
  source(): ReturnType<typeof readCalculationSourceArtifact> | Promise<ReturnType<typeof readCalculationSourceArtifact>>;
  file(path: string): string;
}
const publicArchive: StaticReferenceArchiveReader = {
  source: readCalculationSourceArtifact, file: path => readFileSync(path, "utf8"),
};
const bindings = new WeakMap<Response, Awaited<ReturnType<typeof staticReferenceIdentity>>>();
export function staticReferenceDocument(key: StaticReferenceKey) {
  if (key === "warming-validation") return warmingReferenceExportDocument();
  if (key === "carbon-pass-through-evidence") return getCarbonPassThroughReview();
  throw new Error("Unknown static reference contract");
}

/** Read-only identity, not a retained executed-result proof. The existing
 * calculation-source-1 representation is checked in memory against the exact
 * release-local public files. No DB writes/readers, private inputs, provider
 * calls, study execution, source approval or publication operation occurs.
 */
export async function staticReferenceIdentity(key: StaticReferenceKey, document: unknown,
  archive: StaticReferenceArchiveReader = publicArchive) {
  if (!Object.hasOwn(staticReferenceContracts, key)) throw new Error("Unknown static reference contract");
  const contract = staticReferenceContracts[key], expected = staticReferenceDocument(key);
  if (contentHash(document) !== contentHash(expected)) throw new Error("Static reference document changed or stale");
  const source = await archive.source();
  const payload = source?.payload as { version?: string; files?: Record<string, string> } | undefined;
  if (!source || !/^[a-f0-9]{64}$/.test(source.id) ||
    contentHash(payload) !== source.id || payload?.version !== "calculation-source-1" ||
    !payload.files || typeof payload.files !== "object")
    throw new Error("Missing or corrupt static code source artifact");
  const files = [...commonFiles, ...contract.files].map(path => {
    const retained = payload.files![path], current = archive.file(path);
    if (typeof retained !== "string" || retained !== releaseFiles[path] || current !== releaseFiles[path])
      throw new Error(`Static reference code/source file missing, corrupt or stale: ${path}`);
    return { path, sha256: sha(retained) };
  });
  const reference = key === "warming-validation" ? WARMING_VALIDATION_REFERENCE :
    (() => {
      const review = getCarbonPassThroughReview();
      return { contract: review.contract, sources: review.sources, evidence: review.evidence,
        registerHash: review.registerHash, status: review.status };
    })();
  const sourceDeclarations = key === "warming-validation" ? [
    { id: "IGCC-2025a-headlines", sha256: WARMING_VALIDATION_REFERENCE.source.sha256,
      url: WARMING_VALIDATION_REFERENCE.source.url },
    { id: "IGCC-2025a-temporal-definition", sha256: WARMING_VALIDATION_REFERENCE.source.temporalDefinitionSha256,
      url: WARMING_VALIDATION_REFERENCE.source.temporalDefinitionUrl },
  ] : getCarbonPassThroughReview().sources.map(source => ({ id: source.id, sha256: source.sha256, url: source.url }));
  const artifact = {
    version: "static-reference-artifact-1", key, route: contract.route, claim: contract.claim,
    referenceArtifact: {
      id: contentHash(reference),
      contract: key === "warming-validation" ? WARMING_VALIDATION_REFERENCE.version : getCarbonPassThroughReview().contract,
      retention: "Exact public reference/evidence embedded in checked-in source modules; not an executed-result archive",
    },
    codeArtifact: { id: source.id, contract: "calculation-source-1", files,
      retention: "Existing read-only release-local source/config/lock archive representation; no database persistence or executable attestation claimed" },
    dataIdentity: { algorithm: "SHA-256", hash: contentHash(document),
      method: "Canonical finite JSON, sorted object keys and preserved array order; exact original static export document" },
    sourceDeclarations,
    sourceBoundary: "Previously reviewed external-source hashes declared in public reference modules; no re-download, new source authentication, private bytes or raw paper redistribution",
    model: { applicability: "not-applicable-static-reference", version: null, runId: null },
    materialInputs: { applicability: "not-applicable-no-calculation", id: null },
    orderedInputSnapshotHashes: [],
    scientificAcceptance: false, sourceApproval: false, originalHistoricalExport: false,
  } as const;
  return { ...artifact, id: contentHash(artifact) };
}
export async function bindStaticReference(res: Response, key: StaticReferenceKey, document: unknown,
  archive: StaticReferenceArchiveReader = publicArchive) {
  const identity = await staticReferenceIdentity(key, document, archive);
  bindings.set(res, identity);
  return identity;
}
/** Only the actual response object bound by the closed writer can expose this
 * lineage. A query, UI selection or arbitrary manifest object cannot set it. */
export function responseStaticReference(res: Response, document: unknown) {
  const identity = bindings.get(res);
  if (!identity) return null;
  if (contentHash(document) !== identity.dataIdentity.hash)
    throw new Error("Static attachment conflicts with bound public reference document");
  return structuredClone(identity);
}
/** Readback is checked against the trusted closed reference and source archive,
 * not merely against a self-reported hash inside the downloaded manifest. */
export async function verifyStaticReferenceIdentity(identity: unknown, document: unknown,
  archive: StaticReferenceArchiveReader = publicArchive) {
  const key = (identity as { key?: StaticReferenceKey } | null)?.key;
  if (!key || !Object.hasOwn(staticReferenceContracts, key)) throw new Error("Unknown static reference identity");
  const expected = await staticReferenceIdentity(key, document, archive);
  if (contentHash(identity) !== contentHash(expected)) throw new Error("Static reference artifact identity conflicts");
  return expected;
}
