/** Authorized workspace operator only; no public mutation or paid-provider proxy. */
import { readFile } from "node:fs/promises";
import { fmpRequest, figiRequest, assessMapping, type Profile } from "../server/financialData/provider";
import { acceptIdentity, reviewedIdentitySchema } from "../server/financialData/identity";
import { stageSnapshot, reviewSnapshot, listFinancialReviews } from "../server/financialData/reviewStore";
const [command, argument] = process.argv.slice(2);
try {
  if (command === "stage") {
    const review = reviewedIdentitySchema.parse(JSON.parse(await readFile(argument, "utf8")));
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
    const id = await stageSnapshot({ identity, quote: { price: quote.price, marketCap: quote.marketCap,
      observedAt: new Date(Number(quote.timestamp) * 1000).toISOString() },
      statement: { netIncome: statement.netIncome, currency: statement.reportedCurrency,
        period: statement.date, filingDate: statement.filingDate }, fetchedAt: new Date().toISOString() });
    console.log(JSON.stringify({ id, action: "staged; review the API/UI before approval" }));
  } else if (command === "approve" || command === "reject") {
    await reviewSnapshot(argument, command === "approve" ? "approved" : "rejected");
    console.log(JSON.stringify({ id: argument, action: command }));
  } else if (command === "list") console.log(JSON.stringify(await listFinancialReviews(), null, 2));
  else throw new Error("Usage: financial-review.ts stage <review.json> | approve <id> | reject <id> | list");
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : "Financial review failed");
  process.exit(1);
}
