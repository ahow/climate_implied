import { bindTrackBAdmission } from "@shared/trackBAdmissionContract";
import { trackBPublicCatalogSchema, type TrackBPublicPin } from "@shared/trackBDisclosureContract";

export function trackBReportUrl(pin: TrackBPublicPin, suffix = "") {
  return `/api/research/track-b-admission${suffix}?${new URLSearchParams({
    protocolHash: pin.protocolHash, reportHash: pin.reportHash, disclosureHash: pin.disclosureHash,
  })}`;
}
async function read(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(typeof body?.error === "string" ? body.error : `Public Track B read failed (${response.status})`);
  }
  return response.json();
}
export async function fetchTrackBCatalog(fetcher: typeof fetch = fetch) {
  return trackBPublicCatalogSchema.parse(await read(await fetcher("/api/research/track-b-admission/catalog")));
}
// Same finite canonical JSON rules as the server; browser crypto verifies the
// bytes represented by each selected report/domain, not only claimed headers.
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype)
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  throw new Error("Public report has noncanonical input");
}
async function hash(value: unknown) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)))))
    .map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function fetchTrackBReport(pin: TrackBPublicPin, fetcher: typeof fetch = fetch) {
  const response = await fetcher(trackBReportUrl(pin)), value = await read(response);
  const report = bindTrackBAdmission(value).report;
  const identities = { reportHash: "X-Track-B-Report-SHA256", disclosureHash: "X-Track-B-Disclosure-SHA256",
    pipelineResultHash: "X-Track-B-Pipeline-SHA256", periodDomainHash: "X-Track-B-Period-Domain-SHA256" } as const;
  for (const [key, header] of Object.entries(identities))
    if (response.headers.get(header) !== pin[key as keyof typeof identities]) throw new Error("Public report selection/header identity mismatch");
  if (report.protocolHash !== pin.protocolHash || await hash(report) !== pin.reportHash ||
    await hash(report.periods.map(p => ({ specification: p.specification, origin: p.origin, informationCutoff: p.informationCutoff,
      executionAt: p.executionAt, endAt: p.endAt }))) !== pin.periodDomainHash)
    throw new Error("Public report protocol/content/origin/specification/cutoff identity mismatch");
  return report;
}
