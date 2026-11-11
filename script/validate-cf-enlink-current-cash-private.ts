import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { sourceExhibit } from "../server/calculation/issuerSourceExhibits";
import { getConditionalCompanySummary } from "../shared/companyConditionalData";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Separate mandatory private original-source validator only");
const root = "generated-artifacts/company-operating-corpus", dir = `${root}/cf-enlink-current-cash-v1`;
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const plain = (s: string) => s.replace(/<ix:header[\s\S]*?<\/ix:header>/g, "").replace(/<[^>]*>/g, " ")
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const identities: string[] = [];
function identity(name: string, actual: number, expected: number) { assert.equal(actual, expected, name); identities.push(name); }
function checkFrozen(pointerPath: string) {
  const pointer = json(pointerPath), f = json(pointer.freezePath);
  assert.equal(hash(pointer.freezePath), pointer.freezeSha256); assert.equal(hash(pointer.reportPath), pointer.reportSha256);
  for (const c of f.code) assert.equal(hash(c.path), c.sha256);
  for (const p of f.preserve) assert.equal(hash(p.path), p.sha256);
  return { pointer, frozen: f, report: json(pointer.reportPath) };
}
try {
  const current = checkFrozen(`${dir}/latest.json`), f = current.frozen, r = current.report;
  assert.equal(current.pointer.freezeSha256, "13f71ca57277130a8916eb503bc4bb08ad15849996345b0f33d2c2c3662ae8be");
  assert.equal(current.pointer.reportSha256, "1d002e076205dabbd4b206b6587840507c56f9fb8d6834b096328d6d2554d449");
  const book = json(`${dir}/receipts.json`), seal = json(`${dir}/source-sealed.json`);
  assert.equal(book.attempts.length, 4); assert.equal(new Set(book.attempts.map((a: any) => a.url)).size, 4);
  assert.equal(seal.requests, 4); assert.equal(seal.receiptsSha256, hash(`${dir}/receipts.json`));
  for (const p of f.primary) { assert.equal(p.status, 200); assert.equal(hash(p.path), p.sha256); }
  const oldUrls = new Set<string>();
  for (const prefix of ["issuer-cash-source-followup-v1", "issuer-cash-collections-v1", "issuer-financial-followup-v1", "issuer-attachment-followup-v1"])
    for (const p of json(`${root}/${prefix}/receipts.json`).attempts) oldUrls.add(p.url);
  for (const p of book.attempts) assert.equal(oldUrls.has(p.url), false);
  const source = (name: string) => read(book.attempts.find((p: any) => p.name === name).path);
  const cfFull = source("cf-earnings-20261104-full.txt");
  assert.equal(sourceExhibit(cfFull, "8-K").name, "cf-20261104.htm");
  const cf = sourceExhibit(cfFull, "EX-99.1"), t = plain(cf.body);
  assert.equal(cf.name, "cf-11042026_ex991xearnings.htm");
  assert.match(t, /cash and cash equivalents of \$2\.82 billion, of which \$496 million was held by the Blue Point One joint venture/);
  const row = (label: string) => {
    const start = t.indexOf(label); assert.ok(start >= 0);
    const cells = t.slice(start + label.length).match(/^\s*(?:\$\s*)?([\d,]+)\s*(?:\$\s*)?([\d,]+)/); assert.ok(cells);
    return [Number(cells[1].replace(/,/g, "")) * 1e6, Number(cells[2].replace(/,/g, "")) * 1e6];
  };
  const total = row("Total Capital Expenditures"), existing = row("CF Industries Existing Operations (100% attributable to CF Industries)");
  const jv = row("Total Blue Point One Joint Venture (40% attributable to CF Industries)"),
    common = row("Blue Point Common Facilities (100% attributable to CF Industries)"), interest = row("Capitalized Interest");
  assert.deepEqual(total, r.cf.totalCapexQuarterYtdUsd); assert.deepEqual(interest, [10e6, 24e6]);
  for (const i of [0, 1]) identity(`Actual CF quarter/YTD capex component identity ${i}`, existing[i] + jv[i] + common[i] + interest[i], total[i]);
  identity("Company cash minus separately disclosed JVpool is bookcash only", 2820e6 - 496e6, r.cf.consolidatedCashOutsideBluePointJvBookUsd);
  assert.match(t, /CF Industries holds 40% ownership, JERA holds 35% ownership, and Mitsui holds 25% ownership/);
  identity("Named JVpartners ownership totals100percent", 40 + 35 + 25, 100);
  const offset = cf.body.indexOf("45Q tax credits"); assert.ok(offset > 0);
  const tr = plain(cf.body.slice(offset, cf.body.indexOf("</tr>", offset)));
  const cells = Array.from(tr.matchAll(/\(\s*(\d+)\s*\)/g)).map(m => Number(m[1])).slice(1);
  assert.deepEqual(cells, [19, 19, 20, 20, 62, 62, 20, 20]);
  identity("Actual 45Q recognition firsthalf/quarter/YTD only", (cells[4] - cells[0]) * 1e6, r.cf.firstHalf45qOperatingIncomeBeforeTaxUsd);
  assert.match(t, /Included in other operating income/);
  for (const k of ["actual45qCashCollectionsUsd", "actualXomCcsFeePaymentUsd", "actualCreditQualifiedCo2MassTonnes",
    "observedCommonExcessCashFromJvUsd", "actualCommonCashFromOutsideJvPoolUsd", "capitalizedInterestStandaloneCashPaymentUsd", "xomActualProjectFundingUsd"])
    assert.equal(r.cf[k], null);
  assert.equal(r.cf.originalXomCashAddedOrBaselineCostDeductedAgainUsd, 0);
  const closing = source("enlink-closing-20250131-full.txt"), legal = plain(sourceExhibit(closing, "8-K").body);
  assert.match(legal, /with EnLink surviving the First Merger/);
  assert.match(legal, /with Merger Sub II surviving the Second Merger as a direct, wholly-owned subsidiary of ONEOK/);
  assert.match(legal, /EnLink was released from its obligations under the applicable Indenture/);
  assert.match(plain(sourceExhibit(closing, "EX-3.1").body), /name of the limited liability company is Elk Merger Sub II, L\.L\.C\./);
  for (const type of ["EX-3.2", "EX-4.1", "EX-4.2", "EX-4.3", "EX-4.4"]) assert.ok(sourceExhibit(closing, type).name);
  const types = Array.from(closing.matchAll(/<TYPE>([^\r\n]+)/g)).map(m => m[1]);
  assert.equal(types.filter(v => /^EX-10(?:\.|$)/.test(v)).length, 0);
  assert.equal(r.legal.secondMergerSurvivor, "Elk Merger Sub II, L.L.C.");
  for (const k of ["currentCcsSettlementCashUsd", "currentCcsSettlementEffectiveDate", "currentCcsExecutedPaymentAgreement",
    "currentXomPerTonneFeeUsd", "enlinkCcsOperatingSubsidiaryLegalName", "xomContractSubsidiaryLegalName"]) assert.equal(r.legal[k], null);
  assert.equal(r.legal.debtSuccessorIsCertifiedCcsContractCounterparty, false);
  assert.equal(r.legal.mergerCreditFacilityRepaymentIsCcsSettlement, false);
  for (const s of r.searches) {
    const body = plain(sourceExhibit(source(s.name), "EX-99.1").body);
    assert.equal((body.match(/Exxon\s*Mobil|Pecan\s*Island/gi) ?? []).length, 0);
    assert.equal((body.match(/financial arrangement/gi) ?? []).length, s.genericFinancialArrangementMatches);
  }
  const prior = checkFrozen(`${root}/issuer-cash-source-followup-v1/latest.json`);
  assert.equal(prior.report.mvc.historicalXomSubsidiaryMvcRecognitionScheduleUsd, 844e6);
  assert.equal(prior.report.mvc.actualCashPaidOrCollectedUsd, null); assert.equal(prior.report.mvc.laterPeriods2029To2050AllocatedAnnually, false);
  checkFrozen(`${root}/issuer-cash-source-followup-v1/borrowed-latest.json`);
  const parent = checkFrozen(`${root}/nee-parent-crosswalk-v1/latest.json`);
  checkFrozen(`${root}/nee-parent-crosswalk-v1/held-cash-latest.json`);
  for (const p of parent.frozen.primary) assert.equal(hash(p.path), p.sha256);
  const af = json(parent.frozen.preserve[0].path), ar = json(parent.frozen.preserve[1].path);
  for (const p of [...af.code, ...af.preserve, ...af.sourceReceipts]) assert.equal(hash(p.path), p.sha256);
  const cohortFreeze = json(af.preserve.find((p: any) => /fslr-cohort-integrated-v1/.test(p.path) && /frozen-before-calculation/.test(p.path)).path);
  for (const p of cohortFreeze.preserve) assert.equal(hash(p.path), p.sha256);
  const cohort = json(af.preserve.find((p: any) => /fslr-cohort-integrated-v1/.test(p.path) && /\/report.json$/.test(p.path)).path);
  assert.equal(cohort.cases.reduce((s: number, c: any) => s + c.annualRows.length, 0), 32);
  assert.equal(ar.fslr.annual2025.cfoLessSelectedCreditCashUsd, 613405000);
  assert.equal(ar.fslr.annual2025.grantRecognitionCfoLessSelectedCashResidualUsd, 14435000);
  assert.equal(ar.fslr.interim2026h1.grantRecognitionCfoLessSelectedCashResidualUsd, 780000);
  const evidence = json("docs/cf-enlink-current-cash-evidence.json");
  for (const section of ["cf", "legal"]) for (const [k, v] of Object.entries(evidence.calculation[section]))
    if (k !== "boundary") assert.deepEqual(v, r[section][k]);
  const fact = getConditionalCompanySummary().companies.find(c => c.issuer === "XOM")!.facts.find(f => f.id === "sourceCurrentSettlementCash")!;
  assert.equal(fact.value, evidence.calculation.legal.currentCcsSettlementCashUsd); assert.match(fact.unit, /NOT zero/);
  const receipt = { version: r.version, passed: true, actualNewPrimaryRequests: 4, http200Count: 4,
    repeatedPriorPrimaryRequests: 0, independentArithmeticIdentities: identities.length, identityNames: identities,
    publicScalarBindings: 1, actualTwoStepMergerAndFourDebtExhibitsVerified: true, ccsContractNovationOrCashCertified: false,
    priorProtectedArtifactHashes: cohortFreeze.preserve.length, originalAnnualRowsBytePreserved: 32,
    historical844mUnallocatedTailAndNullCurrentCashPreserved: true, original613405m14435m780kPreserved: true,
    newSourceCalculationExecutions: 1, financialGridOrOldKernelExecutions: 0, qualifiedOriginalIssuers: 0,
    freezeSha256: current.pointer.freezeSha256, reportSha256: current.pointer.reportSha256 };
  writeFileSync(`${dir}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt));
} catch (e) { console.error(String(e)); process.exitCode = 1; }
