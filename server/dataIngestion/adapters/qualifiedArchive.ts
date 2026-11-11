import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { z } from "zod";
import XLSX from "xlsx";
import { INDICATORS } from "../indicatorRegistry";

const draw = z.object({ id: z.string().min(1), value: z.number().finite() }).strict();
const point = z.discriminatedUnion("state", [
  z.object({ year: z.number().int(), state: z.literal("observed"), value: z.number().finite(),
    draws: z.array(draw).min(2).optional() }).strict(),
  z.object({ year: z.number().int(), state: z.literal("unavailable"), value: z.null(),
    reason: z.enum(["blank", "provider-null", "not-returned"]) }).strict(),
  z.object({ year: z.number().int(), state: z.literal("not-applicable"), value: z.null(),
    reason: z.string().min(1) }).strict(),
  z.object({ year: z.number().int(), state: z.literal("below-threshold"), value: z.null(),
    operator: z.literal("<"), limit: z.number().finite(), reason: z.string().min(1) }).strict(),
]);
const archiveSchema = z.object({
  version: z.literal("qualified-indicator-source-v1"),
  publisher: z.string().min(1), sourceUrl: z.string().url().startsWith("https://"),
  sampling: z.object({ method: z.literal("paired-source-draw-linear-interior"),
    evidence: z.string().min(1), sourceUrl: z.string().url().startsWith("https://") }).strict().optional(),
  series: z.array(z.object({ indicatorKey: z.string(), unit: z.string().min(1),
    points: z.array(point).min(1) }).strict()).min(1),
}).strict();
export type QualifiedIndicatorArchive = ReturnType<typeof readQualifiedIndicatorArchive>;
const loadedArchives = new WeakSet<object>();
function freeze(value: object) {
  Object.values(value).forEach(child => { if (child && typeof child === "object") freeze(child); });
  return Object.freeze(value);
}
/** Read-only adapter for explicit source declarations. Not part of automated
 * collection or approval. No ambiguous token is inferred to be a qualifier.
 */
export function readQualifiedIndicatorArchive(path: string) {
  const bytes = readFileSync(path);
  const sourceId = createHash("sha256").update(bytes).digest("hex");
  const source = archiveSchema.parse(JSON.parse(bytes.toString("utf8")));
  const keys = new Set<string>();
  for (const series of source.series) {
    if (keys.has(series.indicatorKey)) throw new Error("Duplicate source indicator series");
    keys.add(series.indicatorKey);
    const registered = INDICATORS.find(indicator => indicator.key === series.indicatorKey);
    if (!registered || registered.unit !== series.unit) throw new Error("Unknown indicator or mismatched source unit");
    if (new Set(series.points.map(p => p.year)).size !== series.points.length) throw new Error("Duplicate source years");
    for (const p of series.points) if (p.state === "observed" && p.draws &&
      new Set(p.draws.map(d => d.id)).size !== p.draws.length) throw new Error("Duplicate source sample IDs");
  }
  const input = { sourceId, source };
  freeze(input);
  loadedArchives.add(input);
  return input;
}
export function interpolateQualifiedIndicator(input: QualifiedIndicatorArchive, indicatorKey: string, year: number) {
  if (!loadedArchives.has(input)) throw new Error("Actual immutable source-adapter result required");
  if (!Number.isInteger(year)) throw new Error("Integer target year required");
  const seriesIndex = input.source.series.findIndex(s => s.indicatorKey === indicatorKey);
  if (seriesIndex < 0) throw new Error("Unknown source indicator selection");
  const series = input.source.series[seriesIndex];
  const at = (index: number) => ({ sourceId: input.sourceId, locator: `/series/${seriesIndex}/points/${index}/value` });
  const index = series.points.findIndex(p => p.year === year);
  const target = series.points[index];
  const refuse = (reason: string) => ({ value: null, infilled: false as const, reason,
    original: index < 0 ? null : at(index), samples: [], evidenceState: "unavailable" as const });
  if (!target) return refuse("original-source-cell-not-present");
  if (target.state === "observed") return { value: target.value, infilled: false as const, reason: "observed",
    original: at(index), samples: [], evidenceState: "source-supplied-not-approved" as const };
  if (target.state !== "unavailable" || target.reason !== "blank")
    return refuse(`source-${target.state === "unavailable" ? target.reason : target.state}-is-not-an-original-blank`);
  const donors = series.points.map((p, i) => ({ p, i })).filter(d => d.p.state === "observed")
    .sort((a, b) => a.p.year - b.p.year);
  const left = donors.filter(d => d.p.year < year).pop(), right = donors.find(d => d.p.year > year);
  if (!left || !right) return refuse("no-extrapolation");
  if (left.p.state !== "observed" || right.p.state !== "observed") throw new Error("Invalid donor state");
  if (!input.source.sampling || !left.p.draws || !right.p.draws)
    return refuse("source-supported-sampled-uncertainty-unavailable");
  const rightDraws = new Map(right.p.draws.map((d, i) => [d.id, { ...d, index: i }]));
  if (left.p.draws.length !== right.p.draws.length || left.p.draws.some(d => !rightDraws.has(d.id)))
    return refuse("source-paired-sample-identity-mismatch");
  const weight = (year - left.p.year) / (right.p.year - left.p.year);
  const samples = left.p.draws.map((d, i) => {
    const r = rightDraws.get(d.id)!;
    const value = d.value + (r.value - d.value) * weight;
    if (!Number.isFinite(value)) throw new Error("Nonfinite source-supported sample interpolation");
    return { id: d.id, value,
      left: { sourceId: input.sourceId, locator: `/series/${seriesIndex}/points/${left.i}/draws/${i}/value` },
      right: { sourceId: input.sourceId, locator: `/series/${seriesIndex}/points/${right.i}/draws/${r.index}/value` } };
  });
  const value = left.p.value + (right.p.value - left.p.value) * weight;
  if (!Number.isFinite(value)) throw new Error("Nonfinite source-value interpolation");
  return { value, infilled: true as const, reason: "paired-source-draw-linear-interior",
    original: at(index), originalValue: null, donors: [at(left.i), at(right.i)],
    donorYears: [left.p.year, right.p.year], weight, samples,
    methodSource: { sourceId: input.sourceId, locator: "/sampling" },
    uncertainty: "Only supplied paired draws propagated; no distribution fitted or invented",
    evidenceState: "source-supplied-not-approved" as const };
}
/** Actual XLSX export preserves qualifiers, bounds, original blank and every
 * supplied sample's source locator. Never emits an approved central estimate.
 */
export function exportQualifiedIndicators(input: QualifiedIndicatorArchive) {
  if (!loadedArchives.has(input)) throw new Error("Actual immutable source-adapter result required");
  const sourceRows: Record<string, unknown>[] = [], sourceSamples: Record<string, unknown>[] = [],
    results: Record<string, unknown>[] = [], samples: Record<string, unknown>[] = [];
  input.source.series.forEach((series, si) => series.points.forEach((p, pi) => {
    const result = interpolateQualifiedIndicator(input, series.indicatorKey, p.year);
    sourceRows.push({ sourceId: input.sourceId, locator: `/series/${si}/points/${pi}/value`,
      indicatorKey: series.indicatorKey, year: p.year, unit: series.unit, state: p.state, originalValue: p.value,
      reason: "reason" in p ? p.reason : null, operator: "operator" in p ? p.operator : null, limit: "limit" in p ? p.limit : null });
    if (p.state === "observed") p.draws?.forEach((draw, di) => sourceSamples.push({
      sourceId: input.sourceId, locator: `/series/${si}/points/${pi}/draws/${di}/value`,
      indicatorKey: series.indicatorKey, year: p.year, id: draw.id, value: draw.value,
    }));
    results.push({ indicatorKey: series.indicatorKey, year: p.year, value: result.value,
      infilled: result.infilled, reason: result.reason, evidenceState: result.evidenceState,
      original: JSON.stringify(result.original), donors: "donors" in result ? JSON.stringify(result.donors) : null,
      methodSource: "methodSource" in result ? JSON.stringify(result.methodSource) : null,
      weight: "weight" in result ? result.weight : null });
    result.samples.forEach(sample => samples.push({ indicatorKey: series.indicatorKey, year: p.year,
      id: sample.id, value: sample.value, original: JSON.stringify(result.original),
      left: JSON.stringify(sample.left), right: JSON.stringify(sample.right),
      methodSource: "methodSource" in result ? JSON.stringify(result.methodSource) : null }));
  }));
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of [
    ["Identity", [{ sourceId: input.sourceId, publisher: input.source.publisher, sourceUrl: input.source.sourceUrl,
      samplingMethod: input.source.sampling?.method ?? null, samplingEvidence: input.source.sampling?.evidence ?? null,
      samplingSourceUrl: input.source.sampling?.sourceUrl ?? null,
      approval: "not-approved; source declarations and sampling evidence not independently verified" }]],
    ["SourceCells", sourceRows], ["SourceSamples", sourceSamples], ["Results", results], ["SampleLineage", samples],
  ] as const) XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([...rows]), name);
  return workbook;
}
