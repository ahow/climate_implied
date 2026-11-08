/** Pure research contracts; none of these functions promotes a live model. */
import { z } from "zod";

const finite = z.number().finite();
const ocfSchema = z.object({
  operatingCashFlow: finite, capex: finite.nonnegative(), netBorrowing: finite,
}).strict();
export function fcfeFromOperatingCashFlow(input: z.input<typeof ocfSchema>) {
  const x = ocfSchema.parse(input);
  return x.operatingCashFlow - x.capex + x.netBorrowing;
}
const earningsSchema = z.object({
  netIncome: finite, nonCashCharges: finite, capex: finite.nonnegative(),
  increaseWorkingCapital: finite, netBorrowing: finite,
}).strict();
export function fcfeFromEarnings(input: z.input<typeof earningsSchema>) {
  const x = earningsSchema.parse(input);
  return x.netIncome + x.nonCashCharges - x.capex - x.increaseWorkingCapital + x.netBorrowing;
}

/** Inverse empirical CDF. Censored observations remain in the denominator. */
function eventQuantile(events: number[], population: number, p: number) {
  const rank = Math.ceil(population * p);
  return rank > 0 && rank <= events.length ? events[rank - 1] : null;
}
export function summarizeNetZeroYears(input: (number | null)[], horizon: number) {
  z.number().int().min(2050).max(2300).parse(horizon);
  const years = z.array(z.number().int().min(1800).max(horizon).nullable()).min(1).max(100000).parse(input);
  const events = years.filter((x): x is number => x !== null).sort((a, b) => a - b);
  const quantiles = (population: number) => ({
    p10: eventQuantile(events, population, .1), median: eventQuantile(events, population, .5),
    p90: eventQuantile(events, population, .9),
  });
  return {
    horizon, members: years.length, ...quantiles(years.length),
    probabilityBy2050: events.filter(y => y <= 2050).length / years.length,
    neverReachedShare: (years.length - events.length) / years.length,
    conditionalOnReaching: { members: events.length, ...quantiles(events.length) },
    interpretation: "model-conditional; null quantiles are not established within the horizon",
  };
}

const memberSchema = z.array(z.object({ id: z.string().min(1), value: finite }).strict()).min(1).max(100000);
const definitionSchema = z.object({
  basis: z.string().min(1), horizonYears: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/), nominal: z.boolean(),
}).strict();
type GrowthDefinition = z.infer<typeof definitionSchema>;
export function pairedGrowthGap(projected: z.input<typeof memberSchema>, implied: z.input<typeof memberSchema>,
  projectedDefinition: GrowthDefinition, impliedDefinition: GrowthDefinition) {
  const a = memberSchema.parse(projected), b = memberSchema.parse(implied);
  const da = definitionSchema.parse(projectedDefinition), db = definitionSchema.parse(impliedDefinition);
  if (JSON.stringify(da) !== JSON.stringify(db)) throw new Error("Incompatible growth definitions");
  if (new Set(a.map(m => m.id)).size !== a.length || new Set(b.map(m => m.id)).size !== b.length ||
      a.length !== b.length) throw new Error("Unique aligned member identities required");
  const byId = new Map(b.map(m => [m.id, m.value]));
  const members = [...a].sort((x, y) => x.id.localeCompare(y.id)).map(m => {
    if (!byId.has(m.id)) throw new Error("Member identities differ");
    return { id: m.id, value: m.value - byId.get(m.id)! };
  });
  const sorted = members.map(m => m.value).sort((x, y) => x - y);
  const middle = Math.floor(sorted.length / 2);
  return { definition: da, members, median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 };
}

const evidenceSchema = z.object({
  mappingEvidence: z.array(z.string().trim().min(1)).max(100),
  expansionEvidence: z.array(z.string().trim().min(1)).max(100),
  identificationEvidence: z.array(z.string().trim().min(1)).max(100),
}).strict();
export function valuationScenarioEligibility(input: z.input<typeof evidenceSchema>) {
  const e = evidenceSchema.parse(input), mapped = e.mappingEvidence.length > 0;
  return {
    tier1: mapped ? "conditional-covered-universe" : "unavailable",
    globalExpansion: mapped && e.expansionEvidence.length > 0 ? "requires-coverage-model-review" : "unavailable",
    identification: e.identificationEvidence.length ? "submitted-evidence-requires-independent-assessment" : "not-established",
    marketExpectationClaim: false,
    label: "model-implied pathway consistent with valuations",
    limitation: "Evidence references are declarations, not verified mappings or causal identification.",
  };
}
