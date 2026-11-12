import { withDownloadManifest } from "@shared/serverDownloadRegistry";
import React, { useState } from "react";
import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { z } from "zod";

type ReviewView = {
  classification: string; revision: string | null; sourceId: string | null;
  proposals: { id: string; status: string; sourceId: string; note: string;
    source: { publisher: string; sourceUrl: string; sampling?: { method: string; evidence: string };
      series: { indicatorKey: string; unit: string; points: { year: number; state: string; value: number | null; reason?: string; limit?: number; operator?: string; draws?: { id: string; value: number }[] }[] }[] } }[];
  events: { id: string; action: string; sequence: number }[];
  cells: { indicatorKey: string; year: number; unit: string; state: string; value: number | null;
    reason?: string; limit?: number; operator?: string;
    result: { value: number | null; reason: string; infilled: boolean; samples: { id: string; value: number }[] } }[];
};
const sha = z.string().regex(/^[a-f0-9]{64}$/);
const drawSchema = z.object({ id: z.string().min(1), value: z.number().finite() });
const pointSchema = z.object({
  year: z.number().int(), state: z.enum(["observed", "unavailable", "not-applicable", "below-threshold"]),
  value: z.number().finite().nullable(), reason: z.string().optional(), limit: z.number().finite().optional(),
  operator: z.literal("<").optional(), draws: z.array(drawSchema).optional(),
});
function validPoint(point: z.infer<typeof pointSchema>, ctx: z.RefinementCtx) {
  if (point.state === "observed" ? point.value === null : point.value !== null)
    ctx.addIssue({ code: "custom", message: "Source-state/value mismatch" });
  if (point.state === "below-threshold" && (point.limit === undefined || point.operator === undefined))
    ctx.addIssue({ code: "custom", message: "Source bound missing" });
  if (point.state === "unavailable" && !["blank", "provider-null", "not-returned"].includes(point.reason ?? ""))
    ctx.addIssue({ code: "custom", message: "Original unavailable qualifier missing or unknown" });
  if (["not-applicable", "below-threshold"].includes(point.state) && !point.reason?.trim())
    ctx.addIssue({ code: "custom", message: "Source qualifier reason missing" });
  if (point.state !== "observed" && point.draws !== undefined)
    ctx.addIssue({ code: "custom", message: "No fabricated source draws on unmeasured cells" });
}
const reviewViewSchema = z.object({
  version: z.literal("qualified-development-view-1"),
  classification: z.literal("development-only-not-scientific-approval"), centralModelApplied: z.literal(false),
  revision: sha.nullable(), sourceId: sha.nullable(),
  events: z.array(z.object({ id: sha, action: z.enum(["stage", "approve", "reject"]), sequence: z.number().int().positive() })),
  proposals: z.array(z.object({ id: sha, sourceId: sha,
    status: z.enum(["pending", "rejected", "approved-development-only", "superseded"]), note: z.string(),
    source: z.object({ publisher: z.string().min(1), sourceUrl: z.string().url(),
      sampling: z.object({ method: z.string().min(1), evidence: z.string().min(1) }).optional(),
      series: z.array(z.object({ indicatorKey: z.string().min(1), unit: z.string().min(1),
        points: z.array(pointSchema.superRefine(validPoint)) })),
    }),
  })),
  cells: z.array(pointSchema.extend({ indicatorKey: z.string().min(1), unit: z.string().min(1),
    result: z.object({ value: z.number().finite().nullable(), reason: z.string().min(1),
      infilled: z.boolean(), samples: z.array(drawSchema) }),
  }).superRefine((cell, ctx) => {
    validPoint(cell, ctx);
    if (cell.result.infilled && (cell.state !== "unavailable" || cell.reason !== "blank" ||
        cell.result.value === null || cell.result.samples.length < 2) ||
        !cell.result.infilled && (cell.state === "observed" ? cell.result.value !== cell.value : cell.result.value !== null) ||
        !cell.result.infilled && cell.result.samples.length > 0)
      ctx.addIssue({ code: "custom", message: "Calculation contradicts original source state or sampled interior-only rule" });
  })),
}).superRefine((view, ctx) => {
  if (view.sourceId !== null && view.revision === null)
    ctx.addIssue({ code: "custom", message: "Reviewed source lacks exact review revision" });
  if (view.sourceId === null && view.cells.length)
    ctx.addIssue({ code: "custom", message: "Unidentified source cells refused" });
});
/** Mount only in the development UI. No writes or central-model approval claims. */
export function QualifiedMissingnessReview() {
  const [revision, setRevision] = useState("");
  const url = `/api/development/qualified-missingness${revision ? `?revision=${revision}` : ""}`;
  const query = useQuery<ReviewView>({
    queryKey: [url], retry: false,
    queryFn: async () => {
      const response = await fetch(url);
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? body?.error ?? `Development archive unavailable (${response.status})`);
      }
      return response.json();
    },
  });
  const valid = query.data === undefined ? undefined : reviewViewSchema.safeParse(query.data);
  const data = valid?.success && (!revision || valid.data.revision === revision) ? valid.data : undefined;
  return <section aria-label="Development qualified missingness review" className="space-y-4 rounded border p-4">
    <h2 className="text-lg font-semibold">Qualified missing-data review — DEVELOPMENT ONLY</h2>
    <p>Private file review, not scientific acceptance or central-model approval. Source qualifiers are never zero-filled.
      Only source-paired draws at original interior blanks may be propagated. Decisions use the private operator CLI.</p>
    {query.isLoading && <p>Loading development archive…</p>}
    {query.error && <p role="alert">{query.error.message}</p>}
    {query.data !== undefined && !query.error && !data &&
      <p role="alert">Development review unavailable: missing, invalid or mismatched source/review evidence. Values and downloads withheld; no approval inferred.</p>}
    {data && !query.error && <>
      <label>Review revision <select value={revision} onChange={event => setRevision(event.target.value)} className="border p-1">
        <option value="">Latest</option>
        {data.events.map(event => <option key={event.id} value={event.id}>{event.sequence}: {event.action} — {event.id.slice(0, 12)}</option>)}
      </select></label>
      <p className="break-all">Selected revision: {data.revision ?? "No reviews"}<br />
        Source SHA256: {data.sourceId ?? "No approved development source"}</p>
      {!data.events.length && <p>No retained development reviews. No approved source or calculated values are inferred.</p>}
      {!data.cells.length && <p>No reviewed source cells at this revision. Calculations remain unavailable.</p>}
      <ul>{data.proposals.map(proposal => <li key={proposal.id} className="break-all">
        {proposal.id.slice(0, 12)} — {proposal.status} — {proposal.note}
        <details><summary>Inspect original proposed source (not central-model input)</summary>
          <p>{proposal.source.publisher} — {proposal.source.sourceUrl}</p>
          <p>Sampling declaration: {proposal.source.sampling ?
            `${proposal.source.sampling.method}: ${proposal.source.sampling.evidence}` : "No source-supported sampled uncertainty supplied"}</p>
          <ul>{proposal.source.series.flatMap(series => series.points.map(point => <li key={`${series.indicatorKey}:${point.year}`}>
            {series.indicatorKey} / {point.year}: {point.state} — {point.value === null ? "No measured value" : String(point.value)} {series.unit}
            {point.reason ? `; ${point.reason}` : ""}{point.limit !== undefined ? `; bound ${point.operator} ${point.limit}` : ""}
            {point.draws ? `; source draws ${point.draws.map(draw => `${draw.id}=${draw.value}`).join(", ")}` : ""}
          </li>))}</ul>
        </details>
      </li>)}</ul>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr>{["Indicator / year", "Source state", "Original", "Calculation", "Uncertainty / refusal"].map(text => <th key={text} className="p-2">{text}</th>)}</tr></thead>
        <tbody>{data.cells.map(cell => <tr key={`${cell.indicatorKey}:${cell.year}`} className="border-t">
          <td className="p-2">{cell.indicatorKey} / {cell.year} ({cell.unit})</td>
          <td className="p-2">{cell.state}{cell.reason ? `: ${cell.reason}` : ""}</td>
          <td className="p-2">{cell.value === null ? cell.state === "below-threshold" ? `${cell.operator} ${cell.limit} (bound only)` : "No measured value" : String(cell.value)}</td>
          <td className="p-2">{cell.result.value === null ? "Withheld" : `${cell.result.value}${cell.result.infilled ? " (interior infill)" : " (observed)"}`}</td>
          <td className="p-2">{cell.result.reason}{cell.result.samples.length > 0 && `; ${cell.result.samples.length} source-paired draws`}</td>
        </tr>)}</tbody>
      </table></div>
      {data.sourceId && <a className="underline" href={withDownloadManifest(`/api/development/qualified-missingness/export?revision=${data.revision}`)}>Download selected review XLSX</a>}
    </>}
  </section>;
}
