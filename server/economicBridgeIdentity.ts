import type { Response } from "express";
import { readFileSync, existsSync } from "node:fs";
import { dirname, normalize, join } from "node:path";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { contentHash } from "./calculation/analysisManifest";
import { readCalculationSourceArtifact } from "./snapshots/materialInputs";
import { economicBridgeCells, economicBridgeContracts, type EconomicBridgeDocument, type EconomicBridgeKey } from "../shared/economicBridgeSchema";

export interface EconomicBridgeAdapter {
  key: EconomicBridgeKey;
  entryFiles: string[];
  execute(): unknown;
  /** Exact consumed public facts, material, assumptions, model and derivation
   * projected from the worker's actual executed report, never a static reference. */
  parts(report: unknown): { source: unknown; material: unknown; assumptions: unknown; model: unknown; derivation: unknown };
}
export interface EconomicBridgeArchiveReader {
  source(): ReturnType<typeof readCalculationSourceArtifact> | Promise<ReturnType<typeof readCalculationSourceArtifact>>;
  file(path: string): string;
}
const publicArchive: EconomicBridgeArchiveReader = {
  source: readCalculationSourceArtifact,
  file: path => readFileSync(path, "utf8"),
};
const sha = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const commonFiles = [
  "server/producerReserveApi.ts", "server/economicBridgeIdentity.ts", "server/companyConditionalApi.ts",
  "server/downloadManifestMiddleware.ts", "server/snapshots/calculationSourceArtifact.ts",
  "shared/economicBridgeSchema.ts", "shared/serverDownloadRegistry.ts",
  "package.json", "package-lock.json", "tsconfig.json",
];
/** Capture dependency bytes alongside the loaded models, NOT at request time.
 * Follow exact local import/re-export specifiers, including embedded JSON. */
export function captureEconomicBridgeClosure(adapters: EconomicBridgeAdapter[]) {
  const files: Record<string, string> = {};
  function visit(path: string) {
    if (Object.hasOwn(files, path)) return;
    const text = readFileSync(path, "utf8");
    files[path] = text;
    if (!/\.tsx?$/.test(path)) return;
    const imports = Array.from(text.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)["']([^"']+)["']/g));
    for (const match of imports) {
      const specifier = match[1];
      if (!specifier.startsWith(".") && !specifier.startsWith("@shared/")) continue;
      const base = specifier.startsWith("@shared/") ? `shared/${specifier.slice(8)}` : normalize(join(dirname(path), specifier));
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.json`, `${base}/index.ts`].find(candidate => existsSync(candidate) && /\.[a-z]+$/.test(candidate));
      if (!resolved) throw new Error(`Unresolved public calculation dependency: ${specifier} from ${path}`);
      visit(resolved);
    }
  }
  for (const path of [...commonFiles, ...adapters.flatMap(adapter => adapter.entryFiles)]) visit(path);
  return Object.freeze(files);
}
export async function executeEconomicBridge(adapter: EconomicBridgeAdapter, release: Readonly<Record<string, string>>,
  archive: EconomicBridgeArchiveReader = publicArchive): Promise<EconomicBridgeDocument> {
  const source = await archive.source();
  const payload = source?.payload as { version?: string; files?: Record<string, string> } | undefined;
  if (!source || !/^[a-f0-9]{64}$/.test(source.id) || contentHash(payload) !== source.id ||
    payload?.version !== "calculation-source-1" || !payload.files)
    throw new Error("Missing or corrupt calculation source archive");
  if (source.id !== readCalculationSourceArtifact().id)
    throw new Error("Unknown or stale prospective calculation source archive identity");
  const files = Object.keys(release).sort().map(path => {
    if (payload.files![path] !== release[path] || archive.file(path) !== release[path])
      throw new Error(`Missing, corrupt or stale executed calculation code/source: ${path}`);
    return { path, sha256: sha(release[path]) };
  });
  const report = adapter.execute();
  // Canonical finite JSON rejects NaN, undefined and accidental raw objects.
  const resultHash = contentHash(report), parts = adapter.parts(report);
  const sourceArtifact = { id: contentHash(parts.source), value: parts.source };
  const materialInputs = { id: contentHash(parts.material), value: parts.material };
  const assumptions = { id: contentHash(parts.assumptions), value: parts.assumptions };
  const model = { id: contentHash(parts.model), value: parts.model };
  const parent = { kind: "public-prospective-inputs" as const,
    id: contentHash({ source: sourceArtifact.id, material: materialInputs.id, assumptions: assumptions.id, model: model.id }),
    retainedResultId: null };
  const derivation = { id: contentHash({ parent, codeArchiveId: source.id, modelId: model.id,
    resultHash, value: parts.derivation }), value: parts.derivation };
  const identity = {
    version: "prospective-economic-identity-1" as const, key: adapter.key,
    claim: economicBridgeContracts[adapter.key].claim,
    codeArtifact: { id: source.id, contract: "calculation-source-1" as const, files },
    sourceArtifact, materialInputs, assumptions, model, parent, derivation, resultHash,
    retainedExecution: false as const, originalHistoricalExport: false as const,
    sourceApproval: false as const, scientificAcceptance: false as const,
  };
  return { version: "supplemental-economic-calculation-1", key: adapter.key, report,
    identity: { ...identity, id: contentHash(identity) } };
}
export async function verifyEconomicBridgeDocument(document: EconomicBridgeDocument, adapter: EconomicBridgeAdapter,
  release: Readonly<Record<string, string>>, archive?: EconomicBridgeArchiveReader) {
  const expected = await executeEconomicBridge(adapter, release, archive);
  if (contentHash(document) !== contentHash(expected))
    throw new Error("Unknown or stale calculation, parent, material, model, derivation or result identity");
  return expected;
}
const bindings = new WeakMap<Response, EconomicBridgeDocument>();
export function bindEconomicBridgeResponse(res: Response, document: EconomicBridgeDocument) {
  bindings.set(res, structuredClone(document));
}
export function verifyEconomicBridgeWorkbook(workbook: XLSX.WorkBook, document: EconomicBridgeDocument) {
  if (contentHash(workbook.SheetNames) !== contentHash(["Public calculation"]))
    throw new Error("Unexpected calculation workbook sheets");
  const sheet = workbook.Sheets["Public calculation"];
  const expected = [["JSON pointer", "Literal JSON value"], ...economicBridgeCells(document).map(row => [row.pointer, row.jsonValue])];
  if (contentHash(XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })) !== contentHash(expected))
    throw new Error("Calculation workbook literal readback conflicts with exact JSON body");
  const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
  for (const [address, cell] of Object.entries(sheet)) {
    if (address.startsWith("!")) continue;
    if (!/^[A-Z]+[1-9]\d*$/.test(address)) throw new Error("Unexpected workbook cell address");
    const point = XLSX.utils.decode_cell(address);
    if (!range || point.r < range.s.r || point.r > range.e.r || point.c < range.s.c || point.c > range.e.c ||
      cell && typeof cell === "object" && ("f" in cell || "F" in cell || "l" in cell || cell.t !== "s"))
      throw new Error("Calculation workbook requires exact literal string cells within declared range");
  }
  return true;
}
export function responseEconomicBridge(res: Response, document: unknown, workbook?: XLSX.WorkBook) {
  const bound = bindings.get(res);
  if (!bound) return null;
  if (workbook) verifyEconomicBridgeWorkbook(workbook, bound);
  else if (contentHash(document) !== contentHash(bound)) throw new Error("Calculation attachment body conflicts with bound execution");
  return economicBridgeManifestIdentity(bound.identity);
}
/** Full source/material/formula identities are already in the exact JSON body
 * and literal workbook. Keep transport headers bounded; never duplicate those
 * public registers into a base64 header that browsers/proxies cannot accept. */
export function economicBridgeManifestIdentity(identity: EconomicBridgeDocument["identity"]) {
  return {
    version: "prospective-economic-binding-1", key: identity.key,
    identityId: identity.id, identityLocation: "/identity in exact public JSON or literal workbook readback",
    resultHash: identity.resultHash,
    codeArtifact: { id: identity.codeArtifact.id, contract: identity.codeArtifact.contract,
      closureHash: contentHash(identity.codeArtifact.files), closureFiles: identity.codeArtifact.files.length },
    sourceArtifactId: identity.sourceArtifact.id, materialInputsId: identity.materialInputs.id,
    assumptionsId: identity.assumptions.id, modelId: identity.model.id,
    parent: identity.parent, derivationId: identity.derivation.id,
    retainedExecution: false, originalHistoricalExport: false, sourceApproval: false, scientificAcceptance: false,
  };
}
