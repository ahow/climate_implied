import { z } from "zod";
import { contentHash } from "./analysisManifest";
const specification = z.object({
  model: z.string().min(1), peer: z.string().min(1), target: z.string().min(1),
}).strict();
const endpointNames = ["evaluation-r2", "signal-ic", "after-cost-long-short"] as const;
const hypothesis = specification.extend({ endpoint: z.enum(endpointNames) });
const result = hypothesis.extend({
  estimate: z.number().finite(), improvement95: z.tuple([z.number().finite(), z.number().finite()]),
  oneSidedP: z.number().finite().min(0).max(1),
}).strict();
const key = (r: z.infer<typeof hypothesis>) => JSON.stringify([r.model, r.peer, r.target, r.endpoint]);
const specKey = (r: z.infer<typeof specification>) => JSON.stringify([r.model, r.peer, r.target]);

/** Frozen full-family adjudication; unavailable tests remain in the denominator. */
export function adjudicateResearchFamily(input: unknown) {
  const p = z.object({
    protocolId: z.string().regex(/^[a-f0-9]{64}$/),
    specifications: z.array(specification).min(1).max(1000),
    results: z.array(result).max(3000),
  }).strict().parse(input);
  if (new Set(p.specifications.map(specKey)).size !== p.specifications.length)
    throw new Error("Duplicate prespecified specification");
  const tests = p.specifications.flatMap(s => endpointNames.map(endpoint => ({ ...s, endpoint })));
  const declared = new Set(tests.map(key));
  const scored = new Map<string, z.infer<typeof result>>();
  for (const r of p.results) {
    if (!declared.has(key(r))) throw new Error("Result outside frozen family");
    if (scored.has(key(r))) throw new Error("Duplicate result");
    if (r.improvement95[0] > r.improvement95[1]) throw new Error("Reversed interval");
    scored.set(key(r), r);
  }
  const ordered = tests.map(t => ({ ...t, score: scored.get(key(t)) ?? null }))
    .sort((a, b) => (a.score?.oneSidedP ?? 1) - (b.score?.oneSidedP ?? 1) || key(a).localeCompare(key(b)));
  let previous = 0;
  const corrected = ordered.map((test, rank) => {
    previous = Math.max(previous, Math.min(1, (ordered.length - rank) * (test.score?.oneSidedP ?? 1)));
    return { ...test, holmP: previous,
      passed: test.score !== null && test.score.estimate > 0 && test.score.improvement95[0] > 0 && previous <= .05 };
  });
  return { protocolId: p.protocolId, inputHash: contentHash(p), familySize: tests.length,
    unavailableHypotheses: tests.length - scored.size, tests: corrected,
    specifications: p.specifications.map(s => {
      const matched = corrected.filter(t => specKey(t) === specKey(s));
      return { ...s, supported: matched.every(t => t.passed),
        label: matched.every(t => t.passed) ? "supported locked retrospective revised-history research" :
          matched.some(t => !t.score) ? "incomplete evidence" : "not supported for this specification" };
    }),
    investmentEvidence: false, automaticPromotionAllowed: false,
    limitations: ["This adjudicates supplied paired estimates, intervals and p-values; it does not compute or verify them.",
      "All three primary hypotheses and every prespecified model/peer/target remain in the correction family.",
      "Borrow, financing, FX, lifecycle and vintage limitations cannot be removed by a statistical pass."] };
}
