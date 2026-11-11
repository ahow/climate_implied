import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private bounded primary discovery only");
const out = "generated-artifacts/company-operating-corpus/fslr-grant-scope-v1/nee-related-followup";
mkdirSync(out, { recursive: true });
const receiptPath = `${out}/receipts.json`;
const book = existsSync(receiptPath) ? JSON.parse(readFileSync(receiptPath, "utf8")) : {
  version: "nee-related-source-followup-1", maximumLogicalRequests: 4, attempts: []
};
async function get(name: string, url: string, field: string) {
  if (book.attempts.length >= 4 || book.attempts.some((a: any) => a.url === url)) throw new Error("Bound4/no repeated requests");
  if (!["data.sec.gov", "www.sec.gov"].includes(new URL(url).hostname)) throw new Error("Official SEC only");
  const attemptedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" } });
    if (!["data.sec.gov", "www.sec.gov"].includes(new URL(response.url).hostname)) throw new Error("Unapproved redirect");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 20000000) throw new Error("20MB bound");
    const path = `${out}/${name}`; writeFileSync(path, bytes, { flag: "wx" });
    book.attempts.push({ url, field, attemptedAt, status: response.status, finalUrl: response.url, path,
      sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
    writeFileSync(receiptPath, JSON.stringify(book, null, 2) + "\n");
    if (!response.ok) throw new Error(`Primary source status${response.status}; no retry`);
    return bytes.toString("utf8");
  } catch (e) {
    if (!book.attempts.some((a: any) => a.url === url)) {
      book.attempts.push({ url, field, attemptedAt, error: String(e) });
      writeFileSync(receiptPath, JSON.stringify(book, null, 2) + "\n");
    }
    throw e;
  }
}
function findAnnual(recent: any) {
  const index = recent.form.findIndex((form: string, i: number) => form === "10-K" && recent.reportDate?.[i] === "2024-12-31");
  return index < 0 ? null : { accession: recent.accessionNumber[index], document: recent.primaryDocument[index], filed: recent.filingDate[index] };
}
async function main() {
  const subs = JSON.parse(await get("submissions.json", "https://data.sec.gov/submissions/CIK0001603145.json",
    "Authenticate candidate XPLR/NextEraEnergyPartners counterparty CIK; discover exactFY2024annual, direct NEEremittances/LLCfunding source"));
  if (Number(subs.cik) !== 1603145 || !/XPLR|NextEra Energy Partners/i.test(subs.name)) throw new Error("Candidate legal identity not authenticated; stop");
  let annual = findAnnual(subs.filings.recent);
  if (!annual) {
    const archive = subs.filings.files.find((f: any) => f.filingFrom <= "2025-03-01" && f.filingTo >= "2025-01-01");
    if (!archive || !/^[\w.-]+\.json$/.test(archive.name)) throw new Error("No declared matching historical submissions file");
    annual = findAnnual(JSON.parse(await get("historical-submissions.json", `https://data.sec.gov/submissions/${archive.name}`,
      "Declared historical submissions index for FY2024annual")));
  }
  if (!annual || !/^[\w.-]+\.htm$/.test(annual.document) || !/^\d{10}-\d{2}-\d{6}$/.test(annual.accession)) throw new Error("No exact declared annual");
  const url = `https://www.sec.gov/Archives/edgar/data/1603145/${annual.accession.replace(/-/g, "")}/${annual.document}`;
  await get("related-fy2024-10k.html", url, "Actual FY2024related issuer primary: direct NEEcash distributions/contributions, financing return/LLC priorities/flip dates");
  writeFileSync(`${out}/discovery.json`, JSON.stringify({ candidateIdentityAuthenticated: subs.name, cik: subs.cik, annual, url }, null, 2) + "\n");
  console.log(JSON.stringify({ status: "primary-annual-captured", legalIdentity: subs.name, filed: annual.filed, logicalRequests: book.attempts.length }));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
