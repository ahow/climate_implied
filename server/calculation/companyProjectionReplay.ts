/** Offline, fail-closed replay of the existing conditional company engine.
 * No database, live collectors, selection globals, approvals or current-data fallback. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import * as XLSX from "xlsx";
import {companyReplaySemantics,companyReplayLedgerColumns} from "../../shared/companyReplaySemantics";
import { companyAbatementSemantics, companyAbatementColumns, companyAbatementInputColumns,
  companyAbatementLedgerSemantics } from "../../shared/companyAbatementSemantics";
import { canonicalJson, contentHash } from "./analysisManifest";
import { projectCompanyAsOf } from "./companyProjectionAsOf";
import { resolveCompanySourceEvidence, unpackCompanySource } from "./companySourceArchive";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const codePaths = [
  "server/calculation/analysisManifest.ts",
  "server/calculation/companyProjection.ts",
  "server/calculation/companyProjectionAsOf.ts",
  "server/calculation/companySourceArchive.ts",
  "server/calculation/companyProjectionReplay.ts",
  "script/replay-company-projection.ts",
  "shared/companyReplaySemantics.ts",
  "package.json", "package-lock.json",
] as const;
const model = "companyProjection/conditional-operating-ledger-1";
const exportContract = "company-projection-full-ledger-xlsx-1";
const settingsSchema = z.object({
  companyId: z.string().min(1), isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/),
  informationCutoff: z.string().datetime(),
  model: z.literal(model), exportContract: z.literal(exportContract),
}).strict();
const codeSchema = z.object({
  model: z.literal(model), node: z.string().min(1),
  files: z.record(z.string()), filesHash: hash,
}).strict();
const manifestSchema = z.object({
  version: z.literal("company-projection-material-manifest-1"),
  codeId: hash, model: z.literal(model), settings: settingsSchema, settingsHash: hash,
  inputHash: hash, mappingHash: hash, evidenceHash: hash, sourceArchiveIds: z.array(hash).min(1),
}).strict();
const bundleSchema = z.object({
  version: z.literal("company-projection-replay-bundle-1"),
  manifestId: hash, manifest: manifestSchema, code: codeSchema,
  input: z.unknown(), evidence: z.unknown(), sources: z.record(z.unknown()),
}).strict();
export type CompanyReplayBundle = z.infer<typeof bundleSchema>;
export type CompanyReplaySettings = z.infer<typeof settingsSchema>;

/** Explicit non-secret allowlist, read afresh (never a process-wide cached identity).
 * Pins source bytes and lockfile, not a hermetic installed dependency/container image. */
export function companyReplayCode(root = process.cwd(), includeAbatement = false) {
  const paths: readonly string[] = includeAbatement ? [...codePaths, "shared/companyAbatementSemantics.ts"] : codePaths;
  const files = Object.fromEntries(paths.map(path => [path, readFileSync(`${root}/${path}`, "utf8")]));
  return codeSchema.parse({ model, node: process.version, files, filesHash: contentHash(files) });
}
function hasAbatementAccounting(input: unknown): boolean {
  const members = (input as { members?: { years?: { abatementAccounting?: unknown }[] }[] } | null)?.members;
  return Array.isArray(members) && members.some(m => Array.isArray(m.years) &&
    m.years.some(y => y.abatementAccounting !== undefined));
}
function detached<T>(value: T): T { return JSON.parse(canonicalJson(value)); }
function mappingOf(input: unknown) {
  if (!input || typeof input !== "object" || !Object.hasOwn(input, "mapping"))
    throw new Error("Missing pinned company mapping");
  return (input as Record<string, unknown>).mapping;
}
async function resolve(input: unknown, evidence: unknown, settings: CompanyReplaySettings,
  sources: Record<string, unknown>) {
  return resolveCompanySourceEvidence(input, evidence, settings.informationCutoff, settings, async id => {
    if (!Object.hasOwn(sources, id)) throw new Error(`Missing pinned company source ${id}`);
    return sources[id];
  });
}
export async function pinCompanyProjection(input: unknown, evidence: unknown,
  settingsInput: CompanyReplaySettings, sources: Record<string, unknown>): Promise<CompanyReplayBundle> {
  // Snapshot all arguments before the first await; callers may mutate selections concurrently.
  const snapshot = detached({ input, evidence, settings: settingsInput, sources });
  const settings = settingsSchema.parse(snapshot.settings);
  if (!snapshot.input || typeof snapshot.input !== "object" ||
      (snapshot.input as Record<string, unknown>).companyId !== settings.companyId)
    throw new Error("Pinned input company identity mismatch");
  const resolved = await resolve(snapshot.input, snapshot.evidence, settings, snapshot.sources);
  projectCompanyAsOf(snapshot.input, snapshot.evidence, settings.informationCutoff);
  const code = companyReplayCode(process.cwd(), hasAbatementAccounting(snapshot.input));
  const manifest = manifestSchema.parse({
    version: "company-projection-material-manifest-1", codeId: contentHash(code), model, settings,
    settingsHash: contentHash(settings), inputHash: contentHash(snapshot.input),
    mappingHash: contentHash(mappingOf(snapshot.input)), evidenceHash: resolved.evidenceHash,
    sourceArchiveIds: resolved.sourceArchiveIds,
  });
  return detached({
    version: "company-projection-replay-bundle-1", manifestId: contentHash(manifest), manifest, code,
    input: snapshot.input, evidence: snapshot.evidence,
    sources: Object.fromEntries(resolved.sourceArchiveIds.map(id => [id, snapshot.sources[id]])),
  });
}

export async function replayCompanyProjection(value: unknown) {
  const bundle = bundleSchema.parse(detached(value));
  const { manifest: m, code, input, evidence, sources } = bundle;
  if (contentHash(m) !== bundle.manifestId) throw new Error("Corrupt company material manifest");
  if (contentHash(code.files) !== code.filesHash || contentHash(code) !== m.codeId)
    throw new Error("Corrupt pinned model code archive");
  if (canonicalJson(code) !== canonicalJson(companyReplayCode(process.cwd(), hasAbatementAccounting(input))))
    throw new Error("Pinned model code/runtime mismatch; current executable substitution forbidden");
  if (contentHash(m.settings) !== m.settingsHash || contentHash(input) !== m.inputHash ||
      contentHash(mappingOf(input)) !== m.mappingHash)
    throw new Error("Corrupt pinned company settings/input/mapping");
  if (!input || typeof input !== "object" ||
      (input as Record<string, unknown>).companyId !== m.settings.companyId)
    throw new Error("Pinned input company identity mismatch");
  if (canonicalJson(Object.keys(sources).sort()) !== canonicalJson(m.sourceArchiveIds))
    throw new Error("Missing, extra or conflicting pinned source selection");
  for (const id of m.sourceArchiveIds) unpackCompanySource(id, sources[id]);
  const resolved = await resolve(input, evidence, m.settings, sources);
  if (resolved.evidenceHash !== m.evidenceHash ||
      canonicalJson(resolved.sourceArchiveIds) !== canonicalJson(m.sourceArchiveIds))
    throw new Error("Conflicting pinned evidence selection");
  const result = {
    ...projectCompanyAsOf(input, evidence, m.settings.informationCutoff),
    replayManifestId: bundle.manifestId,
    resolvedSources: resolved,
    replayScope: "Isolated engineering replay; not scientific acceptance, publisher authentication or production approval",
  };
  return { manifestId: bundle.manifestId, resultHash: contentHash(result), result };
}

type Replay = Awaited<ReturnType<typeof replayCompanyProjection>>;
/** Full result is preserved in bounded JSON chunks as well as numeric ledger cells.
 * XLSX binary identity is checked independently from canonical worksheet-cell identity. */
export function exportCompanyProjectionReplay(replay: Replay) {
  if (contentHash(replay.result) !== replay.resultHash ||
      replay.result.replayManifestId !== replay.manifestId) throw new Error("Conflicting replay result identity");
  const ledger: (string | number | null)[][] = [[...companyReplayLedgerColumns]];
  const abatement: (string | number)[][] = [[...companyAbatementColumns]];
  const abatementInputs: (string | number)[][] = [[...companyAbatementInputColumns]];
  if (replay.result.status === "conditional-projection") {
    for (const member of replay.result.members) for (const y of member.years) {
      ledger.push([
        member.id, y.year, y.revenue, y.activityRatio, y.emissionsTonnes.scope1, y.emissionsTonnes.scope2,
        y.emissionsTonnes.scope3, y.operatingProfitBeforeCarbon, y.carbonDrag, y.interest,
        y.nonOperatingIncome, y.incomeAttributionAdjustment, y.otherCashAdjustments, y.cashTax,
        y.netIncome, y.depreciation, y.capex, y.increaseWorkingCapital, y.netBorrowing, y.fcfe,
        member.growth, member.growthStatus,
      ]);
      if (y.abatementReconciliation) {
        const check = y.abatementReconciliation;
        for (const scope of ["scope1", "scope2", "scope3"] as const) {
          const s = check[scope];
          abatement.push([member.id, y.year, scope, s.baseEmissionsTonnes, s.activityRatio, s.intensityMultiplier,
            s.beforeSeparateAbatementTonnes, s.remainingEmissionsMultiplier, s.emissionsTonnes, check.noDoubleCountingCheck]);
        }
        const declarations = canonicalJson(check.declaredAccounting);
        for (let i = 0; i < Math.ceil(declarations.length / 16000); i++)
          abatementInputs.push([member.id, y.year, i, declarations.slice(i * 16000, (i + 1) * 16000)]);
      }
    }
  }
  if(ledger.some(row=>row.length!==companyReplayLedgerColumns.length)) throw new Error("Unmapped company ledger export column");
  const json = canonicalJson(replay.result);
  const chunks = Array.from({ length: Math.ceil(json.length / 16000) }, (_, i) =>
    [i, json.slice(i * 16000, (i + 1) * 16000)]);
  const optIn = abatement.length > 1;
  const semantics = optIn ? [
    ...companyReplaySemantics.map(f => ({ ...f, ...companyAbatementLedgerSemantics[f.id] })),
    ...companyAbatementSemantics,
  ] : companyReplaySemantics;
  const tables = {
    Semantics:[["fieldId","meaning","unit","formula","source","period","geography","status","missingness","uncertainty","scope","asOfRule"],
      ...semantics.map(f=>[f.id,f.meaning,f.unit,f.formula,f.source,f.period,f.geography,f.status,f.missingness,f.uncertainty,f.scope,f.asOfRule])],
    Identity: [["contract", exportContract], ["manifestId", replay.manifestId], ["resultHash", replay.resultHash],
      ["status", replay.result.status], ["scientificAcceptance", "false"], ["productionEligible", "false"]],
    Ledger: ledger, FullResult: [["chunk", "canonicalResultJson"], ...chunks],
    ...(optIn ? { Abatement: abatement, AbatementInputs: abatementInputs } : {}),
  };
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(tables))
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  const bytes: Buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
  // SheetJS annotates its input Buffer; read a copy so the returned byte artifact is pristine.
  const decoded = XLSX.read(Buffer.from(bytes), { type: "buffer" });
  const cells = Object.fromEntries(decoded.SheetNames.map(name => [name,
    XLSX.utils.sheet_to_json(decoded.Sheets[name], { header: 1, defval: null, raw: true })]));
  if (contentHash(cells) !== contentHash(tables)) throw new Error("XLSX worksheet identity mismatch");
  const full = (cells.FullResult as (string | number)[][]).slice(1).map(row => row[1]).join("");
  if (contentHash(JSON.parse(full)) !== replay.resultHash) throw new Error("XLSX full result identity mismatch");
  return { bytes, binaryHash: createHash("sha256").update(bytes).digest("hex"),
    cellsHash: contentHash(cells), ledgerRows: ledger.length - 1, sheets: decoded.SheetNames };
}
