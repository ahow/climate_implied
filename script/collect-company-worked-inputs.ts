/** Fixed, small research collection. Never approves identity or changes app data. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../server/db";
import { cvCompanies, cvTimeSeries } from "../shared/schema";
import { fmpRequest } from "../server/financialData/provider";
import { contentHash } from "../server/calculation/analysisManifest";

const defaultCases = [
  { symbol: "NEE", isin: "US65339F1012", sector: "utility" },
  { symbol: "XOM", isin: "US30231G1022", sector: "oil-and-gas" },
  { symbol: "CAT", isin: "US1491231015", sector: "industrial" },
  { symbol: "CVX", isin: "US1667641005", sector: "oil-and-gas" },
];
async function main() {
  const folder = "generated-artifacts/company-worked-inputs";
  await mkdir(folder, { recursive: true });
  let failed = false;
  const args = process.argv.slice(2);
  let cases = defaultCases;
  let requested = args;
  if (args[0] === "--manifest") {
    if (args.length !== 2 || !resolve(args[1]).startsWith(resolve("generated-artifacts") + "/"))
      throw new Error("Use a private generated-artifacts selection manifest only");
    cases = z.array(z.object({
      symbol: z.string().regex(/^[A-Z][A-Z0-9.]{0,9}$/),
      isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/),
      sector: z.string().min(1),
    }).strict()).min(1).max(8).parse(JSON.parse(await readFile(args[1], "utf8")));
    if (new Set(cases.map(c => c.symbol)).size !== cases.length ||
      new Set(cases.map(c => c.isin)).size !== cases.length) throw new Error("Duplicate research issuer");
    requested = [];
  }
  if (requested.some(s => !cases.some(c => c.symbol === s))) throw new Error("Unknown fixed research case");
  for (const item of cases.filter(c => !requested.length || requested.includes(c.symbol))) {
    let stage = "workbook lookup";
    try {
      const [company] = await db.select().from(cvCompanies).where(eq(cvCompanies.isin, item.isin));
      if (!company) throw new Error("Company missing from source workbook");
      const observations = await db.select().from(cvTimeSeries).where(eq(cvTimeSeries.companyId, company.id))
        .orderBy(desc(cvTimeSeries.date));
      stage = "provider profile retrieval";
      const [profile] = await fmpRequest("profile", { symbol: item.symbol });
      stage = "exact ISIN, currency and listing checks";
      if (!profile || profile.isin !== item.isin || profile.symbol !== item.symbol || profile.currency !== "USD" ||
        profile.isAdr !== false || profile.isActivelyTrading !== true) {
        const evidence = { expected: item, profile: profile ?? null, status: "identity-rejected-not-approved" };
        await mkdir(`${folder}/rejected`, { recursive: true });
        try {
          await writeFile(`${folder}/rejected/${item.symbol}-${contentHash(evidence)}.json`,
            JSON.stringify(evidence), { flag: "wx" });
        } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
        throw new Error("Provider identity mismatch");
      }
      const statements: Record<string, unknown> = {};
      // Sequential requests bound provider load. Preserve complete raw responses privately.
      for (const endpoint of ["income-statement", "cash-flow-statement", "balance-sheet-statement"]) {
        stage = endpoint;
        statements[endpoint] = await fmpRequest(endpoint, { symbol: item.symbol, period: "annual", limit: "10" });
      }
      stage = "immutable local research storage";
      const payload = JSON.parse(JSON.stringify({ selection: item, company, observations, profile, statements }));
      const inputHash = contentHash(payload);
      const report = { inputHash, fetchedAt: new Date().toISOString(), payload,
        identityStatus: "exact-ISIN-provider-candidate-not-independent-approval",
        historyBasis: "revised-history", approvedForCalculations: false };
      const file = `${folder}/${item.symbol}-${inputHash}.json`;
      try { await writeFile(file, JSON.stringify(report), { flag: "wx" }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      console.log(JSON.stringify({ symbol: item.symbol, file, inputHash, observations: observations.length }));
    } catch {
      failed = true;
      console.error(JSON.stringify({ symbol: item.symbol, status: "unavailable",
        reason: `Failed at ${stage}; no approval created` }));
    }
  }
  process.exit(failed ? 1 : 0);
}
main().catch(() => { console.error("Worked-input collection failed"); process.exit(1); });
