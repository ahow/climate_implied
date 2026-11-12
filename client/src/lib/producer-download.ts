/** This registry only consumes same-origin server response headers. There is no
 * setter taking an arbitrary UI payload/manifest or global 'current' proof. */
import type { RetainedProducerIdentity } from "../../../shared/downloadManifest";
import { consumerCanonicalJson, deriveValuationPE, type ValuationPEDerivation } from "../../../shared/derivedConsumer";
import { exportDataIdentity } from "./export-identity";

const retainedResults = new WeakMap<object, { proof: RetainedProducerIdentity; source: string }>();
const derivedResults = new WeakMap<object, {
  parent: object; key: ValuationPEDerivation; output: string;
}>();
const capturedConsumers = new WeakMap<object, string>();
async function canonicalHash(value: unknown) {
  const bytes = new TextEncoder().encode(consumerCanonicalJson(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map(x => x.toString(16).padStart(2, "0")).join("");
}
export function retainProducerDownload(response: Response) {
  const encoded = response.headers.get("X-Producer-Identity");
  if (!response.ok || !encoded) return response;
  if (response.url && typeof window !== "undefined" && window.location &&
      new URL(response.url).origin !== window.location.origin)
    throw new Error("Cross-origin producer identity refused");
  let proof: any;
  try {
    proof = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { throw new Error("Invalid server producer identity; result withheld"); }
  if (proof.version !== "retained-producer-binding-v1" ||
      !["resultId", "resultHash", "manifestId", "materialInputsId", "codeArchiveId"]
        .every(key => typeof proof[key] === "string" && /^[a-f0-9]{64}$/.test(proof[key])) ||
      !Array.isArray(proof.orderedSnapshotHashes) || !proof.orderedSnapshotHashes.length ||
      !proof.orderedSnapshotHashes.every((id: unknown) => typeof id === "string" && /^[a-f0-9]{64}$/.test(id)) ||
      typeof proof.modelVersion !== "string" || !proof.modelVersion ||
      !["summary", "carbon-price", "pe-comparison", "sdg-growth", "decarb-bands",
        "decarb-terciles", "decarb-gap/summary", "decarb-gap/timeseries", "backtest"]
        .some(path => proof.scenario === `descriptive-valuation:/${path}`) ||
      proof.scientificAcceptance !== false)
    throw new Error("Invalid server retained-result identity; result withheld");
  const json = response.json.bind(response);
  response.json = async () => {
    const payload = await json();
    // Stored replay wraps the retained result; native producers/exact JSON do not.
    const native = response.url && /\/api\/analysis\/results\/[a-f0-9]{64}$/.test(new URL(response.url).pathname)
      ? payload.result : payload;
    if (await canonicalHash(native) !== proof.resultHash)
      throw new Error("Server producer result hash conflicts with consumed response");
    if (payload && typeof payload === "object")
      retainedResults.set(payload, { proof: structuredClone(proof), source: consumerCanonicalJson(native) });
    return payload;
  };
  return response;
}
export function exactProducerDownload(payload: unknown) {
  const id = payload && typeof payload === "object" ? retainedResults.get(payload)?.proof.resultId : undefined;
  return id ? `/api/analysis/results/${id}/export.json?downloadMetadata=manifest-v1` : null;
}

/** Only a closed derivation on the actual consumed response can acquire
 * lineage. No setter accepts a proof, source hash, UI selection or mapped rows. */
export function deriveProducerValuationPE(parent: unknown, key: ValuationPEDerivation) {
  const result = deriveValuationPE(parent, key);
  const retained = parent && typeof parent === "object" ? retainedResults.get(parent) : undefined;
  if (retained) {
    if (consumerCanonicalJson(parent) !== retained.source || retained.proof.scenario !== result.derivation.scenario)
      throw new Error("Consumer parent changed or producer scenario conflicts");
    derivedResults.set(result.rows, { parent: parent as object, key, output: consumerCanonicalJson(result.rows) });
  }
  return result;
}

/** Capture before any async export preparation. Returns null for arbitrary
 * rows/clones, and refuses a mutated registered derivation instead of degrading. */
export function captureDerivedConsumer(rows: unknown) {
  const binding = rows && typeof rows === "object" ? derivedResults.get(rows) : undefined;
  if (!binding) return null;
  const retained = retainedResults.get(binding.parent)!;
  if (consumerCanonicalJson(binding.parent) !== retained.source || consumerCanonicalJson(rows) !== binding.output)
    throw new Error("Derived consumer source or rows changed");
  const replay = deriveValuationPE(binding.parent, binding.key);
  if (consumerCanonicalJson(replay.rows) !== binding.output)
    throw new Error("Derived consumer replay conflicts");
  const captured = structuredClone({ version: "derived-consumer-lineage-1", parent: retained.proof,
    derivation: replay.derivation, rows: replay.rows,
    chartRows: replay.derivation.retainedIndices.map(index =>
      Object.fromEntries(Object.entries(replay.chartRows[index]).map(([key, value]) => [key, value ?? null]))),
    originalHistoricalExport: false, scientificAcceptance: false,
    meaning: "New prospective view export from the exact retained parent; not recovered original bytes, recalculation, data approval or scientific acceptance" });
  capturedConsumers.set(captured, consumerCanonicalJson(captured));
  return captured;
}

export async function derivedConsumerIdentity(captured: ReturnType<typeof captureDerivedConsumer>, rows: Record<string, unknown>[]) {
  if (!captured) return null;
  if (capturedConsumers.get(captured) !== consumerCanonicalJson(captured))
    throw new Error("Consumer capture must be unchanged response-derived identity, not caller attestation");
  if (consumerCanonicalJson(rows) !== consumerCanonicalJson(captured.rows))
    throw new Error("Export rows conflict with captured consumer derivation");
  const { rows: omitted, chartRows, ...identity } = captured;
  return { ...identity, derivationHash: await canonicalHash(identity.derivation),
    chartIdentity: { hash: await canonicalHash(chartRows),
      method: "SHA-256 canonical finite JSON of exact visible chart rows; missing fields explicit null; retained parent indices/order" },
    dataIdentity: { hash: (await exportDataIdentity(rows)).hash,
      method: "SHA-256 normalized rows, sorted keys, null missing cells, preserved array order" } };
}
