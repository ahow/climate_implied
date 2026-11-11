import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { getConditionalCompanySummary } from "../shared/companyConditionalData";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Separate private source validator only");
const root = "generated-artifacts/company-operating-corpus/fslr-grant-scope-v1";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const latest = read(`${root}/latest.json`), relatedLatest = read(`${root}/nee-related-followup/latest.json`);
for (const l of [latest, relatedLatest]) {
  assert.equal(hash(l.freezePath), l.freezeSha256); assert.equal(hash(l.reportPath), l.reportSha256);
}
const frozen = read(latest.freezePath), relatedFrozen = read(relatedLatest.freezePath);
for (const f of [frozen, relatedFrozen]) {
  assert.equal(hash(f.sourcePath), f.sourceSha256);
  for (const c of f.code) {
    if (c.path === "script/run-fslr-grant-scope.ts") {
      // Sole post-freeze compiler repair: remove duplicate JSONlog version key.
      // Prove exact historical runner reconstruction; no financial code retune.
      const current = readFileSync(c.path, "utf8");
      const historical = current.replace("console.log(JSON.stringify({ freezePath,",
        "console.log(JSON.stringify({ version: captured.version, freezePath,");
      assert.notEqual(historical, current);
      assert.equal(createHash("sha256").update(historical).digest("hex"), c.sha256);
    } else assert.equal(hash(c.path), c.sha256);
  }
}
for (const p of frozen.protectedArtifacts) assert.equal(hash(p.path), p.sha256);
const failed = relatedFrozen.failedV1FreezePreserved;
assert.equal(hash(failed.path), failed.sha256);
for (const c of read(failed.path).code) assert.equal(hash(c.path), c.sha256);
const source = readFileSync(frozen.sourcePath, "utf8"), relatedSource = readFileSync(relatedFrozen.sourcePath, "utf8");
// Independent fixed native context refs for the retained authenticated documents.
// No production source extractor, financial engine, grid or reverse solver imported.
function native(xml: string, cik: string, name: string, ref: string) {
  const c = xml.match(new RegExp(`<xbrli:context\\b[^>]*id="${ref}"[^>]*>([\\s\\S]*?)</xbrli:context>`))?.[1];
  assert.ok(c?.includes(`>${cik}</xbrli:identifier>`));
  const rows = Array.from(xml.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/g))
    .filter(m => m[1].includes(`name="${name}"`) && m[1].includes(`contextRef="${ref}"`) && m[1].includes('unitRef="usd"'))
    .map(m => Number(m[2].replace(/<[^>]*>/g, "").replace(/,/g, "")) *
      10 ** Number(m[1].match(/scale="([^"]+)"/)?.[1] ?? 0) * (m[1].includes('sign="-"') ? -1 : 1));
  assert.equal(new Set(rows).size, 1); return rows[0];
}
const plain = (x: string) => x.replace(/<[^>]*>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
const s = plain(source), c = (name: string, ref: string) => native(source, "0001274494", name, ref);
const specific = Number(s.match(/During the year ended December 31, 2024, we recognized \$\s*([\d.]+) million of Section 45X credits/)![1]) * 1e6;
const allIncome = c("us-gaap:GovernmentAssistanceAmount", "c-121") + c("us-gaap:GovernmentAssistanceAmount", "c-124") +
  c("us-gaap:GovernmentAssistanceAmount", "c-127");
const grantCfo = -c("fslr:IncreaseDecreaseInGovernmentGrantsReceivable", "c-1");
const supplemental = c("fslr:ProceedsToBeReceivedFromAssetBasedGovernmentGrants", "c-1");
const assetChange = c("us-gaap:GovernmentAssistanceAmountCumulativeNoncurrent", "c-117") +
  c("us-gaap:GovernmentAssistanceAmountCumulativeNoncurrent", "c-119") -
  c("us-gaap:GovernmentAssistanceAmountCumulativeNoncurrent", "c-118") -
  c("us-gaap:GovernmentAssistanceAmountCumulativeNoncurrent", "c-120");
const report = read(latest.reportPath), calc = report.calculation;
assert.equal(calc.reportedSpecific45xCostSalesUsd, specific);
assert.equal(calc.allIncomeGrantBenefitsUsd, allIncome);
assert.equal(calc.incomeScopeDifferenceUsd, allIncome - specific);
assert.equal(calc.deliberatelyMixedScopeResidualUsd, specific + grantCfo - calc.selectedCashUsd);
assert.equal(calc.noncashSupplementCurrentUsd, supplemental);
assert.equal(calc.assetBenefitStockChangeUsd, assetChange);
assert.equal(calc.incomeScopeDifferenceUsd + calc.deliberatelyMixedScopeResidualUsd, 8721000);
assert.equal(calc.bookCfoMinusAssetBenefitChangeUsd, 19676000 - assetChange);
assert.equal(calc.cashAdjustmentAppliedUsd, 0); assert.equal(calc.unallocatedResidualFullyResolved, false);
assert.equal(report.protectedOriginalAnnualRows, 32);
const old = read(frozen.protectedArtifacts[0].path);
assert.deepEqual(old.cases.map((x: any) => x.conditionalIntegratedWholeEquityUsd), [5993041906.14639, 6193642869.902596]);
assert.ok(old.cases.every((x: any) => x.referenceDate === "2025-02-21" && x.terminalUnchanged));
const r = (name: string, ref: string) => native(relatedSource, "0001603145", name, ref);
const related = read(relatedLatest.reportPath).calculation;
assert.equal(r("us-gaap:PaymentsOfCapitalDistribution", "c-1") -
  r("us-gaap:LimitedPartnersCapitalAccountDistributionAmount", "c-1") -
  r("xplr:RelatedPartyDistributions", "c-1"), 0);
assert.equal(related.grossDistributionsInNeeIndirectOwnershipCategoryUsd, r("xplr:RelatedPartyDistributions", "c-98"));
const relatedText = plain(relatedSource);
const table = relatedText.slice(relatedText.indexOf("Details of the activity in noncontrolling interests"));
const year = table.slice(table.indexOf("Balances, December 31, 2023") + "Balances, December 31, 2023".length,
  table.indexOf("Balances, December 31, 2024"));
const value = (caption: string, next: string) => {
  const row = year.slice(year.indexOf(caption) + caption.length, next ? year.indexOf(next) : undefined)
    .replace(/\(\s*([\d,]+)\s*\)/g, "-$1").trim().split(/\s+/);
  return Number(row[2].replace(/,/g, "")) * 1e6;
};
const note = value("Related party note receivable", "Net income (loss) attributable to noncontrolling interests");
const income = value("Net income (loss) attributable to noncontrolling interests", "Related party contributions");
const other = value("Other – net", "");
assert.equal(note, relatedFrozen.source.neeCategoryNoteReceivableMovement);
assert.equal(income, relatedFrozen.source.neeCategoryIncome);
assert.equal(other, relatedFrozen.source.neeCategoryOtherEquityMovement);
assert.equal(r("us-gaap:MinorityInterest", "c-95") + note + income + r("xplr:RelatedPartyContributions", "c-98") -
  r("xplr:RelatedPartyDistributions", "c-98") + other, r("us-gaap:MinorityInterest", "c-105"));
assert.equal(related.distributionsLessContributionIsCertifiedNetCash, false);
assert.equal(related.exactSubsetOfNee811mOperatingAffiliateCashUsd, null);
assert.equal(related.futureCommonCashAddedUsd, 0);
const fslr = getConditionalCompanySummary("FSLR").companies[0], nee = getConditionalCompanySummary("NEE").companies[0];
assert.equal(fslr.facts.find(f => f.id === "grantScopeReported45x")!.value, specific);
assert.equal(fslr.facts.find(f => f.id === "grantScopeNoncashSupplement")!.value, supplemental);
assert.equal(nee.facts.find(f => f.id === "relatedPartnerGrossDistributions")!.value, related.grossDistributionsInNeeIndirectOwnershipCategoryUsd);
const llcLatest = read(`${root}/nee-related-followup/llc-claims-latest.json`);
assert.equal(hash(llcLatest.freezePath), llcLatest.freezeSha256);
assert.equal(hash(llcLatest.reportPath), llcLatest.reportSha256);
const llcFrozen = read(llcLatest.freezePath), llc = read(llcLatest.reportPath);
for (const x of [...llcFrozen.sourceFiles, llcFrozen.annual, ...llcFrozen.code]) assert.equal(hash(x.path), x.sha256);
const renewalText = plain(readFileSync(llcFrozen.sourceFiles[0].path, "utf8"));
const clause = renewalText.slice(renewalText.indexOf("5.01 Monthly Cash Distributions ."),
  renewalText.indexOf("5.02 Distributions of Amounts Other than Available Cash ."));
assert.ok(clause.includes("forty percent (40%)"));
assert.ok(clause.includes("maximum of twenty-five percent (25%)"));
assert.ok(renewalText.includes("Flip Date means June 11, 2025"));
// Independent external-claim formulation, not the production allocation function.
const outsideB = .99 * .7, divertedToOutside = Math.min(.4 * (.99 * .3), .25 * .99);
assert.ok(Math.abs(llc.post.xplrCashUsd - (1 - outsideB - divertedToOutside)) < 1e-12);
assert.ok(Math.abs(llc.pre.xplrCashUsd - (.95 + .05 * .3)) < 1e-12);
assert.equal(llc.unknown.status, "unresolved-source-inputs");
assert.equal(llc.actualAvailableCashOrCommonFcfeComputed, false);
const receipt = { validatedAt: new Date().toISOString(), sourceInputs: [latest, relatedLatest, llcLatest],
  sourceFiscalAndUnitContextCrosschecks: true, independentIncomeAndCashScopeIdentities: true,
  independentCounterpartyCashAndVisibleEquityIdentity: true, old32RowsAndTwoConditionalResultsBytePreserved: true,
  publicNewScalarBindingsVerified: 3, actualDeclaredLlcSourcesVerified: 2,
  independentSourceContractClaimIdentity: true,
  compilerOnlyLoggingRepair: { path: "script/run-fslr-grant-scope.ts",
    currentSha256: hash("script/run-fslr-grant-scope.ts"), historicalHashExactlyReconstructed: true,
    financialCodeOrOutputsChanged: false, oldCalculationNotRerun: true },
  originalQualifiedIssuers: 0, rawPrivateExport: false, oldFinancialKernelExecutions: 0 };
writeFileSync(`${root}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ privateValidation: "pass", publicNewScalarBindingsVerified: 3,
  independentCashEquityAndScopeIdentities: 5, declaredLlcSourcesVerified: 2, oldAnnualRowsBytePreserved: 32,
  originalQualifiedIssuers: 0, rawPrivateExport: false, oldFinancialKernelExecutions: 0 }));
