import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private primary source acquisition only");
const dir = "generated-artifacts/company-operating-corpus/enlink-operating-successor-v1";
mkdirSync(dir, { recursive: true });
const path = `${dir}/receipts.json`;
const book = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { version: "enlink-operating-successor-1", maximumLogicalRequests: 4, attempts: [] };
const i = process.argv.indexOf("--one"), name = process.argv[i + 1], url = process.argv[i + 2], provenance = process.argv[i + 3];
if (i < 0 || !/^[\w.-]+$/.test(name) || !provenance || !["www.sec.gov", "data.sec.gov"].includes(new URL(url).hostname)) throw new Error("Exact authenticated official filename/URL/discovery required");
if (existsSync(`${dir}/source-sealed.json`) || book.attempts.length >= 4 || book.attempts.some((a: any) => a.url === url)) throw new Error("Sealed, duplicate or exhausted bound");
async function main() {
  const attemptedAt = new Date().toISOString();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" } });
    if (!["www.sec.gov", "data.sec.gov"].includes(new URL(r.url).hostname)) throw new Error("Unofficial redirect refused");
    const bytes = Buffer.from(await r.arrayBuffer()); if (bytes.length > 20000000) throw new Error("20MB bound");
    const artifactPath = `${dir}/${name}`; writeFileSync(artifactPath, bytes, { flag: "wx" });
    book.attempts.push({ name, url, provenance, attemptedAt, capturedAt: new Date().toISOString(), status: r.status, finalUrl: r.url,
      path: artifactPath, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  } catch (e) { book.attempts.push({ name, url, provenance, attemptedAt, error: String(e) }); }
  writeFileSync(path, JSON.stringify(book, null, 2) + "\n"); console.log(JSON.stringify(book.attempts[book.attempts.length - 1]));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
