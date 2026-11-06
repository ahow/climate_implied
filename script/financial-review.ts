/** Authorized workspace operator only; no public mutation or paid-provider proxy. */
import { readFile } from "node:fs/promises";
import { fmpRequest, figiRequest, assessMapping, type Profile } from "../server/financialData/provider";
import { acceptIdentity, reviewedIdentitySchema } from "../server/financialData/identity";
import { stageSnapshot, reviewSnapshot, listFinancialReviews } from "../server/financialData/reviewStore";
import { db } from "../server/db";
import { sql } from "drizzle-orm";
async function stageReviewedIdentity(value: unknown) {
    const review = reviewedIdentitySchema.parse(value);
    const [profiles, figis] = await Promise.all([
      fmpRequest("profile", { symbol: review.symbol }), figiRequest([review.isin]),
    ]);
    const identity = acceptIdentity(review, assessMapping(review.isin, profiles as unknown as Profile[], figis[0].data ?? []));
    const [[quote], [statement]] = await Promise.all([
      fmpRequest("quote", { symbol: identity.symbol }),
      fmpRequest("income-statement", { symbol: identity.symbol, period: "annual", limit: "1" }),
    ]);
    if (quote?.symbol !== identity.symbol || statement?.symbol !== identity.symbol || statement?.period !== "FY") {
      throw new Error("Provider returned the wrong symbol or non-annual earnings");
    }
    return stageSnapshot({ identity, quote: { price: quote.price, marketCap: quote.marketCap,
      observedAt: new Date(Number(quote.timestamp) * 1000).toISOString() },
      statement: { netIncome: statement.netIncome, currency: statement.reportedCurrency,
        period: statement.date, filingDate: statement.filingDate }, fetchedAt: new Date().toISOString() });
}
const [command, argument] = process.argv.slice(2);
try {
  if (command === "stage") {
    const id = await stageReviewedIdentity(JSON.parse(await readFile(argument, "utf8")));
    console.log(JSON.stringify({ id, action: "staged; review the API/UI before approval" }));
  } else if (command === "refresh-approved") {
    const approved = await db.execute(sql`SELECT payload->'identity' AS identity FROM financial_reviews WHERE status='approved' ORDER BY id`);
    let errors = 0;
    for (const row of approved.rows) {
      try {
        const id = await stageReviewedIdentity(row.identity);
        console.log(JSON.stringify({ id, action: "staged-refresh-not-auto-approved" }));
      } catch (error) {
        errors++;
        console.log(JSON.stringify({ action: "refresh-failed", error: error instanceof Error ? error.message : "Provider failure" }));
      }
      await new Promise(resolve => setTimeout(resolve, 2500));
    }
    console.log(JSON.stringify({ attempted: approved.rows.length, errors, schedulerChanged: false }));
    process.exit(errors ? 1 : 0);
  } else if (command === "approve" || command === "reject") {
    await reviewSnapshot(argument, command === "approve" ? "approved" : "rejected");
    console.log(JSON.stringify({ id: argument, action: command }));
  } else if (command === "list") console.log(JSON.stringify(await listFinancialReviews(), null, 2));
  else throw new Error("Usage: financial-review.ts stage <review.json> | approve <id> | reject <id> | list | refresh-approved");
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Financial review failed");
  process.exit(1);
}
