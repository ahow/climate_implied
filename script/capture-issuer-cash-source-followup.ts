import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private source acquisition only");
const dir = "generated-artifacts/company-operating-corpus/issuer-cash-source-followup-v1";
mkdirSync(dir, { recursive: true });
const path = `${dir}/receipts.json`;
const book = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { version: "issuer-cash-source-followup-1", maximumLogicalRequests: 6, attempts: [] };
const i = process.argv.indexOf("--one"), name = process.argv[i + 1], url = process.argv[i + 2], field = process.argv[i + 3];
if (i < 0 || !/^[\w.-]+$/.test(name) || !field || new URL(url).hostname !== "www.sec.gov") throw new Error("Explicit declared SEC URL/name/field required");
if (existsSync(`${dir}/source-sealed.json`) || book.attempts.length >= 6 || book.attempts.some((a: any) => a.url === url)) throw new Error("Sealed, duplicate or exhausted source bound");
async function main() {
  const attemptedAt = new Date().toISOString();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" } });
    if (new URL(r.url).hostname !== "www.sec.gov") throw new Error("Unofficial redirect refused");
    const bytes = Buffer.from(await r.arrayBuffer()); if (bytes.length > 20000000) throw new Error("20MB bound");
    const artifactPath = `${dir}/${name}`; writeFileSync(artifactPath, bytes, { flag: "wx" });
    book.attempts.push({ name, url, field, attemptedAt, capturedAt: new Date().toISOString(), status: r.status, finalUrl: r.url,
      path: artifactPath, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
  } catch (e) { book.attempts.push({ name, url, field, attemptedAt, error: String(e) }); }
  writeFileSync(path, JSON.stringify(book, null, 2) + "\n"); console.log(JSON.stringify(book.attempts[book.attempts.length - 1]));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
