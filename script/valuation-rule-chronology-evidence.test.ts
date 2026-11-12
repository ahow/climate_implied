import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync("docs/valuation-rule-chronology-evidence.json", "utf8"));

// These checks validate portable public declarations, NOT authentic Git objects.
// The unchanged real Git assertions are mandatory in the separate private validator.
test("S11-041 public hash and declared lineage contracts are internally consistent, not authentic commit proof", () => {
  const rule = evidence.ruleCommit;
  assert.equal(Object.keys(rule.sourceHashes).length, 5);
  for (const [path, hash] of Object.entries(rule.sourceHashes))
    assert.match(String(hash), /^[a-f0-9]{64}$/, path);
  const later = evidence.laterFirstRetainedPairedResult;
  const protocol = evidence.laterAsOfProtocol;
  assert.equal(later.embeddedProtocolId, rule.sourceHashes["docs/Valuation_Comparison_Protocol.md"]);
  assert.equal(protocol.amendmentParent, protocol.initialCommit);
  assert.equal(later.resultDocumentParent, protocol.amendmentCommit);
  assert.equal(Object.keys(later.resultCommitSourceHashes).length, 2);
  for (const hash of Object.values(later.resultCommitSourceHashes))
    assert.match(String(hash), /^[a-f0-9]{64}$/);
  assert.match(protocol.amendedProtocolSha256, /^[a-f0-9]{64}$/);
  for (const revision of [rule.hash, protocol.initialCommit, protocol.amendmentCommit, later.resultDocumentCommit])
    assert.match(revision, /^[a-f0-9]{40}$/);
  assert.ok(Date.parse(rule.committerDate) < Date.parse(protocol.initialAuthorAndCommitterDate));
  assert.ok(Date.parse(protocol.initialAuthorAndCommitterDate) < Date.parse(protocol.amendmentAuthorAndCommitterDate));
  assert.ok(Date.parse(protocol.amendmentAuthorAndCommitterDate) < Date.parse(later.filesystemMtime));
  assert.ok(Date.parse(later.filesystemMtime) < Date.parse(later.resultDocumentAuthorAndCommitterDate));
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

test("S11-041 later paired success cannot repair FIRST ANY adverse/unknown chronology or authorize a refreeze", () => {
  const first = evidence.earliestRetainedAnyResultCandidate;
  const later = evidence.laterFirstRetainedPairedResult;
  assert.equal(Date.parse(evidence.ruleCommit.committerDate) - Date.parse(first.filesystemMtime), 356568);
  assert.ok(Date.parse(first.filesystemMtime) < Date.parse(later.filesystemMtime));
  assert.match(first.classification, /not paired model-scoring result/);
  assert.match(first.classification, /cannot silently be excluded/);
  assert.match(first.ordering, /chronology fails/);
  assert.match(first.limitation, /Absolute first-ever result time and exact precommit worktree remain unknown/);
  assert.match(first.limitation, /invented immutable proof/);
  assert.match(evidence.proposal, /partial\/unproven/);
  assert.match(evidence.proposal, /FIRST ANY/);
  assert.match(evidence.remainingGap, /Later paired-result ordering cannot repair/);
  assert.match(evidence.otherAnyResultsEvidence.observation, /not a separate execution-time receipt/);
  assert.match(later.sourceLimit, /Executing private worktree is not independently snapshotted/);
  assert.match(later.decisionPreserved, /Retained gate fails; reverse DCF not promoted/);
  assert.match(later.decisionPreserved, /No scoring, bootstrap, collection, refreeze, backdating or rerun/);
  assert.match(evidence.privacy, /Local mtimes are weaker than immutable execution receipts/);
});
