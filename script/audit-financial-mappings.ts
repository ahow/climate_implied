/**
 * Operator-only read-only pilot. Never called by a public route.
 * Does not overwrite issuer, financial, emissions or return-index records.
 */
import { db } from "../server/db";
import { cvCompanies } from "../shared/schema";
import { fmpRequest, figiRequest, assessMapping, type Profile } from "../server/financialData/provider";
import { mkdir, writeFile, readFile, rename } from "node:fs/promises";
import { validIsin } from "../server/financialData/isin";
const limit = Number(process.argv[2] ?? 10);
if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("Limit must be 1–10000");
const companies = await db.select().from(cvCompanies).orderBy(cvCompanies.id);
const path = "generated-artifacts/financial-data/mapping-audit.json";
await mkdir("generated-artifacts/financial-data", { recursive: true });
let results: Array<any> = [];
try { results = JSON.parse(await readFile(path, "utf8")).results; }
catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
// Resume verified candidates; retry errors, and never retain removed/changed inputs.
results = results.filter(r => r.status !== "error" && companies.some(c => c.id === r.companyId && c.isin === r.isin));
const done = new Set(results.map(r => r.companyId));
let consecutiveErrors = 0;
async function save() {
  const counts = Object.fromEntries([...new Set(results.map(r => r.status))].map(s => [s, results.filter(r => r.status === s).length]));
  const report = { createdAt: new Date().toISOString(), universe: companies.length, attempted: results.length,
    notAttempted: companies.length - results.length, approvalCoverage: "Use financial-coverage.ts; candidates are not approvals", counts,
    status: "candidate-evidence-not-approved-identities", results };
  await writeFile(path + ".tmp", JSON.stringify(report, null, 2)); await rename(path + ".tmp", path);
  return report;
}
for (const company of companies.filter(c => !done.has(c.id)).slice(0, limit)) {
  if (!validIsin(company.isin)) {
    results.push({ companyId: company.id, isin: company.isin, status: "invalid-identifier" });
    await save(); continue;
  }
  try {
    const [figi] = await figiRequest([company.isin]);
    if (figi.error) throw new Error("OpenFIGI job failed");
    const search = await fmpRequest("search-isin", { isin: company.isin });
    // Bound each issuer to five profiles; never silently select among omitted listings.
    if (search.length > 5) {
      results.push({ companyId: company.id, isin: company.isin, status: "ambiguous", reason: "More than five listings; review required" });
    } else {
      const profiles = [];
      for (const record of search) {
        if (typeof record.symbol !== "string") continue;
        const [profile] = await fmpRequest("profile", { symbol: record.symbol });
        if (profile) profiles.push(profile as unknown as Profile);
        await new Promise(resolve => setTimeout(resolve, 350));
      }
      results.push({ companyId: company.id, ...assessMapping(company.isin, profiles, figi.data ?? []) });
    }
    consecutiveErrors = 0;
  } catch (error) {
    consecutiveErrors++;
    results.push({ companyId: company.id, isin: company.isin, status: "error",
      reason: error instanceof Error ? error.message : "Provider request failed" });
  }
  await save();
  if (consecutiveErrors >= 3) break; // Provider outage/quota: checkpoint rather than hammering it.
  // Unauthenticated OpenFIGI request limit. No retries that amplify quota failures.
  await new Promise(resolve => setTimeout(resolve, 2500));
}
const report = await save();
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
process.exit(0);
