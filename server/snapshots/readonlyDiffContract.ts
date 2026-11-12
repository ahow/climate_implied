import { z } from "zod";
import { canonicalJson, contentHash } from "../calculation/analysisManifest";
import { unpackDataset, type DatasetChunk } from "./contract";
import { unpackOverlay } from "./overlayContract";
import { unpackIndicators } from "./indicatorContract";

export const diffQuerySchema = z.object({
  from: z.string().regex(/^[a-f0-9]{64}$/), to: z.string().regex(/^[a-f0-9]{64}$/),
  kind: z.enum(["workbook-baseline", "company-overlay", "indicator-overrides", "material-inputs"]),
}).strict();
export type DiffQuery = z.infer<typeof diffQuerySchema>;
export type DiffArchive = { id: string; kind: DiffQuery["kind"]; chunks: unknown[];
  observationCount: number; companyCount: number };
type Cell = { domain: string; field: string; key: string; value: unknown };
const carbon = ["scope1Emissions", "scope2Emissions", "scope3Emissions"];
const financial = ["marketCap", "netProfit", "priceEarnings", "totalReturnIndex"];
function cells(archive: DiffArchive): Cell[] {
  const result: Cell[] = [];
  const add = (domain: string, field: string, key: string, value: unknown) => {
    // Undefined is corruption, not a null or zero source observation.
    canonicalJson(value);
    result.push({ domain, field, key, value });
  };
  if (archive.kind === "workbook-baseline") {
    const data = unpackDataset(archive.id, archive.chunks as DatasetChunk[]);
    if (data.companies.length !== archive.companyCount || data.timeSeries.length !== archive.observationCount)
      throw new Error("Snapshot population mismatch");
    for (const c of data.companies) add("sdg", "sdgAlignmentScore", String(c.id), c.sdgAlignmentScore);
    for (const r of data.timeSeries) for (const field of [...carbon, ...financial])
      add(carbon.includes(field) ? "carbon" : "financial", field,
        `${r.companyId}:${r.date.toISOString()}`, (r as unknown as Record<string, unknown>)[field]);
  } else {
    if (archive.chunks.length !== 1) throw new Error("Incomplete single-chunk archive");
    if (archive.kind === "company-overlay") {
      const data = unpackOverlay(archive.id, archive.chunks[0]);
      if (data.entries.length !== archive.observationCount) throw new Error("Overlay count mismatch");
      for (const e of data.entries)
        add(e.kind, e.field, `${e.companyId}:${e.observationDate}`, {
          value: e.value, availableAt: e.availableAt, source: e.source, approvalEvidence: e.approvalEvidence,
          ...(e.targetEvidence ? { targetEvidence: e.targetEvidence } : {}),
        });
    } else if (archive.kind === "indicator-overrides") {
      const rows = unpackIndicators(archive.id, archive.chunks[0]);
      if (rows.length !== archive.observationCount) throw new Error("Indicator count mismatch");
      for (const r of rows) add("driver", r.indicatorKey, String(r.year), r);
    } else {
      const data = z.object({ version: z.literal("material-inputs-1"),
        effectiveHistoricalIndicators: z.array(z.record(z.unknown())).nullable(),
        readsIndicators: z.boolean() }).passthrough().parse(archive.chunks[0]);
      if (contentHash(archive.chunks[0]) !== archive.id) throw new Error("Material content hash mismatch");
      if (!data.readsIndicators || data.effectiveHistoricalIndicators === null)
        throw new Error("Material archive did not consume drivers");
      for (const r of data.effectiveHistoricalIndicators) {
        if (typeof r.year !== "number" || !Number.isInteger(r.year)) throw new Error("Invalid driver year");
        for (const [field, value] of Object.entries(r)) if (field !== "year")
          add("driver", field, String(r.year), value);
      }
    }
  }
  if (new Set(result.map(r => `${r.domain}:${r.field}:${r.key}`)).size !== result.length)
    throw new Error("Duplicate archived diff cell");
  return result;
}
/** Public projection intentionally contains no source values, excerpts, filing locators or licensed rows. */
export function compareReadonlyArchives(query: DiffQuery, before: DiffArchive, after: DiffArchive) {
  if (before.id !== query.from || after.id !== query.to || before.kind !== query.kind || after.kind !== query.kind)
    throw new Error("Requested archive identity or kind mismatch");
  const left = cells(before), right = cells(after);
  const groups = new Map<string, { domain: string; field: string; added: number; removed: number; changed: number;
    beforeHash: string; afterHash: string }>();
  for (const group of Array.from(new Set([...left, ...right].map(r => `${r.domain}:${r.field}`)))) {
    const a = left.filter(r => `${r.domain}:${r.field}` === group).sort((x,y) => x.key.localeCompare(y.key));
    const b = right.filter(r => `${r.domain}:${r.field}` === group).sort((x,y) => x.key.localeCompare(y.key));
    const am = new Map(a.map(r => [r.key, canonicalJson(r.value)]));
    const bm = new Map(b.map(r => [r.key, canonicalJson(r.value)]));
    groups.set(group, { domain: (a[0] ?? b[0]).domain, field: (a[0] ?? b[0]).field,
      added: b.filter(r => !am.has(r.key)).length, removed: a.filter(r => !bm.has(r.key)).length,
      changed: b.filter(r => am.has(r.key) && am.get(r.key) !== bm.get(r.key)).length,
      beforeHash: contentHash(a), afterHash: contentHash(b) });
  }
  return { version: "readonly-diff-1", ...query, fields: Array.from(groups.values()),
    approvalState: query.kind === "company-overlay" ? "archived-reviewed-overlay" :
      query.kind === "indicator-overrides" ? "archived-approved-indicators" : "not-established-by-archive",
    disclosure: "Counts and content identities only; raw values, source text and licensed rows withheld",
    historicalBasis: "Revised-history inputs; archive time is not original publication vintage" };
}
