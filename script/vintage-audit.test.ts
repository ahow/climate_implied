import { test } from "node:test";
import assert from "node:assert/strict";
import { auditVintages } from "../server/calculation/vintageAudit";
const fixture = () => ({ companyId: 1, decisionDate: "2020-01-01", publicationDate: "2019-12-01",
  universeKnownAt: "2019-12-01", returnEnd: "2020-02-01", returnValue: .1,
  corporateActionsVerified: true, delistingTreatmentVerified: true });
test("complete declared evidence is not automatically certified", () => {
  const r = auditVintages([fixture()]); assert.equal(r.evidenceComplete, true); assert.equal(r.certified, false);
});
test("missing or future vintages and duplicated observations cannot pass", () => {
  const r = auditVintages([{ ...fixture(), publicationDate: null, universeKnownAt: "2021-01-01",
    returnValue: null, corporateActionsVerified: false }, fixture()]);
  assert.equal(r.evidenceComplete, false); assert.equal(r.counts.missingPublication, 1);
  assert.equal(r.counts.futureUniverse, 1); assert.equal(r.counts.duplicates, 1);
});
