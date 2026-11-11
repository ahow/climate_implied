import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractNeeRelatedPartnerCash, reconcileNeeRelatedPartnerCash } from "../server/calculation/neeRelatedPartnerCash";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private retained primary only");
const sourceDir = "generated-artifacts/company-operating-corpus/fslr-grant-scope-v1/nee-related-followup";
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const sourcePath = `${sourceDir}/related-fy2024-10k.html`, receipts = JSON.parse(readFileSync(`${sourceDir}/receipts.json`, "utf8"));
for (const r of receipts.attempts) if (r.path) assert.equal(hash(r.path), r.sha256);
const source = extractNeeRelatedPartnerCash(readFileSync(sourcePath, "utf8"));
const dir = `${sourceDir}/${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(dir);
const freezePath = `${dir}/frozen-before-calculation.json`;
writeFileSync(freezePath, JSON.stringify({ version: source.version, frozenAt: new Date().toISOString(), source,
  sourcePath, sourceSha256: hash(sourcePath), receiptSha256: hash(`${sourceDir}/receipts.json`),
  sourceIdentityAndPublication: JSON.parse(readFileSync(`${sourceDir}/discovery.json`, "utf8")),
  conditions: { newFutureAssumptions: 0, noNeeConsolidatedNciSubstitution: true, no811mSubsetAssumption: true,
    noEquityContributionsTreatedAsCash: true, noOldKernelExecution: true, ownerReview: "pending-not-requested" },
  code: ["server/calculation/neeRelatedPartnerCash.ts", "script/nee-related-partner-cash.test.ts", "script/run-nee-related-partner-cash.ts"]
    .map(path => ({ path, sha256: hash(path) }))
}, null, 2) + "\n", { flag: "wx" });
const calculation = reconcileNeeRelatedPartnerCash(source), reportPath = `${dir}/report.json`;
writeFileSync(reportPath, JSON.stringify({ version: source.version, freezePath, freezeSha256: hash(freezePath), calculation,
  qualifiedOriginalIssuers: 0, newValuationOrRootAttempts: 0 }, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${sourceDir}/latest.json`, JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) }, null, 2) + "\n");
console.log(JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath), ...calculation }));
