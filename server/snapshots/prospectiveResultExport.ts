/**
 * Pure encoding/verification boundary. Private DEV persistence is implemented
 * by prospectiveResultExportLifecycle via the existing workspace operator CLI.
 * No public writes, publishing, operator approval, source or current fallback.
 */
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { z } from "zod";
import { canonicalJson, contentHash } from "../calculation/analysisManifest";
import { verifiedProducer } from "../producerDownload";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const sheetContract = {
  version: "retained-result-json-chunks-1",
  sheets: ["Data", "Identity"],
  dataColumns: ["field", "value"],
  identityColumns: ["Field", "Value"],
  chunkCodePoints: 16000,
} as const;
const meaning = "NEW prospective offline export capture of a verified retained JSON result; not an original historical export, publication, operator approval or scientific acceptance";
const parentSchema = z.object({
  resultId: hash, resultHash: hash, manifestId: hash, materialInputsId: hash,
  codeArchiveId: hash, modelVersion: z.string().min(1),
  orderedSnapshotHashes: z.array(hash).min(1), scenario: z.string().min(1),
}).strict();
const recordSchema = z.object({
  version: z.literal("prospective-retained-result-xlsx-1"),
  capturedAt: z.string().datetime(),
  originalHistoricalExport: z.literal(false),
  meaning: z.literal(meaning),
  parent: parentSchema,
  sheetContract: z.object({
    version: z.literal(sheetContract.version),
    sheets: z.tuple([z.literal("Data"), z.literal("Identity")]),
    dataColumns: z.tuple([z.literal("field"), z.literal("value")]),
    identityColumns: z.tuple([z.literal("Field"), z.literal("Value")]),
    chunkCodePoints: z.literal(16000),
  }).strict(),
  binarySha256: hash,
  byteLength: z.number().int().positive(),
  cellsHash: hash,
  scientificAcceptance: z.literal(false),
}).strict();
export type ProspectiveResultExportRecord = z.infer<typeof recordSchema>;
type RetainedLoader = (resultId: string) => Promise<unknown>;
function binaryHash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
async function parentResult(resultId: string, load: RetainedLoader) {
  hash.parse(resultId);
  // The trusted dependency must be the existing verified retained-result reader.
  // No API taking submitted proof/approval or selected current inputs is offered.
  const loaded = await load(resultId) as Parameters<typeof verifiedProducer>[1];
  const proof = verifiedProducer(resultId, loaded, loaded.result);
  const { version: _version, meaning: _meaning, scientificAcceptance: _acceptance, ...parent } = proof;
  return { parent: parentSchema.parse(parent), result: structuredClone(loaded.result) };
}
function identityRows(record: Pick<ProspectiveResultExportRecord,
  "version" | "capturedAt" | "originalHistoricalExport" | "meaning" | "parent" | "scientificAcceptance"> & { sheetContract: unknown }) {
  return [
    [...sheetContract.identityColumns],
    ...Object.entries({
      version: record.version, capturedAt: record.capturedAt,
      originalHistoricalExport: record.originalHistoricalExport, meaning: record.meaning,
      parent: record.parent, sheetContract: record.sheetContract,
      scientificAcceptance: record.scientificAcceptance,
    }).map(([key, value]) => [key, canonicalJson(value)]),
  ];
}
function readCells(bytes: Buffer) {
  // SheetJS can annotate Buffer input; never hand it the retained original bytes.
  const workbook = XLSX.read(Buffer.from(bytes), { type: "buffer" });
  if (JSON.stringify(workbook.SheetNames) !== JSON.stringify(sheetContract.sheets))
    throw new Error("Recorded export sheet contract mismatch");
  return Object.fromEntries(workbook.SheetNames.map(name => [name,
    XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: null, raw: true })]));
}

/** New capture time is generated here, never supplied/backdated as old export
 * evidence. Returns private bytes/record to its caller; does not install them. */
export async function captureProspectiveResultXlsx(resultId: string, load: RetainedLoader) {
  const { parent, result } = await parentResult(resultId, load);
  const base = {
    version: "prospective-retained-result-xlsx-1" as const,
    capturedAt: new Date().toISOString(),
    originalHistoricalExport: false as const, meaning, parent,
    sheetContract, scientificAcceptance: false as const,
  } as const;
  // Existing nine-path replay serializer pattern: bounded lossless JSON chunks
  // in field/value cells, not an invented chart-column transform or source dump.
  const codePoints = Array.from(canonicalJson(result));
  const data = [
    [...sheetContract.dataColumns],
    ...Array.from({ length: Math.ceil(codePoints.length / sheetContract.chunkCodePoints) }, (_, index) => [
      `${parent.scenario}#${index}`,
      codePoints.slice(index * sheetContract.chunkCodePoints, (index + 1) * sheetContract.chunkCodePoints).join(""),
    ]),
  ];
  const tables = { Data: data, Identity: identityRows(base) };
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(tables))
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  const bytes: Buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
  const cells = readCells(bytes);
  if (contentHash(cells) !== contentHash(tables)) throw new Error("Prospective export worksheet readback mismatch");
  const record = recordSchema.parse({
    ...base, binarySha256: binaryHash(bytes), byteLength: bytes.length, cellsHash: contentHash(cells),
  });
  const id = contentHash(record);
  // Exercise the same strict loader before returning any successful capture.
  await readProspectiveResultXlsx(id, record, bytes, resultId, load);
  return { id, record, bytes: Buffer.from(bytes) };
}

/** Read only exact supplied retained bytes. Never repairs, regenerates, resolves
 * paths, upgrades versions or substitutes another parent/current result. */
export async function readProspectiveResultXlsx(captureId: string, recordInput: unknown,
  bytesInput: Uint8Array, expectedParentResultId: string, load: RetainedLoader) {
  hash.parse(captureId);
  hash.parse(expectedParentResultId);
  const record = recordSchema.parse(recordInput);
  const bytes = Buffer.from(bytesInput);
  if (contentHash(record) !== captureId) throw new Error("Prospective export record identity mismatch");
  if (record.parent.resultId !== expectedParentResultId) throw new Error("Wrong retained export parent");
  if (bytes.length !== record.byteLength || binaryHash(bytes) !== record.binarySha256)
    throw new Error("Missing or corrupt recorded XLSX bytes");
  const { parent, result } = await parentResult(expectedParentResultId, load);
  if (canonicalJson(parent) !== canonicalJson(record.parent)) throw new Error("Recorded export producer dependency mismatch");
  const cells = readCells(bytes);
  if (contentHash(cells) !== record.cellsHash) throw new Error("Recorded export cells hash mismatch");
  if (canonicalJson(cells.Identity) !== canonicalJson(identityRows(record)) ||
      canonicalJson(cells.Data[0]) !== canonicalJson([...sheetContract.dataColumns]))
    throw new Error("Recorded XLSX identity or column contract mismatch");
  const rows = cells.Data.slice(1);
  if (!rows.length || rows.some((row, index) => row.length !== 2 ||
      row[0] !== `${parent.scenario}#${index}` || typeof row[1] !== "string" ||
      Array.from(row[1]).length > sheetContract.chunkCodePoints))
    throw new Error("Recorded result chunk contract mismatch");
  const serialized = rows.map(row => row[1]).join("");
  if (serialized !== canonicalJson(result) || contentHash(JSON.parse(serialized)) !== parent.resultHash)
    throw new Error("Recorded XLSX result does not match its retained parent");
  return { id: captureId, record: structuredClone(record), bytes: Buffer.from(bytes) };
}
