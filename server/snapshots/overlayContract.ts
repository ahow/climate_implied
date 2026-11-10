import { z } from "zod";
import type { CvCompany, CvTimeSeries } from "../../shared/schema";
import { contentHash } from "../calculation/analysisManifest";

const fieldUnits: Record<string, [string, string]> = {
  marketCap: ["financial", "USD million"], netProfit: ["financial", "USD million"],
  priceEarnings: ["financial", "ratio"], totalReturnIndex: ["financial", "index"],
  scope1Emissions: ["carbon", "tCO2e"], scope2Emissions: ["carbon", "tCO2e"],
  scope3Emissions: ["carbon", "tCO2e"], sdgAlignmentScore: ["sdg", "score"],
};
const entry = z.object({
  companyId: z.number().int().positive(), observationDate: z.string().date(),
  availableAt: z.string().date(), field: z.string(), value: z.number().finite().nullable(),
  kind: z.enum(["financial", "carbon", "sdg"]), unit: z.string(),
  source: z.string().min(1), approvalEvidence: z.string().min(1),
  historyBasis: z.literal("revised-history"),
}).strict().superRefine((e, ctx) => {
  const expected = fieldUnits[e.field];
  if (!expected || expected[0] !== e.kind || expected[1] !== e.unit)
    ctx.addIssue({ code: "custom", message: "Unsupported overlay field, kind or unit" });
  if (e.availableAt < e.observationDate)
    ctx.addIssue({ code: "custom", message: "Availability precedes observation" });
  if (e.kind === "carbon" && e.value !== null && e.value < 0)
    ctx.addIssue({ code: "custom", message: "Negative emissions unavailable" });
});
const schema = z.object({ version: z.literal("company-overlay-1"), entries: z.array(entry).min(1) }).strict();
export type CompanyOverlay = z.infer<typeof schema>;
export function packOverlay(input: unknown) {
  const entries = z.array(entry).min(1).parse(input).sort((a, b) =>
    a.companyId - b.companyId || a.observationDate.localeCompare(b.observationDate) || a.field.localeCompare(b.field));
  const keys = entries.map(e => `${e.companyId}:${e.observationDate}:${e.field}`);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate overlay cell");
  const payload = schema.parse({ version: "company-overlay-1", entries });
  return { id: contentHash(payload), payload };
}
export function unpackOverlay(id: string, input: unknown) {
  const payload = schema.parse(input);
  const packed = packOverlay(payload.entries);
  if (packed.id !== id) throw new Error("Overlay content hash mismatch");
  return packed.payload;
}
export function applyOverlays(
  baseline: { companies: CvCompany[]; timeSeries: CvTimeSeries[] },
  overlays: CompanyOverlay[], cutoff: string,
) {
  z.string().date().parse(cutoff);
  const companies = baseline.companies.map(c => ({ ...c }));
  const timeSeries = baseline.timeSeries.map(r => ({ ...r, date: new Date(r.date) }));
  const companyMap = new Map(companies.map(c => [c.id, c]));
  const observations = new Map(timeSeries.map(r => [`${r.companyId}:${r.date.toISOString().slice(0, 10)}`, r]));
  for (const overlay of overlays) for (const e of schema.parse(overlay).entries) {
    if (e.availableAt > cutoff) throw new Error("Overlay availability exceeds cutoff");
    const company = companyMap.get(e.companyId);
    if (!company) throw new Error("Orphan overlay company");
    // SDG is current static metadata in the existing engine. Never use this
    // contract to certify point-in-time SDG histories or enable SDG backtests.
    const target = e.kind === "sdg" ? company : observations.get(`${e.companyId}:${e.observationDate}`);
    if (!target) throw new Error("Overlay observation is absent from baseline");
    (target as unknown as Record<string, unknown>)[e.field] = e.value;
  }
  return { companies, timeSeries };
}
