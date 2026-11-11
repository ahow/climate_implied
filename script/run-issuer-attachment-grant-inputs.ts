import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { attachmentInventory, workbookMeasurements, extractFslrAnnualInterimGrants, reconcileFslrAnnualInterimGrants,
  extractXplr2025Funding, reconcileXplr2025Funding } from "../server/calculation/issuerAttachmentGrantInputs";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private authenticated primary only");
const root = "generated-artifacts/company-operating-corpus", dir = `${root}/issuer-attachment-followup-v1`;
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
async function main() {
  const receipts = json(`${dir}/receipts.json`); assert.equal(receipts.attempts.length, 12);
  for (const r of receipts.attempts) { assert.equal(r.status, 200); assert.equal(hash(r.path), r.sha256); }
  const inventorySpecs = [["xplr-2025-annual-index.json", "000160314525000006"],
    ["nep-2019-index.json", "000160314519000060"], ["nep-2020-index.json", "000160314520000073"]];
  const inventories = inventorySpecs.map(([name, accession]) => attachmentInventory(json(`${dir}/${name}`), "1603145", accession));
  const workbooks = [];
  for (const name of ["xplr-2025-financial-report.xlsx", "nep-2020-financial-report.xlsx"]) {
    const b = new ExcelJS.Workbook(); await b.xlsx.readFile(`${dir}/${name}`);
    workbooks.push({ name, sha256: hash(`${dir}/${name}`), ...workbookMeasurements(b) });
  }
  const annualPath = `${root}/issuer-contract-law-v1/fslr-fy2025-10k.html`;
  const priorReceipts = json(`${root}/issuer-contract-law-v1/receipts.json`);
  const annualReceipt = priorReceipts.attempts.find((a: any) => a.path === annualPath);
  assert.ok(annualReceipt); assert.equal(hash(annualPath), annualReceipt.sha256);
  const fslrSource = extractFslrAnnualInterimGrants(readFileSync(annualPath, "utf8"), readFileSync(`${dir}/fslr-2026q2.html`, "utf8"));
  const xplrSource = extractXplr2025Funding(readFileSync(`${dir}/xplr-fy2025-10k.html`, "utf8"));
  const oldPath = `${root}/fslr-cohort-integrated-v1/2026-11-11T13-46-14-298Z/report.json`;
  assert.equal(hash(oldPath), "b7dddd17e1667a9f62b173fae225c9a4da320f9157c8e23385eb648297494982");
  const old = json(oldPath);
  const oldFreezePath = `${root}/fslr-cohort-integrated-v1/2026-11-11T13-46-14-298Z/frozen-before-calculation.json`;
  assert.equal(hash(oldFreezePath), "d9885a31f12d72528b72aff8b286262d94f0f350c91289e6b464ca36247bc735");
  const oldFreeze = json(oldFreezePath);
  const selected2025 = oldFreeze.sourceFacts.transfers.flatMap((t: any) => t.receipts)
    .filter((r: any) => r.year === 2025).reduce((s: number, r: any) => s + r.cashUsd, 0);
  const selected2026h1 = old.cases[0].source2026PriorCreditCashUsd;
  const preserve = [
    { path: oldPath, sha256: hash(oldPath) }, { path: oldFreezePath, sha256: hash(oldFreezePath) },
    { path: "docs/fslr-grant-scope-evidence.json", sha256: "bab53fd6b2fe883998567ee34b75846cbde8283ea9532947f9cebe2e2c176b35" },
    { path: "docs/nee-related-source-followup-evidence.json", sha256: "8e41a96d514039d7054b4671d48e36779e73f8aac9205ab33bca47bcb4bb26aa" }
  ];
  const llcBase = `${root}/fslr-grant-scope-v1/nee-related-followup`;
  for (const name of ["latest.json", "llc-claims-latest.json"]) {
    const l = json(`${llcBase}/${name}`);
    preserve.push({ path: l.freezePath, sha256: l.freezeSha256 }, { path: l.reportPath, sha256: l.reportSha256 });
  }
  for (const p of preserve) assert.equal(hash(p.path), p.sha256);
  const out = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(out);
  const freezePath = `${out}/frozen-before-calculation.json`;
  const frozen = { version: "issuer-attachment-grant-followup-1", frozenAt: new Date().toISOString(),
    sourceReceipts: receipts.attempts, retainedFslrAnnual: { path: annualPath, sha256: hash(annualPath) }, preserve,
    inventories, workbooks, fslrSource, xplrSource, selectedCash: { annual2025: selected2025, interim2026h1: selected2026h1 },
    conditions: { futureEconomicAssumptionsAdded: 0, noCorporateCfoAsLlcAvailableCash: true, noIndiaAmountInferred: true,
      indiaJulyReceiptNotSixMonthCash: true, noBudgetBeyond12: true, noProgrammeAllocationFromAllGrantTotals: true,
      noOldCounterfactualRetune: true, revisedHistoryNotPointInTime: true, ownerReview: "pending-not-requested" },
    code: ["server/calculation/issuerAttachmentGrantInputs.ts", "script/issuer-attachment-grant-inputs.test.ts",
      "script/run-issuer-attachment-grant-inputs.ts"].map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
  const fslr = reconcileFslrAnnualInterimGrants(frozen.fslrSource, frozen.selectedCash), nee = reconcileXplr2025Funding(frozen.xplrSource);
  const report = { version: frozen.version, freezePath, freezeSha256: hash(freezePath), fslr, nee,
    original32RowsBytePreserved: true, old96_5and18_82ClaimsBytePreserved: true, old422mAnd58mBytePreserved: true,
    qualifiedOriginalIssuers: 0, financialGridRootOrOldKernelExecutions: 0 };
  const reportPath = `${out}/report.json`; writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  writeFileSync(`${dir}/latest.json`, JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) }, null, 2) + "\n");
  console.log(JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath),
    newPrimaryRequests: 12, inventories: inventories.map(i => ({ files: i.listedFiles, spreadsheets: i.spreadsheetNames.length })),
    workbookSheetCounts: workbooks.map(w => w.worksheetCount), fslr, nee, qualifiedOriginalIssuers: 0 }));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
