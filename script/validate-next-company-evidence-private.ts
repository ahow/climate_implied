/** Actual retained-byte/source evidence checks only; no forecast recalculation. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { contentHash } from "../server/calculation/analysisManifest";
import { assessSourcedCompanyCase } from "../server/calculation/companyCaseEvidence";

if (process.env.NODE_ENV === "production") throw new Error("Private development evidence validation only");
const root = "generated-artifacts/company-operating-corpus";
const output = `${root}/next-company-evidence`;
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const report = read(`${output}/report.json`);
const prior = read(`${root}/primary-filings/readiness-report.json`);
assert.equal(report.cases.length, 3);
let located = 0;
for (const c of report.cases) {
  const old = prior.cases.find((row: any) => row.facts.symbol === c.symbol);
  assert.equal(c.baseFcfe, old.baseFcfe);
  assert.equal(c.sourceHash, sha(`${root}/primary-filings/${c.symbol}-2024.pdf`));
  assert.equal(c.textHash, sha(`${root}/primary-filings/${c.symbol}-2024.txt`));
  const publication = c.publicationAttempt;
  assert.equal(publication.httpStatus, 200);
  assert.equal(publication.sha256, sha(publication.path));
  const primary = read(publication.path);
  assert.equal(String(primary.cik).padStart(10, "0"), old.facts.cik);
  const index = primary.filings.recent.accessionNumber.indexOf(c.financialPublicAvailability.accessionNumber);
  assert.ok(index >= 0);
  assert.equal(primary.filings.recent.form[index], "10-K");
  assert.equal(primary.filings.recent.reportDate[index], old.facts.fiscalEnd);
  assert.equal(primary.filings.recent.acceptanceDateTime[index], c.financialPublicAvailability.acceptanceDateTime);
  const lines = readFileSync(`${root}/primary-filings/${c.symbol}-2024.txt`, "utf8").split("\n");
  for (const row of c.incrementalFacts) {
    assert.equal(row.status, "retained-primary-row-located");
    const line = Number(row.locator.match(/line (\d+)$/)[1]);
    assert.ok(lines[line - 1].includes(row.label) && lines[line - 1].includes(row.token));
    assert.equal(row.amountUsd, row.amount * row.unit);
    located++;
  }
  const contract = read(`${output}/${c.symbol}-dependency-contract.json`);
  assert.equal(contract.assessmentMode, "prospective-conditional");
  assert.deepEqual(assessSourcedCompanyCase(contract).gaps, c.assessment.gaps);
  assert.ok(!c.assessment.gaps.some((g: string) => g.includes("freeze follows market reference")));
  assert.equal(c.assessment.status, "blocked", "Actual financial/stub/terminal/share dependencies remain absent");
}
assert.equal(located, 8);
const retained = report.retainedDistinctFslr;
assert.equal(sha(retained.reportPath), retained.reportHash);
assert.equal(sha(retained.freezePath), retained.freezeHash);
const fslr = read(retained.reportPath);
assert.equal(contentHash(readFileSync(fslr.source.path, "utf8")), retained.sourceHash);
assert.equal(fslr.annualRowsExecuted, 50);
assert.equal(retained.reexecuted, false);
assert.equal(report.actualMarketPairs, 0);
assert.equal(report.completeApprovedIssuerCases, 0);
console.log("Actual private evidence checks passed: 3 issuer primary-metadata identities/availability, 8 retained filing rows, unchanged FY2024 bridges, separate retained FSLR50 rows, and explicit remaining dependencies; no forecast rerun.");
