import { z } from "zod";
import { contentHash, createManifest } from "../calculation/analysisManifest";
type Manifest = ReturnType<typeof createManifest>;
const schema = z.object({
  version: z.literal("analysis-result-1"),
  manifest: z.object({
    id: z.string(), contract: z.literal("analysis-manifest-1"),
    codeVersion: z.string(), modelVersion: z.string(),
    snapshotHashes: z.array(z.string()), scenario: z.string(),
    settings: z.record(z.unknown()),
  }).strict(),
  result: z.unknown(),
}).strict();
export function packAnalysisResult(manifest: Manifest, result: unknown) {
  const { id, contract, createdAt, ...analytical } = manifest;
  if (contract !== "analysis-manifest-1" || createManifest(analytical, createdAt).id !== id)
    throw new Error("Invalid analysis manifest identity");
  const payload = schema.parse({
    version: "analysis-result-1", manifest: { id, contract, ...analytical }, result,
  });
  // Fails on undefined, NaN, Infinity and non-JSON objects.
  return { id: contentHash(payload), payload };
}
export function unpackAnalysisResult(id: string, input: unknown) {
  const payload = schema.parse(input);
  const packed = packAnalysisResult({ ...payload.manifest, createdAt: "1970-01-01T00:00:00.000Z" }, payload.result);
  if (packed.id !== id) throw new Error("Analysis result content hash mismatch");
  return packed.payload;
}
