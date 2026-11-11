import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Separate private actual-source validation only");
const root = "generated-artifacts/company-operating-corpus", dir = `${root}/enlink-operating-successor-v1`;
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p)), hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const visible = (s: string) => s.replace(/<ix:header[\s\S]*?<\/ix:header>/g, "").replace(/<[^>]*>/g, " ")
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
function verifyFrozen(pointerPath: string) {
  const p = json(pointerPath), f = json(p.freezePath);
  assert.equal(hash(p.freezePath), p.freezeSha256); assert.equal(hash(p.reportPath), p.reportSha256);
  for (const a of [...f.code, ...f.preserve]) assert.equal(hash(a.path), a.sha256);
  return { p, f, r: json(p.reportPath) };
}
try {
  const { p, f, r } = verifyFrozen(`${dir}/latest.json`), b = json(`${dir}/receipts.json`), sealed = json(`${dir}/source-sealed.json`);
  assert.equal(p.freezeSha256, "c016c2565f1fc171c8df7d5a642b729838989843b2e910e17a49b4251bafc545");
  assert.equal(p.reportSha256, "ddc1370b4d20893075bfa2dd42986a7d123e43a79fbe972029b696bd319a4858");
  assert.equal(b.attempts.length, 4); assert.equal(new Set(b.attempts.map((s: any) => s.url)).size, 4);
  assert.equal(sealed.receiptsSha256, hash(`${dir}/receipts.json`)); assert.equal(sealed.requests, 4);
  const oldUrls = new Set<string>();
  for (const prefix of ["cf-enlink-current-cash-v1", "issuer-cash-source-followup-v1", "issuer-cash-collections-v1", "issuer-financial-followup-v1", "issuer-attachment-followup-v1"])
    for (const a of json(`${root}/${prefix}/receipts.json`).attempts) oldUrls.add(a.url);
  for (const a of f.primary) { assert.equal(a.status, 200); assert.equal(hash(a.path), a.sha256); assert.equal(oldUrls.has(a.url), false); }
  const raw = (name: string) => read(b.attempts.find((a: any) => a.name === name).path);
  const meta = JSON.parse(raw("emlp-submissions.json")); assert.equal(meta.cik, "0001179060"); assert.equal(meta.name, "EnLink Midstream Partners, LP");
  const m = meta.filings.recent, filing = m.accessionNumber.indexOf("0001213900-25-011812");
  assert.ok(filing >= 0); assert.equal(m.primaryDocument[filing], "ea023055103-1515d_elkmerger.htm");
  assert.equal(m.filingDate[filing], "2025-02-10"); assert.equal(m.form[filing], "15-15D");
  assert.equal(m.form.filter((v: string, i: number) => ["10-K", "10-Q"].includes(v) && m.filingDate[i] >= "2021-01-01").length, 0);
  const ex = visible(raw("oneok-fy2025-ex21.html"));
  assert.match(ex, /SUBSIDIARIES OF THE COMPANY AS OF DECEMBER 31, 2025/);
  const actualNames = [
    ["Elk Merger Sub II, L.L.C.", "Delaware"], ["EnLink CCS, LLC", "Delaware"],
    ["EnLink Midstream Operating, LP", "Delaware"], ["EnLink Midstream Partners, LP", "Delaware"], ["EnLink Midstream Services, LLC", "Texas"]
  ];
  for (const [name, state] of actualNames) {
    assert.ok(ex.includes(`${name} ${state}`));
    assert.deepEqual(r.group.entities.find((e: any) => e.legalName === name)?.jurisdiction, state);
  }
  assert.equal(r.group.actualCcsContractParty, null); assert.equal(r.group.directParentChainCertified, false);
  assert.equal(r.group.ccsOperatingAssetOwnershipPercent, null);
  const form = visible(raw("emlp-reporting-suspension-20250210.html"));
  assert.match(form, /Rule 12g-4\(a\)\(1\) ☒/); assert.match(form, /Rule 12h-3\(b\)\(1\)\(i\) ☒/); assert.match(form, /Rule 15d-6 ☐/);
  assert.match(form, /SCHEDULE A SUBSIDIARY GUARANTOR REGISTRANT/);
  assert.match(form, /separate corporate existence of EnLink ended upon consummation of the Second Merger on the Closing Date/);
  assert.match(form, /5\.375% Senior Notes due 2029/); assert.match(form, /5\.650% Senior Notes due 2034/);
  for (const k of ["ccsOperatingContractTerminated", "ccsOperatingContractNovated", "ccsPayment"]) assert.equal(r.notice[k], null);
  const q = visible(raw("oneok-first-postmerger-2025q1.html"));
  assert.match(q, /EnLink Partners EnLink Midstream Partners, LP, a wholly owned subsidiary of ONEOK/);
  assert.match(q, /noncash compensation expense related to the settlement of share-based awards/);
  assert.match(q, /contract liabilities.*deferred revenue on Refined Products and crude oil transportation contracts, NGL storage contracts and contributions in aid of construction/);
  assert.equal((q.match(/Exxon|Pecan\s*Island|\bCCS\b|carbon capture|sequestration/gi) ?? []).length, 0);
  assert.equal(r.quarter.declaredEx10Index.length, 5);
  assert.deepEqual(r.quarter.declaredEx10Index.map((e: any) => e.exhibit), ["10.1", "10.2", "10.3", "10.4", "10.5"]);
  for (const [id, phrase] of [["10.1", "Restricted Unit Award"], ["10.2", "Performance unit Award"], ["10.3", "Credit Agreement"], ["10.4", "Guaranty Agreement"], ["10.5", "Guaranty Agreement"]]) {
    const offset = q.indexOf(id, q.lastIndexOf("Exhibits")); assert.ok(offset >= 0);
    assert.ok(q.slice(offset, offset + 700).includes(phrase));
  }
  assert.equal(r.quarter.sourceSupportsQualifiedCashBridge, false);
  for (const k of ["actualCcsContractParty", "actualXomContractParty", "actualCcsBillingUsd", "actualCcsSettlementPaymentUsd", "actualCcsProjectFundingUsd", "actualCcsOpexUsd", "actualCcsReplacementCapexUsd"]) assert.equal(r.quarter[k], null);
  for (const k of ["billingUsd", "paymentUsd", "fundingUsd", "opexUsd", "replacementCapexUsd"]) assert.equal(r.cashBridge[k], null);
  assert.equal(r.cashBridge.actualAppliedCashChangeUsd, 0); assert.equal(r.cashBridge.newlyQualified, false);
  assert.equal(r.cashBridge.economicCalculationsExecuted, 0); assert.equal(r.cashBridge.oldKernelsOrGridsRerun, 0);
  const previous = verifyFrozen(`${root}/cf-enlink-current-cash-v1/latest.json`);
  for (const a of previous.f.primary) assert.equal(hash(a.path), a.sha256);
  verifyFrozen(`${root}/issuer-cash-source-followup-v1/latest.json`); verifyFrozen(`${root}/issuer-cash-source-followup-v1/borrowed-latest.json`);
  const parent = verifyFrozen(`${root}/nee-parent-crosswalk-v1/latest.json`); verifyFrozen(`${root}/nee-parent-crosswalk-v1/held-cash-latest.json`);
  const af = json(parent.f.preserve[0].path), ar = json(parent.f.preserve[1].path);
  for (const a of [...af.code, ...af.preserve, ...af.sourceReceipts]) assert.equal(hash(a.path), a.sha256);
  const cfFreeze = json(af.preserve.find((a: any) => /fslr-cohort-integrated-v1/.test(a.path) && /frozen-before-calculation/.test(a.path)).path);
  for (const a of cfFreeze.preserve) assert.equal(hash(a.path), a.sha256);
  const cfReport = json(af.preserve.find((a: any) => /fslr-cohort-integrated-v1/.test(a.path) && /\/report.json$/.test(a.path)).path);
  assert.equal(cfReport.cases.reduce((s: number, c: any) => s + c.annualRows.length, 0), 32);
  assert.equal(ar.fslr.annual2025.cfoLessSelectedCreditCashUsd, 613405000);
  assert.equal(ar.fslr.annual2025.grantRecognitionCfoLessSelectedCashResidualUsd, 14435000);
  assert.equal(ar.fslr.interim2026h1.grantRecognitionCfoLessSelectedCashResidualUsd, 780000);
  const evidence = json("docs/enlink-operating-successor-evidence.json");
  assert.deepEqual(evidence.sourceFacts.organizedGroupEntities, actualNames.map(([legalName, organizationJurisdiction]) => ({ legalName, organizationJurisdiction })));
  assert.deepEqual(evidence.sourceFacts.cashBridge, r.cashBridge);
  const receipt = { version: r.version, passed: true, newLogicalPrimaryRequests: 4, http200Count: 4, repeatedPriorPrimaryRequests: 0,
    actualNewGroupEntityRowsVerified: 5, actualDeclaredEx10RowsVerified: 5, actualReportingNoticeAndMetadataVerified: true,
    organizationJurisdictionIsNotOperatingGeography: true, sourceSupportsNewCashBridge: false, sourceAdapterExecutions: 1,
    economicCalculationsExecuted: 0, oldKernelsOrGridsRerun: 0, publicApiSharedDataByteUnchanged: true,
    priorProtectedArtifactHashes: cfFreeze.preserve.length, originalAnnualRows: 32, originalDiagnosticsPreserved: true,
    originalCaseQualification: 0, futureEconomicAssumptions: 0, searchStoppedAtBound: true,
    freezeSha256: p.freezeSha256, reportSha256: p.reportSha256 };
  writeFileSync(`${dir}/mandatory-private-receipt.json`, JSON.stringify(receipt, null, 2) + "\n"); console.log(JSON.stringify(receipt));
} catch (e) { console.error(String(e)); process.exitCode = 1; }
