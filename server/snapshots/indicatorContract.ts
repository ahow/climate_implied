import { z } from "zod";
import { contentHash } from "../calculation/analysisManifest";
import type { OverrideRow } from "../dataIngestion/requestOverrides";

const rowSchema = z.object({
  indicatorKey: z.string().min(1), year: z.number().int(),
  value: z.number().finite(), source: z.string().min(1), method: z.string().min(1),
  sourceUrl: z.string().nullable().optional(), asOfDate: z.string().nullable().optional(),
});
export function packIndicators(input: OverrideRow[]) {
  const rows = input.map(r => rowSchema.parse(r)).map(r => ({
    ...r, sourceUrl: r.sourceUrl ?? null, asOfDate: r.asOfDate ?? null,
  })).sort((a, b) => a.indicatorKey.localeCompare(b.indicatorKey) || a.year - b.year);
  if (new Set(rows.map(r => `${r.indicatorKey}:${r.year}`)).size !== rows.length)
    throw new Error("Duplicate indicator/year");
  // Same identity used by request isolation; administrative fields excluded.
  return { id: contentHash(rows), payload: { version: "indicator-snapshot-1" as const, rows } };
}
export function unpackIndicators(id: string, input: unknown): OverrideRow[] {
  const payload = z.object({ version: z.literal("indicator-snapshot-1"), rows: z.array(rowSchema) }).strict().parse(input);
  const packed = packIndicators(payload.rows);
  if (packed.id !== id) throw new Error("Indicator snapshot content hash mismatch");
  return packed.payload.rows;
}
