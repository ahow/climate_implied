import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = "generated-artifacts/company-operating-corpus/xom-climate-liability-v1/sources";
const receiptPath = `${dir}/receipts.json`;
const args = process.argv.slice(2);
if (!args.includes("--private-primary") || process.env.NODE_ENV === "production")
  throw new Error("Private primary capture only; no production invocation");
mkdirSync(dir, { recursive: true });
const priorDiscovery = [
  ["https://www.gov.uk/government/publications/uk-emissions-trading-scheme-verified-emissions-and-free-allocation-2024", 404],
  ["https://www.gov.uk/government/publications/uk-emissions-trading-scheme-verified-emissions-and-free-allocation-2023", 404],
  ["https://www.gov.uk/api/search.json?q=UK%20ETS%20verified%20emissions%202024&count=5", 200],
  ["https://www.gov.uk/api/search.json?q=%22UK%20ETS%22%20%22verified%20emissions%22&count=8", 200],
  ["https://www.gov.uk/api/search.json?q=%22UK%20ETS%22%20%222024%22%20%22report%22&count=8", 200],
  ["https://www.gov.uk/government/publications/participating-in-the-uk-ets", 200],
  ["https://www.gov.uk/government/collections/uk-emissions-trading-scheme-uk-ets-reports-and-scheme-reviews", 200],
  ["https://reports.view-emissions-trading-registry.service.gov.uk/ets-reports.html", 200],
  ["https://www.gov.uk/government/publications/uk-ets-allocation-table-for-operators-of-installations", 200],
  ["https://www.gov.uk/government/publications/uk-emissions-trading-scheme-regulator-reports", 200],
  ["https://reports.view-emissions-trading-registry.service.gov.uk/ets-reports.html", 200],
  ["https://reports.view-emissions-trading-registry.service.gov.uk/assets/js/sections.js", 200],
].map(([url, status]) => ({ url, status, purpose: "bounded discovery only", bytesNotRetained: true, exactTimestampNotRetained: true }));
const receipts: any = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) :
  { maximumLogicalPublicGetAttempts: 24, priorDiscovery, captures: [] };
const allowed = new Set(["reports.view-emissions-trading-registry.service.gov.uk", "assets.publishing.service.gov.uk",
  "www.gov.uk", "www.sec.gov", "www.legislation.gov.uk"]);
async function capture(name: string, url: string) {
  if (!/^[a-zA-Z0-9_.-]+$/.test(name) || !allowed.has(new URL(url).hostname)) throw new Error("Bounded primary source name/host required");
  if (receipts.captures.some((r: any) => r.name === name)) throw new Error("Refusing source recapture");
  if (receipts.priorDiscovery.length + receipts.captures.length >= receipts.maximumLogicalPublicGetAttempts)
    throw new Error("Bounded 24 public GET budget exhausted");
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" } });
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 15000000) throw new Error("Bounded source payload too large");
    const path = `${dir}/${name}`;
    writeFileSync(path, bytes, { flag: "wx" });
    const receipt = { name, url, finalUrl: response.url, attemptedAt, status: response.status,
      path, bytes: bytes.length, contentType: response.headers.get("content-type"),
      sha256: createHash("sha256").update(bytes).digest("hex") };
    receipts.captures.push(receipt);
    console.log(JSON.stringify({ name, status: receipt.status, bytes: receipt.bytes }));
  } catch (error) {
    receipts.captures.push({ name, url, attemptedAt, error: error instanceof Error ? error.message : "Public GET failed" });
  }
  writeFileSync(receiptPath, JSON.stringify(receipts, null, 2) + "\n");
}
async function main() {
  const at = args.indexOf("--one");
  if (at >= 0) {
    if (!args[at + 1] || !args[at + 2]) throw new Error("--one requires filename and exact discovered URL");
    await capture(args[at + 1], args[at + 2]);
  } else if (args.includes("--registry-sections")) {
    for (let i = 1; i <= 8; i++) await capture(`registry-section-${i}.html`,
      `https://reports.view-emissions-trading-registry.service.gov.uk/ets-reports/section${i}/section${i}.html`);
  } else throw new Error("Explicit bounded capture mode required");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
