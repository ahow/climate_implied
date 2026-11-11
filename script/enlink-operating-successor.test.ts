import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSuccessorReportingNotice, extractSuccessorSubsidiaryInventory, inspectFirstPostMergerQuarter } from "../server/calculation/enlinkOperatingSuccessorEvidence";
test("Synthetic subsidiary name and jurisdiction cannot certify operating counterparty/ownership/novation", () => {
  const rows = ["Elk Merger Sub II, L.L.C.", "EnLink CCS, LLC", "EnLink Midstream Operating, LP", "EnLink Midstream Partners, LP", "EnLink Midstream Services, LLC"]
    .map(n => `<tr><td>${n}</td><td>${n.includes("Services") ? "Texas" : "Delaware"}</td></tr>`).join("");
  const html = `ONEOK, Inc. SUBSIDIARIES OF THE COMPANY AS OF DECEMBER 31, 2025<table>${rows}</table>`, r = extractSuccessorSubsidiaryInventory(html);
  assert.equal(r.entities.length, 5); assert.equal(r.actualCcsContractParty, null); assert.equal(r.ccsOperatingAssetOwnershipPercent, null);
  assert.equal(r.directParentChainCertified, false); assert.equal(r.sourceSupportsQualifiedCashBridge, false);
  assert.throws(() => extractSuccessorSubsidiaryInventory(html.replace("EnLink CCS, LLC", "Unrelated LLC")), /Missing/);
  assert.throws(() => extractSuccessorSubsidiaryInventory(html.replace("DECEMBER 31, 2025", "DECEMBER 31, 2024")), /Wrong/);
});
test("Synthetic Form15 registration suspension is not operating CCS cancellation, novation or payment", () => {
  const html = "15-15D SCHEDULE A SUBSIDIARY GUARANTOR REGISTRANT Date: February 10, 2025 EnLink Midstream Partners, LP Delaware Elk Merger Sub II, L.L.C. separate corporate existence of EnLink ended upon consummation of the Second Merger Rule 12g-4(a)(1) ☒ Rule 12h-3(b)(1)(i) ☒";
  const r = extractSuccessorReportingNotice(html); assert.equal(r.ccsOperatingContractTerminated, null);
  assert.equal(r.ccsOperatingContractNovated, null); assert.equal(r.ccsPayment, null);
  assert.throws(() => extractSuccessorReportingNotice(html.replace("12h-3(b)(1)(i) ☒", "12h-3(b)(1)(i) ☐")), /selections/);
});
const syntheticQuarter = () => "ONEOK March 31, 2025 EnLink Partners EnLink Midstream Partners, LP, a wholly owned subsidiary of ONEOK noncash compensation expense related to the settlement of share-based awards " +
  ["10.1 Award Agreement", "10.2 Award Agreement", "10.3 Credit Agreement", "10.4 Guaranty Agreement", "10.5 Guaranty Agreement"].map(t => `<tr><td>${t}</td></tr>`).join("");
test("Synthetic awards/bank guarantees cannot turn into CCS settlement/project funding or current billing", () => {
  const r = inspectFirstPostMergerQuarter(syntheticQuarter());
  for (const k of ["actualCcsContractParty", "actualXomContractParty", "actualCcsBillingUsd", "actualCcsSettlementPaymentUsd", "actualCcsProjectFundingUsd", "actualCcsOpexUsd", "actualCcsReplacementCapexUsd"] as const) assert.equal(r[k], null);
  assert.equal(r.appliedOriginalCashAdjustmentUsd, 0); assert.equal(r.sourceSupportsQualifiedCashBridge, false);
  assert.equal(r.declaredEx10Index.filter(r => r.category === "corporate-bank-credit-or-guaranty").length, 3);
});
test("Synthetic named/new operating term or unexplained contract refuses rather than certifying absence", () => {
  for (const term of ["ExxonMobil", "Pecan Island", "carbon capture", "CCS"])
    assert.throws(() => inspectFirstPostMergerQuarter(syntheticQuarter() + term), /requires substantive manual review/);
  assert.throws(() => inspectFirstPostMergerQuarter(syntheticQuarter().replace("10.5 Guaranty Agreement", "10.5 Operating fee agreement")), /manual review/);
});
