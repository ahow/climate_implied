import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractNeeParentEntityCrosswalk, reconcileNeeParentEntityCrosswalk } from "../server/calculation/neeParentEntityCrosswalk";
import { extractFslrAsc832Quarter, reconcileFslrAsc832Quarter } from "../server/calculation/fslrAsc832ProgrammeQuarter";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private primary-only source component");
const root = "generated-artifacts/company-operating-corpus", dir = `${root}/nee-parent-crosswalk-v1`;
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
function main() {
  const receipts = json(`${dir}/receipts.json`); assert.equal(receipts.attempts.length, 3);
  for (const r of receipts.attempts) { assert.equal(r.status, 200); assert.equal(hash(r.path), r.sha256); }
  const prior = json(`${root}/issuer-attachment-followup-v1/latest.json`);
  assert.equal(prior.freezeSha256, "1ae19c89a7ea41a8755044b4a889b23a1311719188add4029fb62664d0160c0e");
  assert.equal(hash(prior.freezePath), prior.freezeSha256); assert.equal(hash(prior.reportPath), prior.reportSha256);
  const priorFreeze = json(prior.freezePath), priorReport = json(prior.reportPath);
  const xplr = priorFreeze.sourceReceipts.find((r: any) => r.name === "xplr-fy2025-10k.html");
  const q3book = json(`${root}/issuer-cash-collections-v1/receipts.json`);
  const q3 = q3book.attempts.find((r: any) => r.name === "fslr-2026q3.html");
  assert.ok(xplr); assert.ok(q3);
  for (const r of [xplr, q3]) assert.equal(hash(r.path), r.sha256);
  const parentSource = extractNeeParentEntityCrosswalk(read(`${dir}/nee-fy2025-10k.html`),
    read(`${dir}/nee-fy2025-subsidiaries.html`), read(xplr.path), read(`${dir}/xplr-neer-cscs-2025-ex106.html`));
  const quarterSource = extractFslrAsc832Quarter(read(q3.path)), h = priorFreeze.fslrSource.interim2026h1;
  const firstHalf = { firstHalfExpenseBenefitsUsd: h.incomeGrants, firstHalfGrantCfoEffectUsd: h.grantCfoEffect,
    firstHalfClosingAllGrantReceivablesUsd: h.closingGrantReceivables,
    openingAllGrantReceivablesUsd: priorFreeze.fslrSource.annual2025.closingGrantReceivables,
    selectedPriorCreditCashCollectedFirstHalfUsd: priorFreeze.selectedCash.interim2026h1, indiaFirstReceiptMonth: h.indiaFirstReceiptMonth };
  const counterparty = { renewablesIiBuyoutUsd: priorReport.nee.actualRenewablesIiRemainingBuyoutUsd,
    pipelinesBuyoutUsd: priorReport.nee.actualPipelinesRemainingBuyoutUsd,
    categoryDistributionsUsd: priorReport.nee.neeCategoryDistributions2025Usd,
    contributionEquityMovementUsd: priorReport.nee.neeCategoryContributionEquityMovement2025Usd };
  const preserve = [{ path: prior.freezePath, sha256: prior.freezeSha256 }, { path: prior.reportPath, sha256: prior.reportSha256 },
    { path: "docs/issuer-attachment-grant-evidence.json", sha256: "175399ec91baca924d730627f760747e8bb9b44e169a5b6ec59134be6fb8e868" }];
  for (const p of [...preserve, ...priorFreeze.preserve]) assert.equal(hash(p.path), p.sha256);
  const out = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(out);
  writeFileSync(`${dir}/source-sealed.json`, JSON.stringify({ logicalRequests: 3, maximumLogicalRequests: 4, receiptsSha256: hash(`${dir}/receipts.json`) }, null, 2) + "\n", { flag: "wx" });
  const freezePath = `${out}/frozen-before-calculation.json`;
  const frozen = { version: "nee-parent-fslr-programme-1", frozenAt: new Date().toISOString(), preserve,
    primary: [...receipts.attempts, xplr, q3], parentSource, quarterSource, firstHalf, counterparty,
    conditions: { newFutureEconomicAssumptions: 0, noCrossEntityCashInsertion: true, noServiceCostMinusBookAsCash: true,
      noOwnershipPercentCashMultiplier: true, noAwardInstantAsCashOrRecognitionPeriod: true, noForcedIndiaCash: true,
      preserveOriginal32RowsAndNegativeCases: true, revisedHistoryOnly: true, ownerReview: "pending-not-requested" },
    code: ["server/calculation/neeParentEntityCrosswalk.ts", "server/calculation/fslrAsc832ProgrammeQuarter.ts",
      "script/nee-parent-fslr-programme.test.ts", "script/run-nee-parent-fslr-programme.ts",
      "server/calculation/issuerAttachmentGrantInputs.ts"].map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
  const nee = reconcileNeeParentEntityCrosswalk(frozen.parentSource, frozen.counterparty);
  const fslr = reconcileFslrAsc832Quarter(frozen.quarterSource, frozen.firstHalf);
  const report = { version: frozen.version, freezePath, freezeSha256: hash(freezePath), nee, fslr,
    newSourceRequests: 3, repeatedInventoryOrReportingWorkbookRequests: 0, financialGridOrOldKernelExecutions: 0,
    original32RowsChanged: false, qualifiedOriginalIssuers: 0, ownerReview: "pending-not-requested" };
  const reportPath = `${out}/report.json`; writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  writeFileSync(`${dir}/latest.json`, JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) }, null, 2) + "\n");
  console.log(JSON.stringify({ freezeSha256: hash(freezePath), reportSha256: hash(reportPath), nee, fslr, qualifiedOriginalIssuers: 0 }));
}
try { main(); } catch (e) { console.error(String(e)); process.exitCode = 1; }
