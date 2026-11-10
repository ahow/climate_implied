import assert from "node:assert/strict";
import { primaryCommonSharesSchema, reviewCompanyShareReference } from "../server/calculation/companyShareEvidence";

// Synthetic CI only; actual evidence is checked by the explicit private validator.
const shares = { symbol: "TEST", cik: "0000000001", issuer: "Synthetic issuer",
  effectiveDate: "2026-09-30", allCommonClassesCovered: true,
  classes: [{ security: "Synthetic common", outstanding: 90, issued: 100, treasury: 10, precision: "exact" }],
  evidence: { url: "https://example.invalid/filing", sha256: "a".repeat(64),
    capturedAt: "2026-11-10T09:00:00.000Z", publishedDate: "2026-10-01",
    publicationBasis: "issuer-filing-index", locator: "Synthetic fixture" } };
const quote = { symbol: shares.symbol, cik: shares.cik, security: "Synthetic common", priceDate: "2026-09-30" };
assert.equal(reviewCompanyShareReference(shares, quote).status, "blocked"); // future publication
const timely = { ...shares, evidence: { ...shares.evidence, publishedDate: "2026-09-30" } };
assert.equal(reviewCompanyShareReference(timely, quote).status, "candidate-requires-review");
assert.equal(reviewCompanyShareReference(timely, quote).identityApproved, false);
assert.equal(reviewCompanyShareReference(timely, { ...quote, priceDate: "2026-11-09" }).status, "blocked");
assert.equal(reviewCompanyShareReference(timely, { ...quote, cik: "0000000002" }).status, "blocked");
assert.equal(reviewCompanyShareReference({ ...timely, classes: [{ ...shares.classes[0], treasury: 0 }] }, quote).status, "blocked");
assert.equal(reviewCompanyShareReference({ ...timely, classes: [{ ...shares.classes[0], precision: "rounded-millions" }] }, quote).status, "blocked");
assert.equal(reviewCompanyShareReference({ ...timely, allCommonClassesCovered: false }, quote).status, "blocked");
assert.equal(reviewCompanyShareReference({ ...timely, evidence: { ...timely.evidence, publicationBasis: "signed-report-date" } }, quote).status, "blocked");
assert.throws(() => primaryCommonSharesSchema.parse({ ...timely, weightedAverageShsOut: 90 }));
assert.equal(reviewCompanyShareReference(timely, quote).source.evidence.capturedAt, shares.evidence.capturedAt);
console.log("Synthetic share evidence: date, publication, identity, treasury, class coverage, precision, no backdating/no approval checks passed.");
