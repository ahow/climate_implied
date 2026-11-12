import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";
import { HISTORICAL_INDICATORS } from "../server/calculation/historicalIndicators";
import {
  admitIndicatorSourceMetadataProposal, indicatorSourceMetadataProposal,
} from "../server/calculation/indicatorSourceMetadata";

const evidence = JSON.parse(readFileSync("docs/remaining-source-inputs-evidence.json", "utf8"));
const newKeys = ["gdpTrillionUSD", "corporateTargetsPct", "corporateImplementationRate"] as const;

test("new primary documents are pinned in the real registry, with source qualification separate from curated admission", () => {
  const fields = [];
  const documents = new Map();
  for (const key of newKeys) {
    const row = driverEvidenceRegistry().find(row => row.id === key)!;
    const proposal = row.sourceMetadataProposal!;
    assert.ok(proposal);
    assert.equal(proposal.evidencePath, "docs/remaining-source-inputs-evidence.json");
    assert.equal(row.informationAvailableAt, null);
    assert.equal(row.admission, "not-admitted");
    assert.equal(row.centralModelEligible, false);
    assert.equal(row.uncertainty.status, "unavailable");
    assert.equal(row.licence.status, "review-required");
    assert.equal(row.regionalApplicability, "not-established");
    assert.equal(proposal.originalObservationAvailableAt, null);
    assert.equal(proposal.originalVintage, null);
    assert.equal(proposal.ownerReview, "pending-not-requested");
    assert.equal(proposal.centralModelEligible, false);
    fields.push(...Object.values(proposal.fields));
    for (const document of proposal.documents) documents.set(document.id, document);
  }
  assert.equal(documents.size, evidence.admission.newSourceDocuments);
  for (const document of documents.values()) {
    const receipt = evidence.acquisition.attempts.find((row: { id: string }) => row.id === document.id);
    assert.equal(receipt.status, 200);
    for (const field of ["url", "sha256", "bytes"]) assert.equal(document[field], receipt[field]);
  }
  for (const [status, count] of [
    ["source-product-qualified", 3], ["candidate-only", 6], ["attempted-unavailable", 6],
  ]) assert.equal(fields.filter(field => field.status === status).length, count);
});

test("new nominal GDP covers the entire untouched original window but cannot replace PPP Kaya or curated CO2/GDP", () => {
  const rows: number[][] = evidence.fullWindowAnalysis.sourceRows;
  assert.deepEqual(rows.map(row => row[0]), HISTORICAL_INDICATORS.map(row => row.year));
  assert.equal(rows.length, 16);
  assert.equal(new Set(rows.map(row => row[0])).size, 16);
  assert.ok(rows.every(([year, value]) => Number.isInteger(year) && Number.isFinite(value) && value > 0));
  const matches = rows.filter(([year, usd]) =>
    Math.round(usd / 1e12 * 10) / 10 === HISTORICAL_INDICATORS.find(row => row.year === year)!.gdpTrillionUSD);
  assert.equal(rows.length - matches.length, evidence.fullWindowAnalysis.expectedMismatchCount);
  assert.deepEqual(matches.map(row => row[0]), [2015]);
  assert.equal(evidence.newPhysicalInputAssessment.compatibleFrozenKayaInput, false);
  assert.match(indicatorSourceMetadataProposal("gdpTrillionUSD")!.fields.regionalApplicability.finding, /not frozen Kaya/);
  for (const [path, hash] of Object.entries(evidence.preservedHashes)) {
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash, path);
  }
});

test("candidate counts cannot become approved histories, implementation rates, dated vintages or foreign source admissions", () => {
  for (const key of newKeys) {
    const { admission, documents, captureHashMeaning, evidencePath, ...proposal } = indicatorSourceMetadataProposal(key)!;
    assert.equal(admitIndicatorSourceMetadataProposal(proposal).indicatorKey, key);
    for (const patch of [
      { registeredPublisher: "Other publisher" }, { originalObservationAvailableAt: "2025-12-31" },
      { originalVintage: documents[0].sha256 }, { ownerReview: "approved" },
      { centralModelEligible: true }, { coefficient: 0.4 },
    ]) assert.throws(() => admitIndicatorSourceMetadataProposal({ ...proposal, ...patch }));
    assert.throws(() => admitIndicatorSourceMetadataProposal({
      ...proposal, fields: { ...proposal.fields,
        licence: { ...proposal.fields.licence, sourceIds: ["noaa-rights"] } },
    }));
    if (key !== "gdpTrillionUSD") {
      assert.throws(() => admitIndicatorSourceMetadataProposal({
        ...proposal, sourceRelationship: "registered-product",
      }));
      assert.throws(() => admitIndicatorSourceMetadataProposal({
        ...proposal, fields: { ...proposal.fields,
          calibration: { ...proposal.fields.calibration, status: "source-product-qualified" } },
      }));
    } else {
      assert.throws(() => admitIndicatorSourceMetadataProposal({
        ...proposal, fields: { ...proposal.fields,
          informationAvailability: { ...proposal.fields.informationAvailability, status: "source-product-qualified" } },
      }));
    }
  }
  const implementation = indicatorSourceMetadataProposal("corporateImplementationRate")!;
  assert.match(implementation.fields.calibration.finding, /No measured numerator\/denominator/);
  implementation.fields.licence.sourceIds.push("invented");
  assert.ok(!indicatorSourceMetadataProposal("corporateImplementationRate")!.fields.licence.sourceIds.includes("invented"));
});

test("all bounded attempts reconcile including HTTP200 application error and access-denied non-admissions", () => {
  const attempts: { id: string; status: number; sha256: string; rawSha256: string }[] = evidence.acquisition.attempts;
  assert.equal(attempts.length, 14);
  assert.equal(new Set(attempts.map(row => row.id)).size, attempts.length);
  for (const row of attempts) {
    assert.match(row.sha256, /^[a-f0-9]{64}$/);
    assert.match(row.rawSha256, /^[a-f0-9]{64}$/);
  }
  for (const [status, count] of [[200, 9], [403, 4], [404, 1]]) {
    assert.equal(attempts.filter(row => row.status === status).length, count);
  }
  assert.equal(evidence.acquisition.http200ApplicationErrorPages, 1);
  for (const key of ["cleanEnergyInvestmentTrn", "fossilFuelInvestmentTrn", "greenBondIssuanceBln"] as const) {
    assert.equal(indicatorSourceMetadataProposal(key), null);
  }
});
