import { z } from "zod";
import { requireHistoricalType } from "./historicalTypes";

const hash = z.string().regex(/^[a-f0-9]{64}$/), count = z.number().int().nonnegative();
export const readonlyConsumerSchema = z.object({
  version: z.literal("readonly-diff-1"), from: hash, to: hash,
  kind: z.enum(["workbook-baseline", "company-overlay", "indicator-overrides", "material-inputs"]),
  approvalState: z.enum(["archived-reviewed-overlay", "archived-approved-indicators", "not-established-by-archive"]),
  fields: z.array(z.object({ domain: z.string().min(1), field: z.string().min(1),
    added: count, removed: count, changed: count, beforeHash: hash, afterHash: hash }).strict()),
  affectedAnalyses: z.array(z.object({ resultId: hash, manifestId: hash, scenario: z.string().min(1),
    recordedAt: z.string().datetime(), historicalTypeCode: z.string(), historicalTypeLabel: z.string(),
    relation: z.enum(["consumed-before-version", "consumed-after-version", "consumed-both-versions"]),
  }).strict().superRefine((row, ctx) => {
    try { requireHistoricalType(row); }
    catch { ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid exact historical type" }); }
  })),
  scannedResults: count, nextCursor: hash.nullable(), disclosure: z.string().min(1),
  historicalBasis: z.string().min(1), affectedMeaning: z.string().min(1),
}).strict();
export type ReadonlyConsumerKey = "version-diff" | "affected-analyses";
export const READONLY_PRODUCER_SCENARIO = "source-backed:readonly-diff-1";
export const readonlyConsumerFieldMaps = {
  "version-diff": {
    From: "from", To: "to", Kind: "kind", Domain: "fields[].domain", Field: "fields[].field",
    Added: "fields[].added", Removed: "fields[].removed", Changed: "fields[].changed",
    "Before content SHA-256": "fields[].beforeHash", "After content SHA-256": "fields[].afterHash",
    "Approval state": "approvalState", "History basis": "historicalBasis",
  },
  "affected-analyses": {
    From: "from", To: "to", "Result ID": "affectedAnalyses[].resultId", "Manifest ID": "affectedAnalyses[].manifestId",
    Scenario: "affectedAnalyses[].scenario", "Recorded at": "affectedAnalyses[].recordedAt",
    Relation: "affectedAnalyses[].relation", "Historical type code": "affectedAnalyses[].historicalTypeCode",
    "Historical type label": "affectedAnalyses[].historicalTypeLabel", "Result scan scope": "affectedMeaning",
  },
} as const;
export function readonlyConsumerColumnUnit(column: string) {
  return ["Added", "Removed", "Changed"].includes(column) ? "integer source-cell count" :
    column.includes("SHA-256") || ["From", "To", "Result ID", "Manifest ID"].includes(column) ? "SHA-256" :
      column === "Recorded at" ? "UTC recorded timestamp; not publication time" : "text";
}
export function deriveReadonlyConsumer(parent: unknown, key: ReadonlyConsumerKey) {
  if (key !== "version-diff" && key !== "affected-analyses") throw new Error("Unknown readonly consumer");
  const data = readonlyConsumerSchema.parse(parent);
  const rows = key === "version-diff" ? data.fields.map(field => ({
    From: data.from, To: data.to, Kind: data.kind, Domain: field.domain, Field: field.field,
    Added: field.added, Removed: field.removed, Changed: field.changed,
    "Before content SHA-256": field.beforeHash, "After content SHA-256": field.afterHash,
    "Approval state": data.approvalState, "History basis": data.historicalBasis,
  })) : data.affectedAnalyses.map(a => ({
    From: data.from, To: data.to, "Result ID": a.resultId, "Manifest ID": a.manifestId,
    Scenario: a.scenario, "Recorded at": a.recordedAt, Relation: a.relation,
    ...requireHistoricalType(a), "Result scan scope": data.affectedMeaning,
  }));
  const fields = readonlyConsumerFieldMaps[key];
  const units = Object.fromEntries(Object.keys(fields).map(column => [column, readonlyConsumerColumnUnit(column)]));
  return { rows, chartRows: key === "version-diff" ? data.fields : data.affectedAnalyses,
    derivation: {
      version: "readonly-diff-consumer-1", key, scenario: READONLY_PRODUCER_SCENARIO,
      fields, units,
      filter: key === "version-diff" ? "Every fields record on this exact report page; no filtering" :
        "Every affectedAnalyses record on this exact report page; no filtering or inferred impacts",
      order: "Preserve exact native report array order, including duplicates; no sorting or deduplication",
      retainedIndices: rows.map((_, index) => index), excludedIndices: [] as number[],
      transformation: "Identity projections only; require exact historical type code/label; zero counts retained; no source values published",
      chartTransformation: "Same exact native report record array rendered by VersionDiffResult; full source response retained separately",
      chartFields: Object.fromEntries(Object.entries(fields).map(([column, field]) => [column, field])),
      chartUnits: { value: "Source-cell counts or retained dependency identifiers, not model output" },
      missingness: "Required report fields must exist and validate; no missing report, archive, cursor or result fallback",
    } };
}
