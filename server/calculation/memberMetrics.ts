import { z } from "zod";
import { summarizeEnsemble } from "./ensemble";
import { summarizeNetZeroYears } from "./researchCorrections";
import { contentHash } from "./analysisManifest";

const matrix = z.array(z.array(z.number().finite()).min(2).max(10000)).length(77);
const schema = z.object({
  baseline: z.literal("1850-1900"),
  memberIds: z.array(z.string().min(1)).min(2).max(10000),
  years: z.array(z.number().int()).length(77),
  temperature: matrix, ghgGtCO2e: matrix, co2Gt: matrix,
}).strict().superRefine((x, ctx) => {
  if (new Set(x.memberIds).size !== x.memberIds.length ||
    x.years.some((y, i) => y !== 2024 + i) ||
    [x.temperature, x.ghgGtCO2e, x.co2Gt].some(a => a.some(r => r.length !== x.memberIds.length)))
    ctx.addIssue({ code: "custom", message: "Aligned unique members and annual 2024–2100 arrays required" });
});
function crossings(values: number[], threshold: number) {
  const first = values.findIndex(v => v <= threshold);
  let lastAbove = -1;
  values.forEach((v, i) => { if (v > threshold) lastAbove = i; });
  return { first: first < 0 ? null : 2024 + first,
    durable: lastAbove === values.length - 1 ? null : 2024 + lastAbove + 1 };
}
export function summarizeMemberMetrics(input: unknown) {
  const x = schema.parse(input);
  const members = x.memberIds.map((id, m) => {
    const ghg = x.ghgGtCO2e.map(r => r[m]), co2 = x.co2Gt.map(r => r[m]);
    if (ghg[0] <= 0 || co2[0] <= 0) throw new Error("Positive starting annual emissions required");
    const gz = crossings(ghg, 0), cz = crossings(co2, 0);
    const near = crossings(ghg, ghg[0] * .05);
    const reductionRates = [[2024, 2030], [2030, 2050], [2050, 2100]].map(([from, to]) => {
      const a = ghg[from - 2024], b = ghg[to - 2024];
      const valid = a > 0 && b > 0;
      return { from, to, annualFraction: valid ? 1 - Math.pow(b / a, 1 / (to - from)) : null,
        status: valid ? "positive-endpoint-compound-rate" : "unavailable-nonpositive-endpoint",
        absoluteChangeGtCO2ePerYear: (b - a) / (to - from) };
    });
    return { id, firstGhgZero: gz.first, durableGhgZero: gz.durable,
      firstCo2Zero: cz.first, durableCo2Zero: cz.durable,
      nearZero5Percent2024: near.durable, reductionRates };
  });
  const temperature = summarizeEnsemble({ baseline: x.baseline, memberIds: x.memberIds,
    years: x.years, temperature: x.temperature });
  return { inputHash: contentHash(x), temperature,
    ghgNetZero: summarizeNetZeroYears(members.map(m => m.durableGhgZero), 2100),
    co2NetZero: summarizeNetZeroYears(members.map(m => m.durableCo2Zero), 2100), members,
    claim: "model-conditional supplied-member calculation; not independently validated",
    evidenceState: "Bounded/conditional estimate", physicalValidation: false,
    nearZeroDefinition: "First year at or below 5% of own 2024 GHG emissions, remaining below through 2100; not net zero" };
}
