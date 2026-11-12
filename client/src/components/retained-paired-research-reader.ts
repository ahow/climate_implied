import {
  retainedPairedCatalogSchema, retainedPairedPinSchema, retainedPairedReportSchema,
  type RetainedPairedPin, type RetainedPairedReport,
} from "./retained-paired-research-contract";

export const RETAINED_PAIRED_REPORT_ENDPOINT = "/api/research/paired-research";

export function retainedPairedReportUrl(pin: RetainedPairedPin) {
  return `${RETAINED_PAIRED_REPORT_ENDPOINT}?${new URLSearchParams(retainedPairedPinSchema.parse(pin))}`;
}

async function responseBody(response: Response) {
  const value = await response.json().catch(() => {
    throw new Error(`Retained paired-research response is not valid JSON (${response.status}).`);
  });
  if (!response.ok) {
    throw new Error(typeof value?.error === "string" ? value.error :
      `Retained paired-research read failed (${response.status}); no replacement report returned.`);
  }
  return value;
}

/** Canonical finite JSON, matching analysisManifest.contentHash on the server. */
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  throw new Error("Retained report contains noncanonical values; results withheld.");
}

export async function retainedPairedContentHash(value: unknown) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, "0")).join("");
}

export async function fetchRetainedPairedCatalog(fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const value = await responseBody(await fetcher(`${RETAINED_PAIRED_REPORT_ENDPOINT}/catalog`, {
    credentials: "include", signal, cache: "no-store",
  }));
  const parsed = retainedPairedCatalogSchema.safeParse(value);
  if (!parsed.success) throw new Error("Retained paired-research catalog failed its public contract; no selection available.");
  const keys = parsed.data.reports.map(pin => JSON.stringify(pin));
  if (new Set(keys).size !== keys.length) throw new Error("Retained paired-research catalog contains duplicate exact selections.");
  return parsed.data;
}

/**
 * Validate response header bindings and recompute public content/context hashes.
 * This authenticates the exact selected bytes, not the underlying scientific data.
 * Authorization and source permissions remain exclusively server responsibilities.
 */
export async function verifyRetainedPairedReport(
  input: unknown, selected: RetainedPairedPin, headers: Headers,
): Promise<RetainedPairedReport> {
  const pin = retainedPairedPinSchema.parse(selected);
  const parsed = retainedPairedReportSchema.safeParse(input);
  if (!parsed.success) throw new Error("Retained paired-research report failed its public contract; results withheld.");
  const report = parsed.data;
  for (const [key, value] of Object.entries(pin)) {
    const header = `X-Paired-Research-${key.replace(/Hash$/, "").replace(/[A-Z]/g, char => `-${char.toLowerCase()}`)}-SHA256`;
    if (headers.get(header) !== value) throw new Error(`Retained paired-research ${key} header does not match the exact selected identity.`);
  }
  if (report.protocolHash !== pin.protocolHash || report.pipelineResultHash !== pin.pipelineResultHash ||
    report.corpusHash !== pin.corpusHash) {
    throw new Error("Retained paired-research protocol/pipeline/corpus selection mismatch; results withheld.");
  }
  const actual = await Promise.all([
    retainedPairedContentHash(report), retainedPairedContentHash(report.originDomain),
    retainedPairedContentHash(report.sourceContext), retainedPairedContentHash(report.codeContext),
  ]);
  if (actual.some((value, index) => value !== [
    pin.reportHash, pin.originDomainHash, pin.sourceContextHash, pin.codeContextHash,
  ][index])) throw new Error("Retained paired-research content/origin/source/code context hash mismatch; results withheld.");
  return report;
}

export async function fetchRetainedPairedReport(
  pin: RetainedPairedPin, fetcher: typeof fetch = fetch, signal?: AbortSignal,
) {
  const response = await fetcher(retainedPairedReportUrl(pin), {
    credentials: "include", signal, cache: "no-store",
  });
  return verifyRetainedPairedReport(await responseBody(response), pin, response.headers);
}
