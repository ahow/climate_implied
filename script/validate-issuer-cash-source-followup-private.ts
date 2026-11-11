import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { nativeAttachmentReader } from "../server/calculation/issuerAttachmentGrantInputs";
import { embeddedSecJpegs, sourceExhibit } from "../server/calculation/issuerSourceExhibits";
import { getConditionalCompanySummary } from "../shared/companyConditionalData";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Separate private original-source validation only");
const root = "generated-artifacts/company-operating-corpus", dir = `${root}/issuer-cash-source-followup-v1`;
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const plain = (s: string) => s.replace(/<ix:header[\s\S]*?<\/ix:header>/g, "").replace(/<[^>]*>/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const identities: string[] = [];
function identity(name: string, actual: number, expected: number) { assert.equal(actual, expected, name); identities.push(name); }
try {
  const pointer = json(`${dir}/latest.json`), frozen = json(pointer.freezePath), report = json(pointer.reportPath);
  const bp = json(`${dir}/borrowed-latest.json`), bf = json(bp.freezePath), b = json(bp.reportPath).result;
  assert.equal(hash(pointer.freezePath), "d909c66d7148d3efe721413f77d34838773b909db6e6b8a291247e4aa7a18e27");
  assert.equal(hash(pointer.reportPath), "3d544e2f1c45e87f91c07ed8278f7c8d3b7c6ceff01b6a08c71592a220f664f2");
  assert.equal(hash(bp.freezePath), "ef16d6204e860ed05614e18e49ec88682b046a15410fab575a3ed06e42f45307");
  assert.equal(hash(bp.reportPath), "3479ff1c5c255431477b0ce6d5bc201bc2efff11cbcce72c2bfdf76329704c5d");
  for (const f of [frozen, bf]) {
    for (const c of f.code) assert.equal(hash(c.path), c.sha256);
    for (const p of f.preserve) assert.equal(hash(p.path), p.sha256);
  }
  for (const p of bf.primary) assert.equal(hash(p.path), p.sha256);
  const book = json(`${dir}/receipts.json`), seal = json(`${dir}/source-sealed.json`);
  assert.equal(book.attempts.length, 6); assert.equal(new Set(book.attempts.map((r: any) => r.url)).size, 6);
  assert.equal(hash(`${dir}/receipts.json`), seal.receiptsSha256); assert.equal(seal.requests, 6);
  for (const r of book.attempts) { assert.equal(r.status, 200); assert.equal(hash(r.path), r.sha256); }
  const previousUrls = new Set<string>();
  for (const name of ["issuer-cash-collections-v1", "issuer-financial-followup-v1", "issuer-attachment-followup-v1", "nee-parent-crosswalk-v1"])
    for (const r of json(`${root}/${name}/receipts.json`).attempts) previousUrls.add(r.url);
  for (const r of book.attempts) assert.equal(previousUrls.has(r.url), false, "New source URL must not repeat retained primaryrequests");
  const source = (name: string) => read(book.attempts.find((r: any) => r.name === name).path);
  const a = nativeAttachmentReader(source("nee-2025q3.html"), "0000753308");
  const x = nativeAttachmentReader(source("xplr-2025q3.html"), "0001603145");
  const end = "2025-09-30", start = "2025-01-01", member = "xplr:NoncontrollingOwnershipInterestsinNEPOpCoTexasPipelineandSilverStateMember";
  const category = x("xplr:RelatedPartyDistributions", end, start, member), q3 = x("xplr:RelatedPartyDistributions", end, "2025-07-01", member);
  identity("Actual new category/other financingcash reconciliation", category + x("xplr:RelatedPartyDistributions", end, start, "xplr:OtherNoncontrollingInterestMember"),
    x("xplr:RelatedPartyDistributions", end, start));
  identity("Fourth-quarter aggregate category cash", frozen.annual.categoryDistributionsUsd - category, report.nee.neeAggregateCategoryFourthQuarterDistributionsUsd);
  identity("First-half aggregate category cash", category - q3, report.nee.neeAggregateCategoryFirstHalfDistributionsUsd);
  identity("Fourth-quarter counterparty cash", frozen.annual.xplrNetCscsInvestingCashUsd -
    x("us-gaap:ProceedsFromPaymentsForLongTermLoansForRelatedParties", end, start), report.nee.xplrFourthQuarterNetCscsInvestingCashUsd);
  identity("Fourth-quarter broader parent cash", frozen.annual.neeBroaderRelatedSweepFinancingCashUsd -
    a("us-gaap:ProceedsFromRepaymentsOfRelatedPartyDebt", end, start), report.nee.neeFourthQuarterBroaderRelatedSweepFinancingCashUsd);
  identity("Quarter leg differences aggregate to annual", report.nee.firstNineMonthReportedLegDifferenceUsd + report.nee.fourthQuarterReportedLegDifferenceUsd,
    report.nee.annualReportedLegDifferenceUsd);
  identity("Service incurred-cost period partition not cash", frozen.annual.neerServiceCostsIncurredUsd -
    a("nee:ReimbursementsInterestAndFeeIncomeOtherLoans", end, start, "nee:XPLRMember"), report.nee.fourthQuarterServiceCostsIncurredUsd);
  const due = a("us-gaap:OtherReceivables", end, undefined, "nee:CashSweepAndCreditSupportAgreementMember") +
    a("us-gaap:OtherAssetsNoncurrent", end, undefined, "nee:CashSweepAndCreditSupportAgreementMember");
  identity("Receivable book partition not collection", frozen.annual.dueFromXplrClosingBookUsd - due, report.nee.fourthQuarterDueFromXplrBookIncreaseUsd);
  for (const k of ["actualServiceReimbursementCashUsd", "neeEquityOnlyPortionOf61mUsd", "actualGrossCscsWithdrawalsOrRepaymentsUsd", "exactXplrOnlyPortionOfNee131mUsd"])
    assert.equal(report.nee[k], null);
  // Independent visible liquidity row extraction, not the new financial calculator.
  const stocks = bf.primary.map((p: any) => {
    const row = plain(read(p.path)).match(/Cash swept from unconsolidated entities — \(\s*([\d,]+)\s*\) \(\s*([\d,]+)\s*\)/);
    assert.ok(row); assert.equal(row[1], row[2]); return Number(row[2].replace(/,/g, "")) * 1e6;
  });
  assert.deepEqual(stocks, [250e6, 123e6, 119e6]);
  identity("Annual all-pool book release", stocks[0] - stocks[2], b.totalAnnualBookReleaseUsd);
  identity("Independent reported annual financing ties borrowed stock change", stocks[2] - stocks[0], frozen.annual.neeBroaderRelatedSweepFinancingCashUsd);
  identity("Interim stock-flow residual is not forced closed", frozen.quarter.neeYtdBroaderRelatedSweepFinancingCashUsd - (stocks[1] - stocks[0]), b.ytdNetFinancingVersusBookChangeResidualUsd);
  identity("Fourth-quarter opposite stock-flow residual preserved", frozen.annual.neeBroaderRelatedSweepFinancingCashUsd -
    frozen.quarter.neeYtdBroaderRelatedSweepFinancingCashUsd - (stocks[2] - stocks[1]), b.fourthQuarterNetFinancingVersusBookChangeResidualUsd);
  assert.equal(b.independentlyCertifiedOtherPartyBankSettlementsUsd, null); assert.equal(b.actualGrossWithdrawalsOrReturnsUsd, null);
  const enlink = plain(source("enlink-2024q2.html"));
  const clause = enlink.match(/The contractually committed fees include([\s\S]*?)We may not realize/); assert.ok(clause);
  const amounts = Array.from(clause[1].matchAll(/\$\s*([\d.]+) million/g)).map(m => Number(m[1]) * 1e6);
  assert.deepEqual(amounts, [19.8e6, 33.8e6, 33.7e6, 33.8e6, 722.9e6]);
  assert.match(enlink, /These fees do not represent the shortfall amounts we expect to collect/);
  identity("Historical XOM-subsidiary expected recognition schedule sum", amounts.reduce((s, v) => s + v, 0), report.mvc.historicalXomSubsidiaryMvcRecognitionScheduleUsd);
  identity("Other historical committed fees", 1793.2e6 - report.mvc.historicalXomSubsidiaryMvcRecognitionScheduleUsd, report.mvc.otherContractExpectedFeesAtJune30Usd);
  identity("Later all-contract change not XOM cancellation", 1112.8e6 - 1793.2e6, report.mvc.laterAllContractFeeTableChangeUsd);
  for (const k of ["actualCashPaidOrCollectedUsd", "executedPerTonneTariffUsd", "actualGasOrTransportedVolume", "exactXomContractSubsidiaryLegalName", "currentSettlementValueUsd"])
    assert.equal(report.mvc[k], null);
  assert.equal(report.mvc.laterPeriods2029To2050AllocatedAnnually, false); assert.equal(report.mvc.laterTableChangeCertifiedAsXomCancellationOrRecovery, false);
  assert.equal(report.mvc.baselineCarbonOrOperatingCostDeductedAgainUsd, 0);
  const f = sourceExhibit(source("fslr-20261029-full-submission.txt"), "EX-99.1"), fp = plain(f.body);
  assert.match(fp, /module sales to be between 4\.3 GW and 5\.3 GW, including 3\.4 GW to 4\.3 GW from our U\.S\. manufacturing operations/);
  assert.equal((fp.match(/\bIndia\b/gi) ?? []).length, 0);
  assert.equal(report.fslr.observedEligibleUsComponentWatts, null); assert.equal(report.fslr.indiaJulyReceiptAmountUsd, null);
  assert.equal(report.fslr.indiaJulyCashStatementClassification, null); assert.equal(report.fslr.actualCompanyCurrent45xEligibilityCertified, false);
  const cfImages = embeddedSecJpegs(source("cf-20261104-full-submission.txt")); assert.equal(cfImages.length, 20);
  const slide = cfImages.find(p => p.name === "tm2628886d1_ex99-1img015.jpg")!;
  assert.equal(createHash("sha256").update(slide.bytes).digest("hex"), frozen.cfManualPrimaryTranscription.imageSha256);
  assert.equal(hash(frozen.cfManualPrimaryTranscription.imagePath), frozen.cfManualPrimaryTranscription.imageSha256);
  const c = report.cfCash;
  identity("CF actual source consolidated cash bridge", 1982e6 + 2544e6 + 391e6 - 776e6 - 447e6 - 856e6 - 18e6, c.closingCashUsd);
  identity("CF actual total capex funding", 637e6 + 139e6, c.consolidatedCapexUsd);
  identity("CF BluePoint separate project capex funding", 93e6 + 139e6, c.bluePointConsolidatedCapexUsd);
  assert.equal(c.actualXomFeeCashUsd, null); assert.equal(c.xomOwnProjectFundingUsd, null); assert.equal(c.directRosePermitCfCrosswalk, null);
  const oneok = plain(source("oneok-2026q3.html"));
  assert.equal((oneok.match(/Exxon\s*Mobil|Pecan\s*Island|financial arrangement|sequestr|\bRose\b|carbon\s+capture/gi) ?? []).length, 0);
  // Byte preservation through prior frozen source packages, not financial reruns.
  const parentPointer = json(`${root}/nee-parent-crosswalk-v1/latest.json`), pf = json(parentPointer.freezePath);
  assert.equal(hash(parentPointer.freezePath), parentPointer.freezeSha256); assert.equal(hash(parentPointer.reportPath), parentPointer.reportSha256);
  for (const p of [...pf.code, ...pf.preserve, ...pf.primary]) assert.equal(hash(p.path), p.sha256);
  const heldPointer = json(`${root}/nee-parent-crosswalk-v1/held-cash-latest.json`), heldFreeze = json(heldPointer.freezePath);
  assert.equal(hash(heldPointer.freezePath), "7856aecae38e4bfe9ff3164eaba18e7fba39894fbfe8584f7ae8612d2d63ff91");
  assert.equal(hash(heldPointer.reportPath), "406e2c1ea96ca4dc0de58bce223ba1d5bf60e80c0aa4bafd8e5c27a12cba70a1");
  for (const p of [...heldFreeze.code, ...heldFreeze.preserve, heldFreeze.primary]) assert.equal(hash(p.path), p.sha256);
  const af = json(pf.preserve[0].path), ar = json(pf.preserve[1].path);
  for (const p of [...af.code, ...af.preserve, ...af.sourceReceipts]) assert.equal(hash(p.path), p.sha256);
  const cfFreeze = json(af.preserve.find((p: any) => /fslr-cohort-integrated-v1/.test(p.path) && /frozen-before-calculation/.test(p.path)).path);
  for (const p of cfFreeze.preserve) assert.equal(hash(p.path), p.sha256);
  const cfReport = json(af.preserve.find((p: any) => /fslr-cohort-integrated-v1/.test(p.path) && /\/report.json$/.test(p.path)).path);
  assert.equal(cfReport.cases.reduce((s: number, p: any) => s + p.annualRows.length, 0), 32);
  assert.equal(ar.fslr.annual2025.cfoLessSelectedCreditCashUsd, 613405000);
  assert.equal(ar.fslr.annual2025.grantRecognitionCfoLessSelectedCashResidualUsd, 14435000);
  assert.equal(ar.fslr.interim2026h1.grantRecognitionCfoLessSelectedCashResidualUsd, 780000);
  const evidence = json("docs/issuer-cash-source-followup-evidence.json");
  for (const section of ["nee", "fslr", "mvc", "cfCash"]) for (const [k, v] of Object.entries(evidence.calculation[section]))
    assert.deepEqual(v, report[section][k]);
  for (const [k, v] of Object.entries(evidence.calculation.borrowedCash)) assert.deepEqual(v, b[k]);
  let bindings = 0;
  for (const company of getConditionalCompanySummary().companies) for (const fact of company.facts.filter(f => f.id.startsWith("sourceFollowup"))) {
    assert.equal(fact.sourceLocator.split("#")[1].split(".").reduce((v, k) => v[k], evidence), fact.value); bindings++;
  }
  assert.equal(bindings, 2); assert.equal(report.qualifiedOriginalIssuers, 0);
  const receipt = { version: report.version, passed: true, actualNewPrimaryRequests: 6, http200Count: 6, repeatedPriorPrimaryUrls: 0,
    sourceImagesPrivatelyDecoded: 20, independentArithmeticIdentities: identities.length, identityNames: identities,
    publicScalarBindings: bindings, originalAnnualRowsBytePreserved: 32, priorProtectedArtifactHashes: cfFreeze.preserve.length,
    original613405m14435m780kPreserved: true, successfulSeparateNewSourceCalculations: 2,
    oldFinancialKernelGridOrRootExecutions: 0, qualifiedOriginalIssuers: 0,
    freezeSha256: pointer.freezeSha256, reportSha256: pointer.reportSha256,
    borrowedFreezeSha256: bp.freezeSha256, borrowedReportSha256: bp.reportSha256 };
  writeFileSync(`${dir}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt));
} catch (e) { console.error(String(e)); process.exitCode = 1; }
