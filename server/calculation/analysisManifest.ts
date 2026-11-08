import { createHash } from "node:crypto";
import { z } from "zod";

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (typeof value === "object" && value && Object.getPrototypeOf(value) === Object.prototype)
    return "{" + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ":" + canonicalJson((value as Record<string, unknown>)[key])).join(",") + "}";
  throw new Error("Canonical inputs must contain only explicit finite JSON values");
}
export function contentHash(value: unknown) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
const manifestSchema = z.object({
  codeVersion: z.string().min(1), modelVersion: z.string().min(1),
  snapshotHashes: z.array(z.string().regex(/^[a-f0-9]{64}$/)).min(1),
  scenario: z.string().min(1), settings: z.record(z.unknown()),
}).strict();
export function createManifest(input: z.input<typeof manifestSchema>, createdAt = new Date().toISOString()) {
  const analytical = manifestSchema.parse(input);
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("Invalid creation timestamp");
  // Overlay ordering is meaningful: never sort snapshotHashes.
  const id = contentHash({ contract: "analysis-manifest-1", ...analytical });
  return { id, contract: "analysis-manifest-1", ...analytical, createdAt };
}
