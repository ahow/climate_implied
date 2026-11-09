import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { summarizeNetZeroYears } from "./researchCorrections";

const schema = z.object({
  manifestId: z.string().min(1),
  // Must be fixed in the study protocol before its ensemble is evaluated.
  emissionsToleranceGtCO2e: z.number().finite().positive(),
  members: z.array(z.object({
    id: z.string().min(1), temperature2100C: z.number().finite(),
    emissions2050GtCO2e: z.number().finite(), emissions2100GtCO2e: z.number().finite(),
    durableGhgZero: z.number().int().min(2024).max(2100).nullable(),
    durableCo2Zero: z.number().int().min(2024).max(2100).nullable(),
  }).strict()).length(10000),
}).strict();
const probabilities = [.1, .5, .9];
function quantiles(values: number[]) {
  const a = [...values].sort((x, y) => x - y);
  return probabilities.map(p => {
    const k = (a.length - 1) * p, lo = Math.floor(k);
    return a[lo] + (a[Math.ceil(k)] - a[lo]) * (k - lo);
  });
}
/** Nested, lexically ordered simulation IDs must be assigned before sampling,
 * not ranked by an outcome. This is a numerical check, not scientific validation.
 */
export function checkMemberConvergence(input: unknown) {
  const x = schema.parse(input);
  if (new Set(x.members.map(m => m.id)).size !== 10000) throw new Error("Unique simulation member IDs required");
  const members = [...x.members].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const first = members.slice(0, 5000);
  const compare = (field: "temperature2100C" | "emissions2050GtCO2e" | "emissions2100GtCO2e", tolerance: number) => {
    const small = quantiles(first.map(m => m[field])), full = quantiles(members.map(m => m[field]));
    const differences = small.map((v, i) => Math.abs(v - full[i]));
    return { quantiles5000: small, quantiles10000: full, absoluteDifferences: differences,
      tolerance, passed: differences.every(d => d < tolerance) };
  };
  const netZero = (field: "durableGhgZero" | "durableCo2Zero") => {
    const small = summarizeNetZeroYears(first.map(m => m[field]), 2100);
    const full = summarizeNetZeroYears(members.map(m => m[field]), 2100);
    const difference = (key: "p10" | "median" | "p90") => {
      const a = small[key], b = full[key];
      return { quantile5000: a, quantile10000: b,
        absoluteDifferenceYears: a === null || b === null ? null : Math.abs(a - b),
        status: a === null && b === null ? "both-right-censored" : a === null || b === null ? "censoring-mismatch" : "observed",
        passed: a === null || b === null ? a === b : Math.abs(a - b) < 1 };
    };
    const p10 = difference("p10"), median = difference("median"), p90 = difference("p90");
    const neverReachedShareDifference = Math.abs(small.neverReachedShare - full.neverReachedShare);
    return { p10, median, p90, neverReachedShare5000: small.neverReachedShare,
      neverReachedShare10000: full.neverReachedShare, neverReachedShareDifference,
      passed: p10.passed && median.passed && p90.passed && neverReachedShareDifference < .01 };
  };
  const temperature = compare("temperature2100C", .01);
  const emissions2050 = compare("emissions2050GtCO2e", x.emissionsToleranceGtCO2e);
  const emissions2100 = compare("emissions2100GtCO2e", x.emissionsToleranceGtCO2e);
  const ghg = netZero("durableGhgZero"), co2 = netZero("durableCo2Zero");
  return { manifestId: x.manifestId, inputHash: contentHash({ ...x, members }), temperature,
    emissions2050, emissions2100, netZero: { ghg, co2 },
    passed: temperature.passed && emissions2050.passed && emissions2100.passed && ghg.passed && co2.passed,
    claim: "numerical convergence only; jointly censored quantiles remain unavailable, not measured year agreement" };
}
