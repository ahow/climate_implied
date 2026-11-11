import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractNeeCscsHeldCash, reconcileNeeCscsHeldCash } from "../server/calculation/neeCscsHeldCashBridge";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private source component only");
const dir = "generated-artifacts/company-operating-corpus/nee-parent-crosswalk-v1";
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
try {
  const prior = json(`${dir}/latest.json`), frozenParent = json(prior.freezePath), parent = json(prior.reportPath);
  assert.equal(hash(prior.freezePath), "efc45791cd1167ad509244f7836d69de7436710b7ae96941b72056d1d1479e12");
  assert.equal(hash(prior.reportPath), "88075ddf9cac31651a71905897f2f0ac146bf9beead6cdfa73db5bd100487977");
  const primary = frozenParent.primary.find((p: any) => p.name === "xplr-fy2025-10k.html");
  assert.equal(hash(primary.path), primary.sha256);
  const source = extractNeeCscsHeldCash(readFileSync(primary.path, "utf8"));
  const out = `${dir}/held-cash-${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(out);
  const freezePath = `${out}/frozen-before-calculation.json`;
  const frozen = { version: "nee-cscs-held-cash-1", frozenAt: new Date().toISOString(), primary, source,
    neeConsolidatedNetCscsCashUsd: parent.nee.parentCscsNetFinancingCashUsd,
    preserve: [{ path: prior.freezePath, sha256: prior.freezeSha256 }, { path: prior.reportPath, sha256: prior.reportSha256 }],
    conditions: { noGrossCashOrFeeCashInferred: true, noDefaultClauseErasesExceptionIncome: true,
      sourcePresentationMillionUsdPrecision: true, noFutureEconomicAssumptions: true, noOriginalCashInsertion: true },
    code: ["server/calculation/neeCscsHeldCashBridge.ts", "script/nee-cscs-held-cash.test.ts",
      "script/run-nee-cscs-held-cash.ts"].map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
  const result = reconcileNeeCscsHeldCash(frozen.source, frozen.neeConsolidatedNetCscsCashUsd);
  const reportPath = `${out}/report.json`;
  writeFileSync(reportPath, JSON.stringify({ version: frozen.version, freezeSha256: hash(freezePath), result,
    newPrimaryRequests: 0, financialGridOrOldKernelExecutions: 0 }, null, 2) + "\n", { flag: "wx" });
  const pointer = { freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) };
  writeFileSync(`${dir}/held-cash-latest.json`, JSON.stringify(pointer, null, 2) + "\n");
  console.log(JSON.stringify({ ...pointer, result }));
} catch (e) { console.error(String(e)); process.exitCode = 1; }
