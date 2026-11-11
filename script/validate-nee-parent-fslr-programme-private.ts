import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { getConditionalCompanySummary } from "../shared/companyConditionalData";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Separate mandatory private-source validator only");
const root = "generated-artifacts/company-operating-corpus", dir = `${root}/nee-parent-crosswalk-v1`;
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const plain = (s: string) => s.replace(/<ix:header[\s\S]*?<\/ix:header>/g, "").replace(/<[^>]*>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
function firstPrinted(table: string, label: string) {
  const m = table.match(new RegExp(escape(label) + "\\s+(?:\\$\\s*)?(\\(\\s*)?([\\d,]+|—)\\s*(\\))?"));
  if (!m || Boolean(m[1]) !== Boolean(m[3])) throw new Error(`Actual visible/sign row required: ${label}`);
  return (m[2] === "—" ? 0 : Number(m[2].replace(/,/g, ""))) * (m[1] ? -1 : 1);
}
function expenseColumns(note: string, label: string) {
  const i = note.indexOf(label); assert.ok(i >= 0); let t = note.slice(i + label.length); const values = [];
  for (let c = 0; c < 4; c++) {
    const m = t.match(/^\s*(?:\$\s*)?([\d,]+|—)/); if (!m) throw new Error("Four actual displayed expensecolumns required");
    values.push(m[1] === "—" ? 0 : Number(m[1].replace(/,/g, "")) * 1000); t = t.slice(m[0].length);
  }
  return values;
}
function main() {
  const latest = json(`${dir}/latest.json`), frozen = json(latest.freezePath), report = json(latest.reportPath);
  assert.equal(hash(latest.freezePath), "efc45791cd1167ad509244f7836d69de7436710b7ae96941b72056d1d1479e12");
  assert.equal(hash(latest.reportPath), "88075ddf9cac31651a71905897f2f0ac146bf9beead6cdfa73db5bd100487977");
  assert.equal(hash(`${dir}/receipts.json`), "426c4286403d3da8ddda39b26f5607855a2b4964811d168cdf6d5c6d00e208a6");
  const sealed = json(`${dir}/source-sealed.json`), receipts = json(`${dir}/receipts.json`);
  assert.equal(sealed.receiptsSha256, hash(`${dir}/receipts.json`)); assert.equal(sealed.logicalRequests, 3);
  assert.equal(receipts.attempts.length, 3); assert.equal(new Set(receipts.attempts.map((r: any) => r.url)).size, 3);
  for (const s of frozen.primary) { assert.equal(s.status, 200); assert.equal(hash(s.path), s.sha256); }
  for (const c of frozen.code) assert.equal(hash(c.path), c.sha256);
  for (const p of frozen.preserve) assert.equal(hash(p.path), p.sha256);
  const priorFreeze = json(frozen.preserve[0].path), priorReport = json(frozen.preserve[1].path);
  for (const s of priorFreeze.sourceReceipts) { assert.equal(s.status, 200); assert.equal(hash(s.path), s.sha256); }
  for (const p of priorFreeze.preserve) assert.equal(hash(p.path), p.sha256);
  const cohortFreeze = json(priorFreeze.preserve.find((p: any) => p.path.includes("fslr-cohort-integrated-v1") &&
    p.path.endsWith("frozen-before-calculation.json")).path);
  for (const p of cohortFreeze.preserve) assert.equal(hash(p.path), p.sha256);
  const cohortReport = json(priorFreeze.preserve.find((p: any) => p.path.includes("fslr-cohort-integrated-v1") &&
    p.path.endsWith("/report.json")).path);
  assert.equal(cohortReport.cases.reduce((n: number, c: any) => n + c.annualRows.length, 0), 32);
  assert.equal(priorReport.fslr.annual2025.cfoLessSelectedCreditCashUsd, 613405000);
  assert.equal(priorReport.fslr.annual2025.grantRecognitionCfoLessSelectedCashResidualUsd, 14435000);
  assert.equal(priorReport.fslr.interim2026h1.grantRecognitionCfoLessSelectedCashResidualUsd, 780000);
  const parent = plain(read(`${dir}/nee-fy2025-10k.html`)), parentCash = parent.slice(parent.indexOf("NEXTERA ENERGY, INC. CONSOLIDATED STATEMENTS OF CASH FLOWS"));
  const visible = (label: string) => firstPrinted(parentCash, label) * 1e6;
  const p = report.nee, ps = frozen.parentSource;
  assert.equal(visible("Distributions of earnings from equity method investees"), p.neeConsolidatedAffiliateEarningsDistributions2025Usd);
  assert.equal(visible("Net cash provided by operating activities") + visible("Net cash used in investing activities") +
    visible("Net cash provided by financing activities") + visible("Effects of currency translation on cash, cash equivalents and restricted cash"),
  p.neeConsolidatedCashChangeUsd);
  assert.equal(ps.neeEquityOpCoCommonLpPercent + ps.xplrOpCoCommonLpPercent, 100);
  assert.equal(p.parentCscsNetFinancingCashUsd + p.counterpartyCscsNetInvestingCashUsd, p.opposingCscsReportedLegResidualUsd);
  assert.equal(ps.dueFromXplrCurrent2025Usd + ps.dueFromXplrNoncurrent2025Usd -
    ps.dueFromXplrCurrent2024Usd - ps.dueFromXplrNoncurrent2024Usd, p.dueFromXplrBookIncreaseUsd);
  assert.match(parent, /accounts for its ownership interest in XPLR as an equity method investment/);
  assert.match(parent, /incurred costs of approximately \$ 1,387 million/);
  assert.match(parent, /which have been or will be reimbursed by XPLR/);
  assert.equal(p.actualGrossServiceReimbursementCashUsd, null);
  assert.equal(p.actualParentStandaloneXplrCashUsd, null);
  assert.equal(p.counterpartyDistributions61mAreCertifiedSubsetOfNee446m, false);
  assert.equal(p.counterparty47mEquityMovementIsCertifiedCash, false);
  assert.equal(p.xplr931m219mAreNeeConsolidatedFinancingPayments, false);
  assert.equal(p.originalNeeCommonFcfeCashAddedUsd, 0);
  const contract = plain(read(`${dir}/xplr-neer-cscs-2025-ex106.html`));
  assert.match(contract, /3\.1\.1 US Cash/); assert.match(contract, /other than Reserved Cash/);
  assert.match(contract, /no member of the XPLR Group shall be entitled to receive any interest or other fees for the Cash Sweep Withdrawals/);

  const q3Source = frozen.primary.find((r: any) => r.name === "fslr-2026q3.html");
  const q3 = plain(read(q3Source.path)), note = q3.slice(q3.indexOf("5. Government Grants"));
  const labels = ["Cost of sales", "Selling, general and administrative", "Research and development", "Production start-up"];
  const display = labels.map(label => expenseColumns(note, label)), fs = frozen.quarterSource, f = report.fslr;
  assert.deepEqual(display.map(v => v[0]), fs.quarterExpenseBenefitsUsd);
  assert.deepEqual(display.map(v => v[2]), fs.nineMonthExpenseBenefitsUsd);
  for (let i = 0; i < 3; i++) assert.equal(display[i][2] - display[i][0], frozen.firstHalf.firstHalfExpenseBenefitsUsd[i]);
  assert.equal(display[3][2] - display[3][0], f.derivedFirstHalfStartupBenefitsUsd);
  const sum = (v: number[]) => v.reduce((a, b) => a + b, 0);
  assert.equal(sum(display.map(v => v[2])) - sum(display.map(v => v[0])) - f.allProgrammeFirstHalfBenefitsWithDerivedStartupUsd, 0);
  assert.equal(f.alabamaNineMonthAssetGrantRecognitionUsd - f.alabamaQuarterAssetGrantRecognitionUsd, 0);
  assert.match(note, /During the three and nine months ended September 30, 2026, we recognized \$ 6\.1 million/);
  assert.match(note, /manufacturing facilities in Alabama/);
  const cash = q3.slice(q3.indexOf("CONDENSED CONSOLIDATED STATEMENTS OF CASH FLOWS"));
  const grantCfo = firstPrinted(cash, "Government grants receivable") * 1000;
  assert.equal(f.allProgrammeNineMonthIncomeBenefitsUsd + grantCfo - frozen.firstHalf.selectedPriorCreditCashCollectedFirstHalfUsd,
    f.nineMonthRecognitionCfoLessOnlyKnownPriorCreditCashResidualUsd);
  assert.equal(f.allProgrammeQuarterIncomeBenefitsUsd + grantCfo - frozen.firstHalf.firstHalfGrantCfoEffectUsd,
    f.quarterRecognitionCfoUnallocatedResidualUsd);
  assert.equal(grantCfo - (frozen.firstHalf.openingAllGrantReceivablesUsd - fs.closingAllGrantReceivablesUsd), f.nineMonthBookCfoResidualUsd);
  assert.equal(grantCfo - frozen.firstHalf.firstHalfGrantCfoEffectUsd -
    (frozen.firstHalf.firstHalfClosingAllGrantReceivablesUsd - fs.closingAllGrantReceivablesUsd), f.quarterBookCfoResidualUsd);
  assert.equal(f.alabamaAssetGrantObservedCashUsd, null); assert.equal(f.indiaJulyCashAmountUsd, null);
  assert.equal(f.indiaFirstReceiptMonthPreserved, "2026-07"); assert.equal(f.amountAddedToOriginalCashRowsUsd, 0);
  assert.equal(f.actualEligibleUsComponentWatts, null); assert.equal(f.currentCompany45xEligibilityCertified, false);
  const heldPointer = json(`${dir}/held-cash-latest.json`), heldFreeze = json(heldPointer.freezePath), held = json(heldPointer.reportPath).result;
  assert.equal(hash(heldPointer.freezePath), "7856aecae38e4bfe9ff3164eaba18e7fba39894fbfe8584f7ae8612d2d63ff91");
  assert.equal(hash(heldPointer.reportPath), "406e2c1ea96ca4dc0de58bce223ba1d5bf60e80c0aa4bafd8e5c27a12cba70a1");
  for (const c of heldFreeze.code) assert.equal(hash(c.path), c.sha256);
  for (const p of heldFreeze.preserve) assert.equal(hash(p.path), p.sha256);
  assert.equal(hash(heldFreeze.primary.path), heldFreeze.primary.sha256);
  const heldNote = plain(read(heldFreeze.primary.path));
  assert.match(heldNote, /cash sweep amounts held in accounts belonging to NEER or its affiliates were approximately \$ 11 million and \$ 127 million/);
  assert.equal(held.openingHeldSweepUsd - held.closingHeldSweepUsd, held.counterpartyNetCscsInvestingCashUsd);
  assert.equal(held.creditSupportFeeExpense2025Usd + held.priorChargeTrueupExpense2025Usd, held.netReportedCreditSupportFeeExpense2025Usd);
  assert.equal(held.heldBalanceVersusCounterpartyNetCashResidualUsd, 0);
  assert.equal(held.opposingNeeConsolidatedLegResidualUsd, p.opposingCscsReportedLegResidualUsd);
  assert.equal(held.actualGrossSweepWithdrawalsAndReturnsUsd, null);
  assert.equal(held.actualCreditSupportFeeCash2025Usd, null);
  assert.equal(held.exceptionalInterestCashReceipt2024Usd, null);
  assert.equal(held.neeCommonFcfeCashAddedUsd, 0);
  const evidence = json("docs/nee-parent-fslr-programme-evidence.json");
  for (const issuer of ["nee", "fslr"]) for (const [k, v] of Object.entries(evidence.calculation[issuer]))
    if (k in report[issuer]) assert.deepEqual(v, report[issuer][k]);
  for (const [k, v] of Object.entries(evidence.calculation.cscsHeldCash)) if (k in held && k !== "boundary") assert.deepEqual(v, held[k]);
  let bindings = 0;
  for (const company of getConditionalCompanySummary().companies) for (const fact of company.facts.filter(f => f.id.startsWith("parentProgramme"))) {
    assert.equal(fact.sourceLocator.split("#")[1].split(".").reduce((v, k) => v[k], evidence), fact.value); bindings++;
  }
  assert.equal(bindings, 4);
  const receipt = { version: report.version, passed: true, newPrimaryRequests: 3, repeatedInventoryOrWorkbookRequests: 0,
    authenticatedPrimaryArtifacts: frozen.primary.length, independentCashOwnershipAndProgrammeIdentities: 16,
    publicScalarBindings: bindings, priorProtectedArtifactHashes: cohortFreeze.preserve.length,
    originalAnnualRowsBytePreserved: 32, original613405mAnd14435mAnd780kPreserved: true,
    separateNewFrozenSourceCalculations: 2, financialGridOrOldKernelExecutions: 0, qualifiedOriginalIssuers: 0,
    freezeSha256: latest.freezeSha256, reportSha256: latest.reportSha256,
    heldCashFreezeSha256: heldPointer.freezeSha256, heldCashReportSha256: heldPointer.reportSha256 };
  writeFileSync(`${dir}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt));
}
try { main(); } catch (e) { console.error(String(e)); process.exitCode = 1; }
