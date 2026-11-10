/** Bounded authorized source investigation. Does not approve or join issuers. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fmpRequest } from "../server/financialData/provider";
import { contentHash } from "../server/calculation/analysisManifest";
if (process.env.NODE_ENV === "production") throw new Error("Private development source attempt only");
const path = process.argv[2];
if (!path?.startsWith("generated-artifacts/return-quality/") || !path.endsWith("-sample.json") || path.includes(".."))
  throw new Error("Explicit retained private sample required");
const sample = JSON.parse(readFileSync(path, "utf8"));
const protocol = JSON.parse(readFileSync("docs/Return_Quality_Protocol.json", "utf8"));
if (sample.protocolHash !== contentHash(protocol) || sample.sample.length !== 50) throw new Error("Frozen sample mismatch");
const resultPath = path.replace("-sample.json", "-identity-attempt.json");
if (existsSync(resultPath)) throw new Error("Attempt retained; no automatic retry");
const identifiers: string[] = Array.from(new Set<string>(sample.sample.map((r: { isin: string }) => r.isin))).sort();
if (identifiers.length > 50 || identifiers.some(i => !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(i))) throw new Error("Invalid bounded identity plan");
const results: unknown[] = [];
let stopped = false, attempted = 0, matched = 0;
for (const isin of identifiers) {
  if (stopped) { results.push({ isin, status: "not-attempted-after-provider-refusal" }); continue; }
  attempted++;
  try {
    const rows = await fmpRequest("search-isin", { isin });
    const candidates = rows.filter(r => r.isin === isin).map(r => ({
      isin, symbol: r.symbol ?? null, name: r.name ?? null, exchange: r.exchangeShortName ?? r.exchange ?? null,
      currency: r.currency ?? null,
    }));
    if (candidates.length) matched++;
    results.push({ isin, status: candidates.length ? "candidate-only-not-identity-approval" : "no-exact-ISIN-candidate",
      capturedAt: new Date().toISOString(), normalizedResponseHash: contentHash(rows), candidates,
      originUri: "https://financialmodelingprep.com/stable/search-isin", historicalIdentityVerified: false });
  } catch (e) {
    const message = (e as Error).message;
    const safe = /^FMP HTTP \d{3}$/.test(message) ? message : "Provider request unavailable; details withheld";
    stopped = /403|429/.test(safe) || message === "FMP credential is not configured";
    results.push({ isin, status: safe, capturedAt: new Date().toISOString() });
  }
}
const result = { protocolHash: sample.protocolHash, sampleHash: contentHash(sample), executedAt: new Date().toISOString(),
  attempted, uniqueSampledIsins: identifiers.length, exactIsinCandidates: matched, results,
  requestedObservations: 50, computedReturns: 0, unavailableReturns: 50,
  numericalBreakRate: null, materialBreakRate: null, approvals: 0,
  remaining: "Candidate ISIN matches do not establish original common-share/listing/currency identity. Exact dated prices, dividends, splits and share-basis coverage remain required. No sample replacement or current price substitution.",
  sourceScope: "Current normalized provider identity response, not an original-vintage assertion; private and not redistributed." };
writeFileSync(resultPath, JSON.stringify(result, null, 2), { flag: "wx" });
console.log(JSON.stringify({ protocolHash: sample.protocolHash, attempted, uniqueSampledIsins: identifiers.length,
  exactIsinCandidates: matched, computedReturns: 0, unavailableReturns: 50, approvals: 0,
  resultHash: contentHash(JSON.parse(readFileSync(resultPath, "utf8"))), resultPath }));
