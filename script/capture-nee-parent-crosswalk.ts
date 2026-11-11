import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private official source retrieval only");
const dir = "generated-artifacts/company-operating-corpus/nee-parent-crosswalk-v1";
mkdirSync(dir, { recursive: true });
const bookPath = `${dir}/receipts.json`, book = existsSync(bookPath) ? JSON.parse(readFileSync(bookPath, "utf8")) :
  { version: "nee-parent-crosswalk-1", maximumLogicalRequests: 4, attempts: [] };
const i = process.argv.indexOf("--one"), name = process.argv[i + 1], url = process.argv[i + 2], field = process.argv[i + 3];
if (i < 0 || !/^[\w.-]+$/.test(name) || !field || !["www.sec.gov", "data.sec.gov"].includes(new URL(url).hostname)) throw new Error("Explicit official name/URL/field required");
if (existsSync(`${dir}/source-sealed.json`) || book.attempts.length >= 4 || book.attempts.some((r: any) => r.url === url))
  throw new Error("Sealed source book or four unique logical requests maximum");
async function main() {
  const attemptedAt = new Date().toISOString();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" } });
    if (!["www.sec.gov", "data.sec.gov"].includes(new URL(r.url).hostname)) throw new Error("Unofficial redirect refused");
    const bytes = Buffer.from(await r.arrayBuffer()); if (bytes.length > 20000000) throw new Error("20MB bound");
    const path = `${dir}/${name}`; writeFileSync(path, bytes, { flag: "wx" });
    book.attempts.push({ name, url, field, attemptedAt, capturedAt: new Date().toISOString(), status: r.status, finalUrl: r.url,
      path, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  } catch (e) { book.attempts.push({ name, url, field, attemptedAt, error: String(e) }); }
  writeFileSync(bookPath, JSON.stringify(book, null, 2) + "\n");
  const a = book.attempts[book.attempts.length - 1]; console.log(JSON.stringify({ name, status: a.status ?? "error", sha256: a.sha256, requests: book.attempts.length }));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
