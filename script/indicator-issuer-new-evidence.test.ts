import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";
import {
  admitIndicatorSourceMetadataProposal, indicatorSourceMetadataProposal,
} from "../server/calculation/indicatorSourceMetadata";

const evidence = JSON.parse(readFileSync("docs/indicator-issuer-new-evidence.json", "utf8"));
const keys = ["policyCoveragePct", "policyImplementationRate"] as const;

test("new CAT source qualification reaches the actual registry without numerical or central admission", () => {
  const fields = [];
  const docs = new Map();
  for (const key of keys) {
    const row = driverEvidenceRegistry().find(row => row.id === key)!;
    const proposal = row.sourceMetadataProposal!;
    assert.ok(proposal);
    assert.equal(proposal.evidencePath, "docs/indicator-issuer-new-evidence.json");
    assert.equal(row.admission, "not-admitted");
    assert.equal(row.informationAvailableAt, null);
    assert.equal(row.centralModelEligible, false);
    assert.equal(row.licence.status, "review-required");
    assert.equal(row.uncertainty.status, "unavailable");
    assert.equal(proposal.originalObservationAvailableAt, null);
    assert.equal(proposal.originalVintage, null);
    assert.equal(proposal.ownerReview, "pending-not-requested");
    fields.push(...Object.values(proposal.fields));
    for (const doc of proposal.documents) docs.set(doc.id, doc);
  }
  assert.equal(docs.size, 3);
  for (const doc of docs.values()) {
    const receipt = evidence.acquisition.attempts.find((r: { id: string }) => r.id === doc.id);
    assert.equal(receipt.status, 200);
    for (const field of ["url", "sha256", "bytes"]) assert.equal(doc[field], receipt[field]);
  }
  for (const [status, count] of [
    ["source-product-qualified", 3], ["candidate-only", 2], ["attempted-unavailable", 5],
  ]) assert.equal(fields.filter(field => field.status === status).length, count);
  assert.match(indicatorSourceMetadataProposal("policyCoveragePct")!.fields.licence.finding, /NOT an open\/commercial licence/);
  assert.match(indicatorSourceMetadataProposal("policyImplementationRate")!.fields.calibration.finding, /Do not divide/);
});

test("CAT candidate cannot become delivered implementation, a dated curated vintage, approval or another publisher", () => {
  for (const key of keys) {
    const { admission, documents, captureHashMeaning, evidencePath, ...proposal } = indicatorSourceMetadataProposal(key)!;
    assert.equal(admitIndicatorSourceMetadataProposal(proposal).indicatorKey, key);
    for (const patch of [
      { registeredPublisher: "Net Zero Tracker" },
      { originalObservationAvailableAt: "2025-10-27" },
      { originalVintage: documents[0].sha256 },
      { ownerReview: "approved" }, { centralModelEligible: true }, { coefficient: 0.77 },
    ]) assert.throws(() => admitIndicatorSourceMetadataProposal({ ...proposal, ...patch }));
    assert.throws(() => admitIndicatorSourceMetadataProposal({
      ...proposal, fields: { ...proposal.fields,
        licence: { ...proposal.fields.licence, sourceIds: ["wb-rights"] } },
    }));
    assert.throws(() => admitIndicatorSourceMetadataProposal({
      ...proposal, sourceRelationship: key === "policyCoveragePct"
        ? "unconfirmed-publisher-candidate" : "registered-product",
    }));
    if (key === "policyImplementationRate") {
      assert.throws(() => admitIndicatorSourceMetadataProposal({
        ...proposal, fields: { ...proposal.fields,
          calibration: { ...proposal.fields.calibration, status: "source-product-qualified" } },
      }));
    }
  }
  const changed = indicatorSourceMetadataProposal("policyCoveragePct")!;
  changed.fields.licence.finding = "commercially approved";
  assert.notEqual(indicatorSourceMetadataProposal("policyCoveragePct")!.fields.licence.finding, changed.fields.licence.finding);
});

test("four actual receipts are distinct from tool preflight failures; issuer cash remains explicitly unresolved", () => {
  const acquisition = evidence.acquisition;
  assert.equal(acquisition.attempts.length, acquisition.actualLogicalNetworkRequests);
  assert.ok(acquisition.actualLogicalNetworkRequests <= acquisition.maximumLogicalNetworkRequests);
  assert.equal(new Set(acquisition.attempts.map((r: { url: string }) => r.url)).size, 4);
  for (const receipt of acquisition.attempts) {
    assert.equal(receipt.status, 200);
    assert.match(receipt.rawSha256, /^[a-f0-9]{64}$/);
    assert.match(receipt.sha256, /^[a-f0-9]{64}$/);
    assert.ok(receipt.rawBytes > receipt.bytes);
  }
  assert.equal(acquisition.toolPreflightFailures.length, 2);
  assert.ok(acquisition.toolPreflightFailures.every((r: { networkRequestMade: boolean }) => !r.networkRequestMade));
  const { NEE, FSLR, XOM } = evidence.issuerFieldAssessment;
  assert.equal(NEE.newSourceId, "nee-2026q3");
  assert.equal(NEE.newPositiveFields.nineMonthServiceCostsIncurredUsd, 120000000);
  for (const field of ["grossLlcCash", "cashRecipientLegalEntity", "marginalReturns"]) {
    assert.equal(NEE[field].value, null);
    assert.ok(NEE[field].exactNextInput);
  }
  assert.equal(NEE.actualServiceReimbursementCashUsd, null);
  assert.equal(NEE.costsMinusReceivableChangeTreatedAsCash, false);
  for (const issuer of [FSLR, XOM]) {
    assert.equal(issuer.newRequests, 0);
    assert.match(issuer.status, /^unattempted/);
    assert.equal(issuer.commonFcfeInsertedUsd, 0);
  }
  assert.equal(evidence.studyReadiness.newFrozenStudiesExecuted, 0);
  assert.equal(evidence.studyReadiness.qualifiedOriginalIssuers, 0);
  for (const [path, hash] of Object.entries(evidence.preservedHashes)) {
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash, path);
  }
});
