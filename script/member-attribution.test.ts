import test from "node:test";
import assert from "node:assert/strict";
import { exactMemberAttribution } from "../server/calculation/memberAttribution";

test("exact attribution splits interactions, preserves member identities and is order independent", () => {
  const coalitions = [
    { groups: [], values: [10, 20] },
    { groups: ["a"], values: [12, 24] },
    { groups: ["b"], values: [13, 26] },
    { groups: ["a", "b"], values: [17, 34] },
  ];
  const input = { manifestId: "test-manifest", baselineId: "old-run", targetId: "new-run",
    unit: "degC", memberIds: ["m1", "m2"], groups: ["a", "b"], coalitions };
  const a = exactMemberAttribution(input);
  assert.deepEqual(a.contributions, [{ group: "a", values: [3, 6] }, { group: "b", values: [4, 8] }]);
  assert.equal(a.maxResidual, 0);
  assert.equal(a.approximationError, 0);
  assert.deepEqual(exactMemberAttribution({ ...input, groups: ["b", "a"],
    coalitions: [...coalitions].reverse().map(c => ({ ...c, groups: [...c.groups].reverse() })) }), a);
  assert.throws(() => exactMemberAttribution({ ...input, coalitions: coalitions.slice(1) }));
  assert.throws(() => exactMemberAttribution({ ...input, memberIds: ["m1", "m1"] }));
  assert.throws(() => exactMemberAttribution({ ...input, coalitions: [...coalitions, coalitions[0]] }));
  assert.throws(() => exactMemberAttribution({ ...input, coalitions: coalitions.map(c => ({ ...c, values: [NaN, 0] })) }));
});
