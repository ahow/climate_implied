import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractBorrowedCashPerimeter, reconcileBorrowedCashPerimeter } from "../server/calculation/neeBorrowedCashPerimeter";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private source perimeter calculation only");
const dir = "generated-artifacts/company-operating-corpus/issuer-cash-source-followup-v1";
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
try {
  const prior = json(`${dir}/latest.json`), oldFreeze = json(prior.freezePath);
  assert.equal(hash(prior.freezePath), "d909c66d7148d3efe721413f77d34838773b909db6e6b8a291247e4aa7a18e27");
  assert.equal(hash(prior.reportPath), "3d544e2f1c45e87f91c07ed8278f7c8d3b7c6ceff01b6a08c71592a220f664f2");
  const paths = ["generated-artifacts/company-operating-corpus/issuer-cashflow-v1/NEE-primary.html",
    `${dir}/nee-2025q3.html`, "generated-artifacts/company-operating-corpus/nee-parent-crosswalk-v1/nee-fy2025-10k.html"];
  const source = { opening: extractBorrowedCashPerimeter(read(paths[0])), september: extractBorrowedCashPerimeter(read(paths[1])),
    closing: extractBorrowedCashPerimeter(read(paths[2])), reportedAnnualBroaderSweepFinancingCashUsd: oldFreeze.annual.neeBroaderRelatedSweepFinancingCashUsd,
    reportedYtdBroaderSweepFinancingCashUsd: oldFreeze.quarter.neeYtdBroaderRelatedSweepFinancingCashUsd,
    reportedXplrAnnualNetInvestingCashUsd: oldFreeze.annual.xplrNetCscsInvestingCashUsd };
  const out = `${dir}/borrowed-${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(out);
  const freezePath = `${out}/frozen-before-calculation.json`;
  const freeze = { version: "nee-borrowed-cash-perimeter-1", source, primary: paths.map(path => ({ path, sha256: hash(path) })),
    frozenAt: new Date().toISOString(), noNewFutureEconomicAssumptions: true, noReceivableCashInferenceOrGrossSettlementClaim: true,
    preserve: [{ path: prior.freezePath, sha256: hash(prior.freezePath) }, { path: prior.reportPath, sha256: hash(prior.reportPath) }],
    code: ["server/calculation/neeBorrowedCashPerimeter.ts", "script/nee-borrowed-cash-perimeter.test.ts",
      "script/run-nee-borrowed-cash-perimeter.ts"].map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(freezePath, JSON.stringify(freeze, null, 2) + "\n", { flag: "wx" });
  const result = reconcileBorrowedCashPerimeter(freeze.source), reportPath = `${out}/report.json`;
  writeFileSync(reportPath, JSON.stringify({ version: freeze.version, freezeSha256: hash(freezePath), result,
    newPrimaryRequests: 0, financialGridOrOldKernelExecutions: 0, qualifiedOriginalIssuers: 0 }, null, 2) + "\n", { flag: "wx" });
  const pointer = { freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) };
  writeFileSync(`${dir}/borrowed-latest.json`, JSON.stringify(pointer, null, 2) + "\n"); console.log(JSON.stringify({ ...pointer, result }));
} catch (e) { console.error(String(e)); process.exitCode = 1; }
