/**
 * Mandatory historical Git validation, not a public *.test.ts.
 * Missing revisions/blobs FAIL. Public records are declarations, not Git proof.
 * Run: npx tsx --test script/validate-valuation-rule-chronology-private.ts
 * Both original historical tests are retained verbatim below.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const evidence = JSON.parse(readFileSync("docs/valuation-rule-chronology-evidence.json", "utf8"));
const git = (...args: string[]) => execFileSync("git", args);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

test("S11-041 immutable rule hashes and later-result ancestry are real, not chronology repair", () => {
  const rule = evidence.ruleCommit;
  for (const [path, hash] of Object.entries(rule.sourceHashes))
    assert.equal(sha(git("show", `${rule.hash}:${path}`)), hash, path);
  const result = evidence.laterFirstRetainedPairedResult.resultDocumentCommit;
  for (const revision of [rule.hash, evidence.laterAsOfProtocol.initialCommit, evidence.laterAsOfProtocol.amendmentCommit])
    git("merge-base", "--is-ancestor", revision, result);
  for (const path of ["docs/Valuation_Comparison_Protocol.md", "script/compare-valuation-models.ts", "server/calculation/valuationComparison.ts"])
    assert.equal(sha(git("show", `${result}:${path}`)), rule.sourceHashes[path]);
  for (const [path, hash] of Object.entries(evidence.laterFirstRetainedPairedResult.resultCommitSourceHashes))
    assert.equal(sha(git("show", `${result}:${path}`)), hash, path);
  assert.equal(sha(git("show", `${evidence.laterAsOfProtocol.amendmentCommit}:${evidence.laterAsOfProtocol.amendedProtocolPath}`)),
    evidence.laterAsOfProtocol.amendedProtocolSha256);
});

test("S11-041 retains adverse FIRST ANY observation and explicitly unproven execution revision", () => {
  assert.equal(evidence.conclusion, "not-verified");
  const first = evidence.earliestRetainedAnyResultCandidate;
  assert.ok(Date.parse(first.filesystemMtime) < Date.parse(evidence.ruleCommit.committerDate));
  assert.equal(first.exactExecutingRevision, null);
  assert.match(first.timestampBasis, /not a signed execution/);
  assert.match(evidence.remainingGap, /precedes rule commit/);
  assert.match(evidence.laterFirstRetainedPairedResult.decisionPreserved, /Gordon remains primary/);
});
