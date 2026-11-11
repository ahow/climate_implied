import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private official declared LLCsource only");
const base = "generated-artifacts/company-operating-corpus/fslr-grant-scope-v1/nee-related-followup";
const discovery = JSON.parse(readFileSync(`${base}/discovery.json`, "utf8"));
const html = readFileSync(`${base}/related-fy2024-10k.html`, "utf8");
const oldReceipts = JSON.parse(readFileSync(`${base}/receipts.json`, "utf8"));
if (oldReceipts.attempts.length !== 2) throw new Error("Original related-issuer discovery bound changed");
const dir = `${base}/declared-llc`; mkdirSync(dir, { recursive: true });
if (existsSync(`${dir}/receipts.json`)) throw new Error("No repeat of declared LLCrequests");
const book: { version: string; maximumNewRequests: number; originalDiscoveryRequests: number; attempts: any[] } =
  { version: "nee-declared-llc-source-1", maximumNewRequests: 2, originalDiscoveryRequests: 2, attempts: [] };
async function main() {
  for (const [filename, field] of [
    ["xplr-q42024xex1016.htm", "RenewablesIIactual LLCdistribution/priority/target-return/buyout source"],
    ["xplr-q42024xex1018.htm", "GenesisSolarHoldingsactual LLCdistribution/priority/target-return/buyout source"]
  ]) {
    if (!html.includes(`href="${filename}"`)) throw new Error("LLCattachment not actually declared by primary annual");
    const url = new URL(filename, discovery.url).href, attemptedAt = new Date().toISOString();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" } });
      if (new URL(response.url).hostname !== "www.sec.gov") throw new Error("Non SECredirect");
      const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > 20000000) throw new Error("20MB ceiling");
      const path = `${dir}/${filename}`; writeFileSync(path, bytes, { flag: "wx" });
      book.attempts.push({ url, field, attemptedAt, status: response.status, finalUrl: response.url, path,
        bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
      if (!response.ok) console.error(`Primary source status${response.status}; no retry`);
    } catch (e) { book.attempts.push({ url, field, attemptedAt, error: String(e) }); }
    writeFileSync(`${dir}/receipts.json`, JSON.stringify(book, null, 2) + "\n");
  }
  console.log(JSON.stringify({ declaredLlcAttempts: book.attempts.length, totalLogicalRequestsAcrossBothBooks: 2 + book.attempts.length,
    statuses: book.attempts.map(a => a.status ?? "error"), priorReceiptBookUnchanged: true }));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
