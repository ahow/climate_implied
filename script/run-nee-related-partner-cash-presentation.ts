import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractNeeRelatedPartnerCashPresentation, reconcileNeeRelatedPartnerCash } from "../server/calculation/neeRelatedPartnerCashPresentation";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private retained primary only");
const sourceDir = "generated-artifacts/company-operating-corpus/fslr-grant-scope-v1/nee-related-followup";
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const sourcePath = `${sourceDir}/related-fy2024-10k.html`, receipts = JSON.parse(readFileSync(`${sourceDir}/receipts.json`, "utf8"));
for (const r of receipts.attempts) if (r.path) assert.equal(hash(r.path), r.sha256);
const failedFreeze = `${sourceDir}/2026-11-11T14-53-26-067Z/frozen-before-calculation.json`;
const failed = JSON.parse(readFileSync(failedFreeze, "utf8"));
for (const c of failed.code) assert.equal(hash(c.path), c.sha256, "Failedv1source/code preserved, not retuned");
const source = extractNeeRelatedPartnerCashPresentation(readFileSync(sourcePath, "utf8"));
const dir = `${sourceDir}/presentation-v2-${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(dir);
const freezePath = `${dir}/frozen-before-calculation.json`;
writeFileSync(freezePath, JSON.stringify({ version: source.version, frozenAt: new Date().toISOString(), source,
  sourcePath, sourceSha256: hash(sourcePath), receiptSha256: hash(`${sourceDir}/receipts.json`),
  sourceIdentityAndPublication: JSON.parse(readFileSync(`${sourceDir}/discovery.json`, "utf8")),
  failedV1FreezePreserved: { path: failedFreeze, sha256: hash(failedFreeze) },
  conditions: { newEconomicAssumptions: 0, visibleEquitySignsNotTaxonomySign: true,
    noNeeConsolidatedNciSubstitution: true, no811mSubsetAssumption: true,
    noEquityContributionAsCash: true, noOldFinancialKernel: true, ownerReview: "pending-not-requested" },
  code: ["server/calculation/neeRelatedPartnerCashPresentation.ts", "script/nee-related-partner-cash-presentation.test.ts",
    "script/run-nee-related-partner-cash-presentation.ts"].map(path => ({ path, sha256: hash(path) }))
}, null, 2) + "\n", { flag: "wx" });
const calculation = reconcileNeeRelatedPartnerCash(source), reportPath = `${dir}/report.json`;
writeFileSync(reportPath, JSON.stringify({ version: source.version, freezePath, freezeSha256: hash(freezePath), calculation,
  qualifiedOriginalIssuers: 0, newValuationOrRootAttempts: 0 }, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${sourceDir}/latest.json`, JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) }, null, 2) + "\n");
console.log(JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath), ...calculation }));
