import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fmpRequest } from "../server/financialData/provider";
import { reviewedIdentitySchema } from "../server/financialData/identity";
import { normalizeStatementHistory } from "../server/financialData/statementHistory";
import { contentHash } from "../server/calculation/analysisManifest";
async function main() {
  const identity = reviewedIdentitySchema.parse(JSON.parse(await readFile(process.argv[2], "utf8")));
  if (!/^[A-Za-z0-9.-]{1,30}$/.test(identity.symbol)) throw new Error("Unsupported symbol");
  const [profile] = await fmpRequest("profile", { symbol: identity.symbol });
  if (!profile || profile.symbol !== identity.symbol || profile.isin !== identity.isin || profile.currency !== identity.currency)
    throw new Error("Current provider identity no longer matches reviewed identity");
  const [cashFlows, balanceSheets] = await Promise.all([
    fmpRequest("cash-flow-statement", { symbol: identity.symbol, period: "annual", limit: "20" }),
    fmpRequest("balance-sheet-statement", { symbol: identity.symbol, period: "annual", limit: "20" }),
  ]);
  const rows = normalizeStatementHistory(cashFlows, balanceSheets, identity.symbol, identity.currency);
  const payload = { identity, profile, cashFlows, balanceSheets };
  const report = { fetchedAt: new Date().toISOString(), inputHash: contentHash(payload), identity,
    rows, raw: { profile, cashFlows, balanceSheets }, approvedForCalculations: false,
    historyBasis: "revised-history", historicalPublicationVintages: "unavailable" };
  await mkdir("generated-artifacts/financial-data", { recursive: true });
  await writeFile(`generated-artifacts/financial-data/history-${identity.symbol}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ symbol: identity.symbol, periods: rows.length,
    componentReconciledPeriods: rows.filter(r => r.status === "components-reconciled-not-approved").length,
    positiveFcfePeriods: rows.filter(r => r.valuationEligible).length,
    pointInTimeEligible: false, approvedForCalculations: false }));
}
main().catch(() => { console.error("Financial history collection unavailable or failed validation; no approval or historical inputs changed."); process.exitCode = 1; });
