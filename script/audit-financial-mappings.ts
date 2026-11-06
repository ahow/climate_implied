/**
 * Operator-only read-only pilot. Never called by a public route.
 * Does not overwrite issuer, financial, emissions or return-index records.
 */
import { db } from "../server/db";
import { cvCompanies } from "../shared/schema";
import { fmpRequest, figiRequest, assessMapping, type Profile } from "../server/financialData/provider";
import { mkdir, writeFile } from "node:fs/promises";
const limit = Number(process.argv[2] ?? 10);
if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("Pilot limit must be 1–50");
const companies = await db.select().from(cvCompanies).orderBy(cvCompanies.id);
const results = [];
for (const company of companies.slice(0, limit)) {
  try {
    const [figi] = await figiRequest([company.isin]);
    if (figi.error) throw new Error("OpenFIGI job failed");
    const search = await fmpRequest("search-isin", { isin: company.isin });
    // Bound each issuer to five profiles; never silently select among omitted listings.
    if (search.length > 5) {
      results.push({ companyId: company.id, status: "ambiguous", reason: "More than five listings; review required" });
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
  } catch (error) {
    results.push({ companyId: company.id, status: "error",
      reason: error instanceof Error ? error.message : "Provider request failed" });
  }
  // Unauthenticated OpenFIGI request limit. No retries that amplify quota failures.
  await new Promise(resolve => setTimeout(resolve, 2500));
}
const counts = Object.fromEntries([...new Set(results.map(r => r.status))].map(s =>
  [s, results.filter(r => r.status === s).length]));
const report = { createdAt: new Date().toISOString(), universe: companies.length,
  attempted: results.length, notAttempted: companies.length - results.length,
  accepted: 0, counts, status: "diagnostic-pilot-not-95-percent-coverage", results };
await mkdir("generated-artifacts/financial-data", { recursive: true });
await writeFile("generated-artifacts/financial-data/mapping-audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, results: undefined }, null, 2));
process.exit(0);
