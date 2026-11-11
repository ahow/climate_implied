import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractFslrGrantScope, reconcileFslrGrantScope } from "../server/calculation/fslrGrantScopeBridge";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private retained-source calculation only");
const root = "generated-artifacts/company-operating-corpus", out = `${root}/fslr-grant-scope-v1`;
mkdirSync(out, { recursive: true });
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sourcePath = `${root}/issuer-cashflow-v1/FSLR-primary.html`;
const oldRoot = `${root}/fslr-cohort-integrated-v1/2026-11-11T13-46-14-298Z`;
const protectedArtifacts = [
  { path: `${oldRoot}/report.json`, sha256: "b7dddd17e1667a9f62b173fae225c9a4da320f9157c8e23385eb648297494982" },
  { path: `${oldRoot}/frozen-before-calculation.json`, sha256: "d9885a31f12d72528b72aff8b286262d94f0f350c91289e6b464ca36247bc735" },
  { path: "docs/fslr-cohort-integrated-evidence.json", sha256: "267ceeb4c823026fd5daa375528404427c3a03281b9cc3dc384846a36dad2867" }
];
for (const p of protectedArtifacts) assert.equal(hash(p.path), p.sha256);
const old = json(protectedArtifacts[0].path), captured = extractFslrGrantScope(readFileSync(sourcePath, "utf8"));
const receipts = { fiserv: 659700000, visa: 616000000 };
// Check the already authenticated source cohort fields, not an inferred receipt.
const oldFreeze = json(protectedArtifacts[1].path);
assert.equal(receipts.fiserv, oldFreeze.legacy.fiserv.cashUsd);
assert.equal(receipts.visa, oldFreeze.sourceFacts.transfers.find((t: any) => t.generationYear === 2024)
  .receipts.filter((r: any) => r.year === 2024).reduce((s: number, r: any) => s + r.cashUsd, 0));
const inputs = { captured, receipts };
const dir = `${out}/${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(dir);
const freezePath = `${dir}/frozen-before-calculation.json`;
writeFileSync(freezePath, JSON.stringify({
  version: "fslr-grant-scope-1", frozenAt: new Date().toISOString(), inputs, protectedArtifacts,
  sourcePath, sourceSha256: hash(sourcePath),
  code: ["server/calculation/fslrGrantScopeBridge.ts", "script/fslr-grant-scope.test.ts",
    "script/run-fslr-grant-scope.ts"].map(path => ({ path, sha256: hash(path) })),
  assumptions: { newEconomicOrCashAssumptions: 0, noAssetSupplementInstantReclassification: true,
    noAssetBenefitAsReceivableAssumption: true, noCashOrValuationAdjustment: true,
    noExactQ1DayInvented: true, noCompanyMaterialAssistanceCertification: true,
    ownerReview: "pending-not-requested", sourceFactsNotBackdated: true }
}, null, 2) + "\n", { flag: "wx" });
const calculation = reconcileFslrGrantScope(inputs.captured, inputs.receipts);
assert.equal(calculation.priorUnallocatedResidualUsd, old.history.unallocatedGrantBridgeResidualUsd);
assert.equal(calculation.priorBookCfoResidualUsd, old.history.cashflowVersusBookMovementUnattributedUsd);
const report = { version: captured.version, calculatedAt: new Date().toISOString(), freezePath, freezeSha256: hash(freezePath),
  calculation, protectedOriginalAnnualRows: old.cases.reduce((s: number, c: any) => s + c.annualRows.length, 0),
  originalReferenceDatePreserved: old.cases.every((c: any) => c.referenceDate === "2025-02-21"),
  conditionalWholeEquityResultsUnchanged: true, sourceScopeBridgeExecuted: true,
  cashFlowsChanged: false, oldKernelExecutions: 0, newRootAttempts: 0, qualifiedOriginalIssuers: 0 };
assert.equal(report.protectedOriginalAnnualRows, 32);
const reportPath = `${dir}/report.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${out}/latest.json`, JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) }, null, 2) + "\n");
console.log(JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath),
  ...calculation, protectedOriginalAnnualRows: 32, qualifiedOriginalIssuers: 0, oldKernelExecutions: 0 }));
