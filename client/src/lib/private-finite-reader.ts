import { z } from "zod";
import { economicBridgeCells, type EconomicBridgeCell } from "@shared/economicBridgeSchema";

/** Mirrors server/calculation/analysisManifest.ts, without importing server code. */
export function canonicalFiniteJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalFiniteJson).join(",") + "]";
  if (typeof value === "object" && value && Object.getPrototypeOf(value) === Object.prototype)
    return "{" + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ":" + canonicalFiniteJson((value as Record<string, unknown>)[key])).join(",") + "}";
  throw new Error("Canonical inputs must contain only explicit finite JSON values");
}

const text = z.string().min(1);
const present = z.custom<unknown>(value => value !== undefined);
const schema = z.object({
  version: z.literal("private-finite-company-document-1"),
  id: z.string().regex(/^[a-f0-9]{64}$/),
  decisionId: text,
  retrievalMode: z.enum(["stored", "recalculate"]),
  executionVerifiedNow: z.boolean(),
  financialReviewId: text,
  cutoff: text,
  producer: z.record(z.unknown()),
  sourceIds: present,
  variables: z.object({
    Input: z.object({ value: present, editable: text }).passthrough(),
    Calculated: z.object({
      value: present, editable: z.literal(false), units: text, equations: z.array(text),
    }).passthrough(),
    Output: z.object({
      value: z.object({ covered: present, modelVersions: present }).passthrough(),
      editable: z.literal(false), claim: text,
    }).passthrough(),
  }).passthrough(),
  scientificAcceptance: z.literal(false),
  publicDisclosureAuthorized: z.literal(false),
}).passthrough();

export type PrivateFiniteDocument = z.infer<typeof schema>;
export interface VerifiedPrivateFinite {
  document: PrivateFiniteDocument;
  recalculatedId: string;
  cells: EconomicBridgeCell[];
}

/** Local integrity only: neither the producer nor its review is authenticated. */
export async function readPrivateFiniteDocument(raw: string): Promise<VerifiedPrivateFinite> {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error("Invalid JSON. Choose a complete owner-export JSON document."); }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error("Unsupported or incomplete private-finite-company-document-1 document.");
  // Keep exact parsed bytes' values, including additive fields; never hash a stripped schema result.
  const document = value as PrivateFiniteDocument;
  if (document.executionVerifiedNow !== (document.retrievalMode === "recalculate"))
    throw new Error("Retrieval mode and executionVerifiedNow are inconsistent.");
  const { id, ...body } = document;
  const canonical = canonicalFiniteJson(body);
  if (!globalThis.crypto?.subtle)
    throw new Error("Browser WebCrypto is unavailable. Open this viewer in a secure browser context.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const recalculatedId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (id !== recalculatedId) throw new Error("Document SHA-256 mismatch. No calculation evidence is displayed.");
  return { document, recalculatedId, cells: economicBridgeCells(document) };
}

/** Monotonic tickets protect even A/B/A selections and resets during hashing. */
export function createPrivateFiniteLoadGuard() {
  let generation = 0;
  return {
    next: () => ++generation,
    isCurrent: (ticket: number) => ticket === generation,
  };
}
