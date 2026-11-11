import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { getConditionalCompanySummary } from "../shared/companyConditionalData";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Mandatory private sources required; not code-only CI");
const dir = "generated-artifacts/company-operating-corpus/issuer-attachment-followup-v1";
const read = (p: string) => readFileSync(p, "utf8");
const json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const plain = (s: string) => s.replace(/<[^>]*>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Independent visible first annual-column reader, NOT the financial adapter's iXBRLreader. */
function visibleFirst(table: string, label: string, multiplier: number) {
  const m = table.match(new RegExp(escape(label) + "\\s+(?:\\$\\s*)?(\\(\\s*)?([\\d,]+|—)\\s*(\\))?"));
  if (!m) throw new Error(`Missing actual visible source row ${label}`);
  const number = m[2] === "—" ? 0 : Number(m[2].replace(/,/g, ""));
  if (Boolean(m[1]) !== Boolean(m[3])) throw new Error(`Unmatched visible sign ${label}`);
  return number * multiplier * (m[1] ? -1 : 1);
}
function cashTable(html: string, title: string) {
  const t = plain(html), start = t.indexOf(title); assert.ok(start >= 0);
  return t.slice(start, t.indexOf("The accompanying Notes", start) > start ? t.indexOf("The accompanying Notes", start) : start + 8500);
}
async function main() {
  const latest = json(`${dir}/latest.json`), frozen = json(latest.freezePath), report = json(latest.reportPath);
  assert.equal(hash(latest.freezePath), latest.freezeSha256); assert.equal(hash(latest.reportPath), latest.reportSha256);
  assert.equal(latest.freezeSha256, "1ae19c89a7ea41a8755044b4a889b23a1311719188add4029fb62664d0160c0e");
  assert.equal(latest.reportSha256, "8a58d74dd70587a9314ce23efe2bd58df693ff72c58169ec3da46ee7c8a0261c");
  assert.equal(hash(`${dir}/receipts.json`), "28437b6b633d40b4e911febcc9908b61b052becec571b895bffd0d64446872e2");
  const receipts = json(`${dir}/receipts.json`);
  assert.equal(receipts.attempts.length, 12); assert.equal(new Set(receipts.attempts.map((r: any) => r.url)).size, 12);
  for (const r of [...receipts.attempts, frozen.retainedFslrAnnual]) {
    if (r.status !== undefined) assert.equal(r.status, 200);
    assert.equal(hash(r.path), r.sha256);
  }
  for (const c of frozen.code) assert.equal(hash(c.path), c.sha256);
  for (const p of frozen.preserve) assert.equal(hash(p.path), p.sha256);
  const oldFreezeRecord = frozen.preserve.find((p: any) => p.path.includes("fslr-cohort-integrated-v1") && p.path.endsWith("frozen-before-calculation.json"));
  const oldFreeze = json(oldFreezeRecord.path), oldReportRecord = frozen.preserve.find((p: any) =>
    p.path.includes("fslr-cohort-integrated-v1") && p.path.endsWith("/report.json"));
  const oldReport = json(oldReportRecord.path);
  for (const p of oldFreeze.preserve) assert.equal(hash(p.path), p.sha256);
  assert.equal(oldReport.cases.reduce((n: number, c: any) => n + c.annualRows.length, 0), 32);
  assert.equal(oldReport.cases.length, 2);
  assert.equal(report.original32RowsBytePreserved, true); assert.equal(report.old96_5and18_82ClaimsBytePreserved, true);

  // Financial rows independently read with printed signs; no valuation or old kernel execution.
  const xplrText = read(`${dir}/xplr-fy2025-10k.html`), x = cashTable(xplrText, "CONSOLIDATED STATEMENTS OF CASH FLOWS");
  const f = (label: string) => visibleFirst(x, label, 1e6);
  const finance = [
    f("Proceeds from issuance of common units – net"), f("Issuances of long-term debt, including premiums and discounts"),
    f("Retirements of long-term debt"), f("Debt issuance costs"), f("Partner contributions"), f("Partner distributions"),
    f("Proceeds on sale of Class B noncontrolling interests – net"), f("Payments to Class B noncontrolling interest investors"),
    f("Buyout of Class B noncontrolling interest investors"), f("Proceeds on sale of differential membership interests"),
    f("Proceeds from differential membership investors"), f("Payments to differential membership investors"),
    f("Buyout of differential membership investors")
  ];
  const financingSection = x.slice(x.indexOf("CASH FLOWS FROM FINANCING ACTIVITIES"));
  const other = visibleFirst(financingSection, "Other – net", 1e6), rebuilt = finance.reduce((a, b) => a + b, 0) + other;
  assert.equal(rebuilt, report.nee.rebuiltFinancingCashUsd);
  assert.equal(rebuilt, f("Net cash used in financing activities"));
  assert.equal(f("Net cash provided by operating activities") + f("Net cash provided by (used in) investing activities") + rebuilt,
    f("NET INCREASE IN CASH, CASH EQUIVALENTS, AND RESTRICTED CASH"));
  assert.equal(report.nee.actualRenewablesIiRemainingBuyoutUsd + report.nee.actualPipelinesRemainingBuyoutUsd,
    -f("Buyout of Class B noncontrolling interest investors"));
  const actual = plain(xplrText);
  assert.match(actual, /In April 2025, XPLR exercised its buyout right and purchased the remaining outstanding Class B noncontrolling membership interests in XPLR Renewables II/);
  assert.equal(report.nee.actualLlcAvailableCashUsd, null); assert.equal(report.nee.actualProjectIrr, null);
  assert.equal(report.nee.neeCommonCashAddedUsd, 0);
  const annual = read(frozen.retainedFslrAnnual.path), annualCash = cashTable(annual, "CONSOLIDATED STATEMENTS OF CASH FLOWS");
  const interim = read(`${dir}/fslr-2026q2.html`), interimCash = cashTable(interim, "CONDENSED CONSOLIDATED STATEMENTS OF CASH FLOWS");
  const a = report.fslr.annual2025, q = report.fslr.interim2026h1;
  assert.equal(visibleFirst(annualCash, "Net cash provided by operating activities", 1000) - frozen.selectedCash.annual2025, a.cfoLessSelectedCreditCashUsd);
  const aGrantCfo = visibleFirst(annualCash, "Government grants receivable", 1000);
  const qGrantCfo = visibleFirst(interimCash, "Government grants receivable", 1000);
  assert.equal(a.allIncomeGrantBenefitsUsd + aGrantCfo - a.identifiedSelectedCreditCashUsd, a.grantRecognitionCfoLessSelectedCashResidualUsd);
  assert.equal(q.allIncomeGrantBenefitsUsd + qGrantCfo - q.identifiedSelectedCreditCashUsd, q.grantRecognitionCfoLessSelectedCashResidualUsd);
  const s = frozen.fslrSource;
  assert.equal(aGrantCfo - (s.annual2025.openingGrantReceivables - s.annual2025.closingGrantReceivables), a.bookCfoResidualUsd);
  assert.equal(qGrantCfo - (s.annual2025.closingGrantReceivables - s.interim2026h1.closingGrantReceivables), q.bookCfoResidualUsd);
  const interimPlain = plain(interim);
  assert.match(interimPlain, /the first of which was received in July 2026/);
  assert.equal(q.indiaFirstReceiptCashUsd, null); assert.equal(q.firstIndiaReceiptIsAfterJune30CashPeriod, true);
  assert.equal(report.fslr.amountAppliedToOriginal32CashRowsUsd, 0);
  assert.equal(report.fslr.currentCompany45xEligibilityCertified, false);
  assert.equal(a.coarse45xScopeDifferenceIsCertifiedOtherGrants, false);
  const submission = read(`${dir}/fslr-20260730-full-submission.txt`);
  const docs = Array.from(submission.matchAll(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/g));
  const press = docs.find(d => /<TYPE>EX-99\.1\s/.test(d[1])); assert.ok(press);
  assert.match(press[1], /<FILENAME>ex991pressreleaseq2-2026\.htm/);
  // This negative finding is limited to the actual release, not all public sources.
  assert.equal(/\bTamil Nadu\b|\bfirst installment\b/i.test(plain(press[1])), false);

  for (const [i, n] of Array.from(["xplr-2025-annual-index.json", "nep-2019-index.json", "nep-2020-index.json"].entries())) {
    const inventory = json(`${dir}/${n}`);
    assert.equal(inventory.directory.item.length, frozen.inventories[i].listedFiles);
    assert.equal(inventory.directory.item.filter((v: any) => /\.xls[xmb]?$/i.test(v.name)).length, frozen.inventories[i].spreadsheetNames.length);
  }
  for (const w of frozen.workbooks) {
    const book = new ExcelJS.Workbook(); await book.xlsx.readFile(`${dir}/${w.name}`);
    assert.deepEqual(book.worksheets.map(s => s.name), w.worksheetNames);
    assert.equal(w.namedIrrModelSheets.length, 0);
  }
  for (const name of ["renewables-ii-2019-llc.html", "genesis-2020-llc.html"]) {
    const h = read(`${dir}/${name}`);
    assert.match(plain(h), /Financial Model for Internal Rate of Return See attached Excel File/);
    assert.equal(Array.from(h.matchAll(/href="([^"]+)"/g)).filter(m => /\.xls[xmb]?(?:$|[?#])/i.test(m[1])).length, 0);
  }
  const evidence = json("docs/issuer-attachment-grant-evidence.json");
  // Evidence expands the explanatory boundary; compare every overlapping source
  // measurement/status/month, not independently worded narrative metadata.
  for (const [k, v] of Object.entries(evidence.calculation.nee)) if (k in report.nee && k !== "boundary") assert.deepEqual(v, report.nee[k]);
  for (const period of ["annual2025", "interim2026h1"])
    assert.deepEqual(evidence.calculation.fslr[period], report.fslr[period]);
  assert.equal(evidence.calculation.fslr.precision.annualCfoLessSelectedCashConservativeRoundingBoundUsd, 3 * 50000 + 500);
  assert.equal(evidence.calculation.fslr.precision.annualCoarseScopeDifferenceConservativeRoundingBoundUsd, 50000000 + 4 * 500);
  let publicBindings = 0;
  for (const company of getConditionalCompanySummary().companies) for (const fact of company.facts.filter(f => f.id.startsWith("attachment"))) {
    const pointer = fact.sourceLocator.split("#")[1];
    assert.equal(pointer.split(".").reduce((x, k) => x[k], evidence), fact.value);
    publicBindings++;
  }
  assert.equal(publicBindings, 4); assert.equal(report.qualifiedOriginalIssuers, 0);
  assert.equal(report.financialGridRootOrOldKernelExecutions, 0);
  const receipt = { version: frozen.version, passed: true, newPrimaryRequests: 12, authenticatedRetainedAnnualSources: 1,
    separatelyReviewedReportingWorkbooks: 2, exactAccessionInventories: 3, independentVisibleCashAndGrantIdentities: 8,
    publicScalarOrNullBindings: 4, preservedOriginalAnnualRows: 32, preservedOldSourceArtifactHashes: oldFreeze.preserve.length,
    publicTestsDependOnPrivateFiles: false, financialGridRootOrOldKernelExecutions: 0, qualifiedOriginalIssuers: 0,
    freezeSha256: latest.freezeSha256, reportSha256: latest.reportSha256 };
  writeFileSync(`${dir}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n");
  console.log(JSON.stringify(receipt));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
