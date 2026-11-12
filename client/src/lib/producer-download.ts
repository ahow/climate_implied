/** This registry only consumes same-origin server response headers. There is no
 * setter taking an arbitrary UI payload/manifest or global 'current' proof. */
import type { RetainedProducerIdentity } from "../../../shared/downloadManifest";
import { consumerCanonicalJson, deriveValuationPE, deriveSignalConsumer,
  type ValuationPEDerivation, type SignalConsumerKey, type SignalConsumerSelection } from "../../../shared/derivedConsumer";
import { exportDataIdentity } from "./export-identity";
import { currentSelection, type AnalysisSelection } from "./analysis-selection";
import { deriveReadonlyConsumer, READONLY_PRODUCER_SCENARIO, type ReadonlyConsumerKey } from "../../../shared/readonlyConsumer";
import { deriveNativeConsumer, NATIVE_PRODUCER_SCENARIO, type NativeConsumerKey, type NativeScenario } from "../../../shared/nativeConsumer";

const retainedResults = new WeakMap<object, {
  proof: RetainedProducerIdentity; source: string; selection: string;
}>();
const derivedResults = new WeakMap<object, {
  parent: object; key: ValuationPEDerivation; output: string;
}>();
const signalResults = new WeakMap<object, {
  parents: readonly unknown[]; key: SignalConsumerKey; selection: SignalConsumerSelection; output: string;
  chartRows: unknown; chartOutput: string;
}>();
const capturedConsumers = new WeakMap<object, string>();
const readonlyResults = new WeakMap<object, { parent: object; key: ReadonlyConsumerKey; output: string }>();
const nativeResults = new WeakMap<object, { parent: object; key: NativeConsumerKey; scenario: NativeScenario; output: string }>();
async function canonicalHash(value: unknown) {
  const bytes = new TextEncoder().encode(consumerCanonicalJson(value));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
    .map(x => x.toString(16).padStart(2, "0")).join("");
}
export function retainProducerDownload(response: Response, requestedSelection: AnalysisSelection | null = currentSelection()) {
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
      !(proof.scenario === READONLY_PRODUCER_SCENARIO || proof.scenario === NATIVE_PRODUCER_SCENARIO || ["summary", "carbon-price", "pe-comparison", "sdg-growth", "decarb-bands",
        "decarb-terciles", "decarb-gap/summary", "decarb-gap/timeseries", "backtest"]
         .some(path => proof.scenario === `descriptive-valuation:/${path}`)) ||
      proof.scientificAcceptance !== false)
    throw new Error("Invalid server retained-result identity; result withheld");
  const json = response.json.bind(response);
  const selection = consumerCanonicalJson(requestedSelection);
  response.json = async () => {
    const payload = await json();
    // Stored replay wraps the retained result; native producers/exact JSON do not.
    const native = response.url && /\/api\/analysis\/results\/[a-f0-9]{64}$/.test(new URL(response.url).pathname)
      ? payload.result : payload;
    if (await canonicalHash(native) !== proof.resultHash)
      throw new Error("Server producer result hash conflicts with consumed response");
    if (payload && typeof payload === "object")
      retainedResults.set(payload, { proof: structuredClone(proof), source: consumerCanonicalJson(native), selection });
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

export function deriveProducerSignalConsumer<K extends SignalConsumerKey>(
  parents: readonly unknown[], key: K, selection: SignalConsumerSelection,
) {
  const result = deriveSignalConsumer(parents, key, selection);
  // Register even incomplete display chains: an intended bound download must
  // REFUSE, not quietly become an ordinary unbound export.
  signalResults.set(result.rows, { parents: [...parents], key, selection,
    output: consumerCanonicalJson(result.rows), chartRows: result.chartRows,
    chartOutput: consumerCanonicalJson(result.chartRows) });
  return result;
}

/** Existing typed UI row builders remain the public column domain. Their
 * output must exactly equal this closed replay; neither mapped rows nor
 * caller-supplied metadata can authenticate the parent. */
export function bindProducerReadonlyConsumer<T extends Record<string, unknown>>(
  parent: object, key: ReadonlyConsumerKey, rows: T[],
): T[] {
  const replay = deriveReadonlyConsumer(parent, key);
  if (consumerCanonicalJson(replay.rows) !== consumerCanonicalJson(rows))
    throw new Error("Readonly consumer projection conflicts with closed replay");
  readonlyResults.set(rows, { parent, key, output: consumerCanonicalJson(rows) });
  return rows;
}
function captureReadonlyConsumer(rows: unknown, binding: NonNullable<ReturnType<typeof readonlyResults.get>>) {
  const retained = retainedResults.get(binding.parent);
  if (!retained) throw new Error("Readonly consumer retained producer parent unavailable; bound download refused");
  const replay = deriveReadonlyConsumer(binding.parent, binding.key);
  const data = binding.parent as { from: string; to: string };
  if (retained.proof.scenario !== READONLY_PRODUCER_SCENARIO ||
    consumerCanonicalJson(retained.proof.orderedSnapshotHashes) !== consumerCanonicalJson([data.from, data.to]) ||
    retained.source !== consumerCanonicalJson(binding.parent))
    throw new Error("Readonly consumer parent changed or source identity conflicts");
  if (retained.selection !== consumerCanonicalJson(currentSelection()))
    throw new Error("Readonly consumer belongs to a stale requested UI selection");
  if (binding.output !== consumerCanonicalJson(rows) || binding.output !== consumerCanonicalJson(replay.rows))
    throw new Error("Readonly consumer rows changed or replay conflicts");
  const captured = structuredClone({ version: "derived-consumer-lineage-1", parent: retained.proof,
    derivation: replay.derivation, rows: replay.rows, chartRows: replay.chartRows,
    originalHistoricalExport: false, scientificAcceptance: false,
    meaning: "Prospective safe source-comparison view from verified retained archives and exact paginated scan; not model execution, original vintage, source approval or private publication" });
  capturedConsumers.set(captured, consumerCanonicalJson(captured));
  return captured;
}

export function bindProducerNativeConsumer<T extends Record<string, unknown>>(
  parent: object, key: NativeConsumerKey, rows: T[], scenario: NativeScenario,
): T[] {
  // Legacy/partial but honest displays are not producer attestation. Preserve
  // their established download availability; only a consumed server proof can
  // enter the new strict parent/replay branch.
  if (!retainedResults.has(parent)) return rows;
  const replay = deriveNativeConsumer(parent, key, scenario);
  if (consumerCanonicalJson(replay.rows) !== consumerCanonicalJson(rows))
    throw new Error("Native consumer projection conflicts with exact replay");
  // Ordinary correct native data remains downloadable if automatic retention
  // failed. It cannot acquire a producer identity or pretend to be retained.
  nativeResults.set(rows, { parent, key, scenario, output: consumerCanonicalJson(rows) });
  return rows;
}
function captureNativeConsumer(rows: unknown, binding: NonNullable<ReturnType<typeof nativeResults.get>>) {
  const retained = retainedResults.get(binding.parent);
  if (!retained || retained.proof.scenario !== NATIVE_PRODUCER_SCENARIO ||
    retained.source !== consumerCanonicalJson(binding.parent))
    throw new Error("Native consumer retained parent missing, changed or conflicting");
  if (retained.selection !== consumerCanonicalJson(currentSelection()))
    throw new Error("Native consumer belongs to stale requested input selection");
  const replay = deriveNativeConsumer(binding.parent, binding.key, binding.scenario);
  if (binding.output !== consumerCanonicalJson(rows) || binding.output !== consumerCanonicalJson(replay.rows))
    throw new Error("Native consumer rows or exact replay changed");
  const captured = structuredClone({ version: "derived-consumer-lineage-1", parent: retained.proof,
    derivation: replay.derivation, rows: replay.rows, chartRows: replay.chartRows,
    originalHistoricalExport: false, scientificAcceptance: false,
    meaning: "New conditional native candidate export from actual retained dated inputs, native inventory, engine source and completed response; not calibrated, a temperature run, forecast, original vintage or scientific acceptance" });
  capturedConsumers.set(captured, consumerCanonicalJson(captured));
  return captured;
}

function captureSignalConsumer(rows: unknown, binding: NonNullable<ReturnType<typeof signalResults.get>>) {
  const replay = deriveSignalConsumer(binding.parents, binding.key, binding.selection);
  const retained = binding.parents.map((parent, index) => {
    const source = parent && typeof parent === "object" ? retainedResults.get(parent) : undefined;
    if (!source) throw new Error(`Signal consumer retained parent ${index} unavailable; bound download refused`);
    if (source.source !== consumerCanonicalJson(parent) || source.proof.scenario !== replay.scenarios[index])
      throw new Error("Signal consumer parent changed or producer scenario conflicts");
    const active = currentSelection();
    if (source.selection !== consumerCanonicalJson(active))
      throw new Error("Signal consumer parent belongs to a stale requested source selection");
    if (active && (source.proof.orderedSnapshotHashes[0] !== active.workbook ||
      source.proof.orderedSnapshotHashes.at(-1) !== active.indicators ||
      active.overlays && consumerCanonicalJson(source.proof.orderedSnapshotHashes) !==
        consumerCanonicalJson([active.workbook, ...active.overlays, active.indicators])))
      throw new Error("Signal consumer parent conflicts with active archived source selection");
    return source;
  });
  const first = retained[0].proof;
  // captureMaterialInputs archives workbook/ordered overlays/cutoff,
  // readsIndicators, approved/effective indicators and sourceArchive, NOT
  // scenario or calculator query settings. All these signal parents are
  // workbook readers (therefore readsIndicators=true). Different material IDs
  // here mean different consumed material, even with identical snapshot pins.
  if (retained.some(source => consumerCanonicalJson(source.proof.orderedSnapshotHashes) !==
      consumerCanonicalJson(first.orderedSnapshotHashes) ||
      source.proof.codeArchiveId !== first.codeArchiveId || source.proof.modelVersion !== first.modelVersion ||
      source.proof.materialInputsId !== first.materialInputsId))
    throw new Error("Signal consumer parents have conflicting retained source selections");
  if (binding.output !== consumerCanonicalJson(rows) || binding.output !== consumerCanonicalJson(replay.rows))
    throw new Error("Signal consumer rows or replay changed");
  if (binding.chartOutput !== consumerCanonicalJson(binding.chartRows) ||
      binding.chartOutput !== consumerCanonicalJson(replay.chartRows))
    throw new Error("Signal consumer visible chart rows changed or replay conflicts");
  if (!["signal-comparison", "group-gap"].includes(binding.key)) {
    const expectedSignal = binding.selection === "sdg_alignment" ? "sdg_exposure" : binding.selection;
    binding.parents.forEach((parent: any, index) => {
      if (parent?.summary?.signal !== (index === 0 ? expectedSignal : "decarb_gap"))
        throw new Error("Signal consumer backtest selection conflicts with retained summary");
    });
  }
  const captured = structuredClone({ version: "derived-consumer-lineage-1",
    parent: first, parents: retained.map(source => source.proof),
    derivation: replay.derivation, rows: replay.rows, chartRows: replay.chartRows,
    intermediates: replay.intermediates,
    originalHistoricalExport: false, scientificAcceptance: false,
    meaning: "New prospective chained view export from exact retained parents; not original bytes, recalculation, approval or scientific acceptance" });
  capturedConsumers.set(captured, consumerCanonicalJson(captured));
  return captured;
}

/** Capture before any async export preparation. Returns null for arbitrary
 * rows/clones, and refuses a mutated registered derivation instead of degrading. */
export function captureDerivedConsumer(rows: unknown) {
  const native = rows && typeof rows === "object" ? nativeResults.get(rows) : undefined;
  if (native) return captureNativeConsumer(rows, native);
  const readonly = rows && typeof rows === "object" ? readonlyResults.get(rows) : undefined;
  if (readonly) return captureReadonlyConsumer(rows, readonly);
  const signal = rows && typeof rows === "object" ? signalResults.get(rows) : undefined;
  if (signal) return captureSignalConsumer(rows, signal);
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
      method: "SHA-256 canonical finite JSON of exact replayed visible chart rows; missing values explicit null; closed derivation declares parent indices, filter and join/order policy" },
    dataIdentity: { hash: (await exportDataIdentity(rows)).hash,
      method: "SHA-256 normalized rows, sorted keys, null missing cells, preserved array order" } };
}
