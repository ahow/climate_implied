import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private bounded official primary retrieval only");
const dir = "generated-artifacts/company-operating-corpus/issuer-attachment-followup-v1";
mkdirSync(dir, { recursive: true });
const bookPath = `${dir}/receipts.json`, book = existsSync(bookPath) ? JSON.parse(readFileSync(bookPath, "utf8")) :
  { version: "issuer-attachment-followup-1", maximumLogicalRequests: 12, attempts: [] };
const at = process.argv.indexOf("--one"), name = process.argv[at + 1], url = process.argv[at + 2], field = process.argv[at + 3];
if (at < 0 || !/^[\w.-]+$/.test(name) || !field || !["www.sec.gov", "data.sec.gov"].includes(new URL(url).hostname))
  throw new Error("Explicit official URL/name/field required");
if (book.attempts.length >= 12 || book.attempts.some((r: any) => r.url === url)) throw new Error("Bound12/no repeat request");
async function main() {
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" } });
    if (!["www.sec.gov", "data.sec.gov"].includes(new URL(response.url).hostname)) throw new Error("Nonofficial redirect");
    const bytes = Buffer.from(await response.arrayBuffer()); if (bytes.length > 20000000) throw new Error("20MB ceiling");
    const path = `${dir}/${name}`; writeFileSync(path, bytes, { flag: "wx" });
    book.attempts.push({ url, name, field, attemptedAt, capturedAt: new Date().toISOString(), status: response.status, finalUrl: response.url,
      contentType: response.headers.get("content-type"), path, bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex") });
  } catch (e) { book.attempts.push({ url, name, field, attemptedAt, error: String(e) }); }
  writeFileSync(bookPath, JSON.stringify(book, null, 2) + "\n");
  const r = book.attempts[book.attempts.length - 1];
  console.log(JSON.stringify({ name: r.name, status: r.status ?? "error", field: r.field, sha256: r.sha256, logicalRequests: book.attempts.length }));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
