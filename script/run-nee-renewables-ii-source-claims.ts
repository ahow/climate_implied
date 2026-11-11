import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { renewablesIiAvailableCashClaim } from "../server/calculation/neeRenewablesIiCashClaims";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private actual contract source only");
const base = "generated-artifacts/company-operating-corpus/fslr-grant-scope-v1/nee-related-followup";
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const receipts = JSON.parse(readFileSync(`${base}/declared-llc/receipts.json`, "utf8"));
assert.equal(receipts.attempts.length, 2);
for (const r of receipts.attempts) { assert.equal(r.status, 200); assert.equal(hash(r.path), r.sha256); }
const plain = (p: string) => readFileSync(p, "utf8").replace(/<[^>]*>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const renew = plain(receipts.attempts[0].path), genesis = plain(receipts.attempts[1].path);
for (const clause of ["XPLR RENEWABLES II, LLC", "February 17, 2025", "Flip Date means June 11, 2025",
  "5.01 Monthly Cash Distributions", "forty percent (40%)", "twenty-five percent (25%)", "8.32%", "9.32%"])
  assert.ok(renew.includes(clause), `Actual RenewablesIIclause ${clause}`);
for (const clause of ["GENESIS SOLAR HOLDINGS, LLC", "February 17, 2025", "Flip Date means December 18, 2030",
  "6.76%", "9.75%", "eighty-five percent (85%)", "thirty-five percent (35%)"])
  assert.ok(genesis.includes(clause), `Actual Genesisclause ${clause}`);
const annualPath = `${base}/related-fy2024-10k.html`, annual = plain(annualPath);
assert.ok(annual.includes("brings the total buyout to date to 30 % of the originally issued Class B membership interests"));
const dir = `${base}/llc-claims-${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(dir);
const frozen = {
  version: "nee-renewables-ii-source-claims-1", frozenAt: new Date().toISOString(),
  sourceFiles: receipts.attempts.map((r: any) => ({ path: r.path, sha256: r.sha256, url: r.url })),
  annual: { path: annualPath, sha256: hash(annualPath) },
  source: { observedEnd2024RenewablesIiBuyoutFraction: .3, contractualFlipDate: "2025-06-11",
    postFlipClassAFraction: .01, postFlipClassBFraction: .99, diversionFraction: .4, diversionCapOfClassBCash: .25 },
  conditions: { modelClassBOwnershipEqualsSourceCumulativeBuyoutFraction: true,
    retentionNoTransfersOrFurtherBuyoutAssumedNotObserved: true, actualClassBUnitsStillHeldNotCertified: true,
    unmodelledSection701ExceptionAssumedFalse: true, legalDistributabilityConditionalTrue: true,
    normalizedAvailableCashUsd: 1, normalizedDollarIsNotObservedCash: true,
    actualAvailableCashUsd: null, fullCfoOrProjectEbitdaNotSubstitute: true, noNeeCommonCashAllocation: true,
    noFullTaxCallLiquidationWaterfallClaim: true, revisedHistoryAfterNee20250131: true },
  code: ["server/calculation/neeRenewablesIiCashClaims.ts", "script/nee-renewables-ii-cash-claims.test.ts",
    "script/run-nee-renewables-ii-source-claims.ts"].map(path => ({ path, sha256: hash(path) }))
};
const freezePath = `${dir}/frozen-before-calculation.json`;
writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
const input = { availableCashUsd: 1, classBFractionHeldByXplr: .3, section701ExceptionApplies: false, legallyDistributable: true };
const pre = renewablesIiAvailableCashClaim({ ...input, period: "pre-flip-restored-95-percent" });
const post = renewablesIiAvailableCashClaim({ ...input, period: "post-flip" });
const unknown = renewablesIiAvailableCashClaim({ ...input, availableCashUsd: null, period: "post-flip" });
const report = { version: frozen.version, freezePath, freezeSha256: hash(freezePath), pre, post, unknown,
  actualAvailableCashOrCommonFcfeComputed: false, originalQualifiedIssuers: 0, financialGridOrRootAttempts: 0, oldKernelsExecuted: 0 };
const reportPath = `${dir}/report.json`; writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${base}/llc-claims-latest.json`, JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) }, null, 2) + "\n");
console.log(JSON.stringify({ version: frozen.version, freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath),
  normalizedNotObservedAvailableDollar: 1, preXplrClaim: pre.xplrCashUsd, postXplrClaim: post.xplrCashUsd,
  missingCashStatus: unknown.status, originalQualifiedIssuers: 0, actualAvailableCashComputed: false }));
