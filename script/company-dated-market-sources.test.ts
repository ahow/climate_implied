import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { primaryDatedQuoteTargets, publicSourceReceipt } from "./company-dated-market-source-contract";

function fixture() {
  return { symbol: "TEST", cik: "0000000001", issuer: "Engineering fixture",
    effectiveDate: "2025-01-31", allCommonClassesCovered: true,
    classes: [{ security: "Engineering common", outstanding: 90, precision: "exact", issued: 100, treasury: 10 }],
    evidence: { url: "https://example.invalid/fixture", sha256: "a".repeat(64),
      capturedAt: "2026-11-10T12:00:00.000Z", publishedDate: "2025-02-14",
      publicationBasis: "issuer-filing-index", locator: "Engineering fixture, not actual shares" } };
}
test("Targets use exact primary effective dates, not later disclosure, quote carry-forward or EPS denominator", () => {
  const [target] = primaryDatedQuoteTargets([fixture()]);
  assert.equal(target.quoteDateRequired, "2025-01-31");
  assert.equal(target.primaryShares, 90);
  assert.equal(target.sharePublishedDate, "2025-02-14");
  assert.match(target.informationTreatment, /not known at that historical close/);
  assert.equal(target.identityApproved, false);
});
test("Shared ticker does not merge distinct predecessor/successor CIKs/classes", () => {
  const first = fixture(), second = { ...fixture(), cik: "0000000002", effectiveDate: "2026-09-30",
    classes: [{ ...fixture().classes[0], security: "Engineering successor common" }] };
  const targets = primaryDatedQuoteTargets([first, second]);
  assert.equal(targets.length, 2);
  assert.notEqual(targets[0].cik, targets[1].cik);
  assert.notEqual(targets[0].security, targets[1].security);
  assert.ok(targets.every(t => !t.automaticTickerJoin));
});
test("Rounded, float/incomplete classes, EPS-average substitutes and inconsistent treasury refuse", () => {
  const x = fixture();
  assert.throws(() => primaryDatedQuoteTargets([{ ...x, classes: [{ ...x.classes[0], precision: "rounded-millions" }] }]));
  assert.throws(() => primaryDatedQuoteTargets([{ ...x, allCommonClassesCovered: false }]));
  assert.throws(() => primaryDatedQuoteTargets([{ ...x, weightedAverageShsOut: 90 }]));
  assert.throws(() => primaryDatedQuoteTargets([{ ...x, classes: [{ ...x.classes[0], treasury: 0 }] }]), /reconcile/);
});
test("Public receipts are status/hash/date only, never raw quote fields, source URLs, headers or tokens", () => {
  const receipt = publicSourceReceipt({ id: "fixture", httpStatus: 403, sha256: "a".repeat(64),
    capturedAt: "2026-11-10T12:00:00.000Z", requestedQuoteDate: "2025-01-31",
    url: "https://example.invalid/?token=engineering-token", price: 99, shares: 90,
    headers: { Token: "engineering-token" }, body: "private fixture" });
  assert.deepEqual(Object.keys(receipt).sort(), ["capturedAt", "httpStatus", "id",
    "requestedQuoteDate", "sha256", "status"].sort());
  assert.ok(!JSON.stringify(receipt).includes("engineering-token"));
  assert.equal(receipt.status, "HTTP-403");
});
test("Private source workflow is fixed-source, no-retry and stops before dated data on denied access", () => {
  const source = readFileSync("script/assemble-company-dated-market-sources.ts", "utf8");
  assert.match(source, /receipts\.some\(r => r\.url === source\.url\)/);
  assert.match(source, /if \(response\.ok\)/);
  assert.match(source, /typeof access\?\.token === "string"/);
  assert.match(source, /quoteUrl\.searchParams\.set\("token", access\.token\)/);
  assert.match(source, /url: safeUrl/);
  assert.ok(!source.includes("fmpRequest("), "No unverified endpoint expansion/provider calls");
  assert.ok(!source.includes("process.env.FMP_API_KEY"), "Only existing provider helper may handle installed key");
  assert.ok(!source.includes("process.argv[2]"), "No arbitrary CLI URL transport");
});
