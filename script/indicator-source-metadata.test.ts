import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  admitIndicatorSourceMetadataProposal, indicatorSourceDocuments, indicatorSourceMetadataProposal,
} from "../server/calculation/indicatorSourceMetadata";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";
import { INDICATORS } from "../server/dataIngestion/indicatorRegistry";
import { HISTORICAL_INDICATORS } from "../server/calculation/historicalIndicators";

const evidence = JSON.parse(readFileSync("docs/indicator-source-fields-increment-evidence.json", "utf8"));

test("real registry exposes three bounded source-linked proposals without promotion or date substitution", () => {
  const rows = driverEvidenceRegistry();
  assert.equal(rows.length, 22);
  assert.deepEqual(rows.filter(row => row.sourceMetadataProposal).map(row => row.id).sort(),
    ["atmosphericCO2ppm", "co2GrowthRatePpm", "sacrificeWillingnessPct"].sort());
  for (const row of rows) {
    assert.equal(row.informationAvailableAt, null);
    assert.equal(row.admission, "not-admitted");
    assert.equal(row.centralModelEligible, false);
    assert.equal(row.uncertainty.status, "unavailable");
    assert.equal(row.licence.status, "review-required");
    if (!row.sourceMetadataProposal) continue;
    const proposal = row.sourceMetadataProposal;
    assert.equal(proposal.registeredPublisher, INDICATORS.find(d => d.key === row.id)?.source);
    assert.equal(proposal.ownerReview, "pending-not-requested");
    assert.equal(proposal.admission, "metadata-proposal-only");
    assert.equal(proposal.originalObservationAvailableAt, null);
    assert.equal(proposal.originalVintage, null);
    assert.equal(proposal.scope, "source-product-metadata-only");
    assert.ok(proposal.documents.every(document => /^[a-f0-9]{64}$/.test(document.sha256)));
  }
});

test("admission rejects unknown keys, publisher substitution, source swaps, fabricated dates and review/promotion", () => {
  const { admission, documents, captureHashMeaning, evidencePath, ...proposal } = indicatorSourceMetadataProposal("co2GrowthRatePpm")!;
  assert.equal(admitIndicatorSourceMetadataProposal(proposal).indicatorKey, "co2GrowthRatePpm");
  for (const patch of [
    { indicatorKey: "notAnIndicator" }, { registeredPublisher: "Other provider" },
    { indicatorKey: "gdpTrillionUSD", registeredPublisher: "World Bank" },
    { sourceRelationship: "unconfirmed-survey-candidate" },
    { originalObservationAvailableAt: "2026-10-09" }, { originalVintage: documents[0].sha256 },
    { ownerReview: "approved" }, { centralModelEligible: true }, { newCausalCoefficient: 1 },
  ]) assert.throws(() => admitIndicatorSourceMetadataProposal({ ...proposal, ...patch }));
  for (const sourceIds of [["pew-method"], ["invented-archive"], []]) {
    assert.throws(() => admitIndicatorSourceMetadataProposal({
      ...proposal, fields: { ...proposal.fields, uncertainty: { ...proposal.fields.uncertainty, sourceIds } },
    }));
  }
  assert.throws(() => admitIndicatorSourceMetadataProposal({
    ...proposal, fields: { ...proposal.fields, informationAvailability: { ...proposal.fields.informationAvailability, status: "source-product-qualified" } },
  }));
  const survey = indicatorSourceMetadataProposal("sacrificeWillingnessPct")!;
  const { admission: a, documents: d, captureHashMeaning: c, evidencePath: p, ...surveyInput } = survey;
  assert.throws(() => admitIndicatorSourceMetadataProposal({
    ...surveyInput, fields: { ...surveyInput.fields, uncertainty: { ...surveyInput.fields.uncertainty, status: "source-product-qualified" } },
  }));
});

test("full original retained window shows why source uncertainties are not applied to curated growth", () => {
  const sourceRows: number[][] = evidence.fullWindowComparison.sourceRows;
  assert.deepEqual(sourceRows.map(row => row[0]), HISTORICAL_INDICATORS.map(row => row.year));
  assert.equal(sourceRows.length, 16);
  let growthMismatches = 0;
  const annualMismatchYears: number[] = [];
  for (const [year, mean, uncertainty, growth, growthUncertainty] of sourceRows) {
    const retained = HISTORICAL_INDICATORS.find(row => row.year === year)!;
    assert.equal(uncertainty, 0.12);
    assert.equal(growthUncertainty, 0.11);
    if (Math.round(mean * 10) / 10 !== retained.atmosphericCO2ppm) annualMismatchYears.push(year);
    if (Math.round(growth * 100) / 100 !== retained.co2GrowthRatePpm) growthMismatches++;
  }
  assert.equal(growthMismatches, evidence.fullWindowComparison.expectedGrowthMismatchCount);
  assert.deepEqual(annualMismatchYears, [2021, 2022, 2025]);
});

test("public receipt matches all eight real extraction hashes and field counts; untouched source inventory remains unchanged", () => {
  assert.deepEqual(evidence.acquisition.attempts.map(({ id, url, sha256, bytes }: typeof indicatorSourceDocuments[number]) =>
    ({ id, url, sha256, bytes })), indicatorSourceDocuments);
  const fields = INDICATORS.flatMap(d => {
    const proposal = indicatorSourceMetadataProposal(d.key);
    return proposal ? Object.values(proposal.fields) : [];
  });
  assert.equal(fields.length, 15);
  for (const [status, count] of [
    ["source-product-qualified", 8], ["candidate-only", 4], ["attempted-unavailable", 3],
  ] as const) assert.equal(fields.filter(field => field.status === status).length, count);
  for (const [path, hash] of Object.entries(evidence.preservedHashes)) {
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), hash, path);
  }
});

test("returned proposals and source documents cannot mutate later registry calls", () => {
  const proposal = indicatorSourceMetadataProposal("atmosphericCO2ppm")!;
  proposal.fields.uncertainty.finding = "tampered";
  proposal.fields.uncertainty.sourceIds.push("invented");
  proposal.documents[0].url = "https://example.invalid" as typeof proposal.documents[0]["url"];
  const next = indicatorSourceMetadataProposal("atmosphericCO2ppm")!;
  assert.notEqual(next.fields.uncertainty.finding, "tampered");
  assert.ok(!next.fields.uncertainty.sourceIds.includes("invented"));
  assert.notEqual(next.documents[0].url, "https://example.invalid");
});
