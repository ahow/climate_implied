import { z } from "zod";
import { contentHash } from "./analysisManifest";

const finite = z.number().finite(), fraction = finite.min(0).max(1);
const evidence = z.array(z.string().min(1)).min(1);
const exposure = z.object({ region: z.string().min(1), sector: z.string().min(1) });
const schema = z.object({
  companyId: z.string().min(1), manifestId: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/), businessType: z.enum(["non-financial", "financial"]),
  baseYear: z.number().int().min(1900).max(2100), baseRevenue: finite.positive(), baseFcfe: finite,
  baseEmissionsTonnes: z.object({ scope1: finite.nonnegative(), scope2: finite.nonnegative(), scope3: finite.nonnegative() }).strict(),
  marginBounds: z.object({ minimum: finite.min(-1).max(1), maximum: finite.min(-1).max(1), evidence }).strict(),
  mapping: z.object({
    basis: z.enum(["operating-geography", "headquarters-fallback"]), evidence,
    shares: z.array(exposure.extend({ weight: fraction }).strict()).min(1).max(100),
  }).strict(),
  members: z.array(z.object({
    id: z.string().min(1),
    years: z.array(z.object({
      year: z.number().int(), exposures: z.array(exposure.extend({ activityGrowth: finite.gt(-1) }).strict()).min(1).max(100),
      marketShareMultiplier: finite.positive(), operatingMargin: finite,
      taxRate: fraction, interest: finite.nonnegative(), depreciation: finite.nonnegative(),
      capex: finite.nonnegative(), increaseWorkingCapital: finite, netBorrowing: finite,
      scope1IntensityMultiplier: finite.nonnegative(), scope2IntensityMultiplier: finite.nonnegative(),
      scope3IntensityMultiplier: finite.nonnegative(), scope1LiableFraction: fraction,
      scope2LiableFraction: fraction, effectiveCarbonPrice: finite.nonnegative(), passThrough: fraction,
    }).strict()).length(5),
  }).strict()).min(2).max(1000),
}).strict();

/** Conditional operating ledger. No company, geography, margin or policy
 * parameters are inferred from headquarters or filled from arbitrary defaults.
 * All monetary values are in the same nominal major currency, not thousands.
 */
export function projectCompanyMembers(input: unknown) {
  const x = schema.parse(input);
  if (x.businessType === "financial") return { status: "not-modelled" as const,
    reason: "Financial institutions require a separately validated residual-income model" };
  if (x.baseFcfe <= 0) return { status: "not-modelled" as const,
    reason: "Positive identifiable starting FCFE required for growth comparison" };
  const key = (r: { region: string; sector: string }) => `${r.region}|${r.sector}`;
  const shares = [...x.mapping.shares].sort((a, b) => key(a).localeCompare(key(b)));
  if (new Set(shares.map(key)).size !== shares.length ||
      Math.abs(shares.reduce((s, r) => s + r.weight, 0) - 1) > 1e-9)
    throw new Error("Unique operating exposures must cover exactly the company");
  if (x.marginBounds.minimum > x.marginBounds.maximum) throw new Error("Invalid sourced margin bounds");
  if (new Set(x.members.map(m => m.id)).size !== x.members.length) throw new Error("Duplicate member identity");
  const sourceMembers = [...x.members].sort((a, b) => a.id.localeCompare(b.id)).map(m => ({
    ...m, years: [...m.years].sort((a, b) => a.year - b.year).map(y => ({
      ...y, exposures: [...y.exposures].sort((a, b) => key(a).localeCompare(key(b))),
    })),
  }));
  const members = sourceMembers.map(member => {
    // Keep segment activity separate; fixed annual weighting would silently
    // rebalance operating exposure and distort cumulative growth.
    const activity = new Map(shares.map(s => [key(s), 1]));
    const years = member.years.map((p, i) => {
      if (p.year !== x.baseYear + i + 1 || p.operatingMargin < x.marginBounds.minimum ||
          p.operatingMargin > x.marginBounds.maximum) throw new Error("Nonannual years or margin outside evidenced bounds");
      const byExposure = new Map(p.exposures.map(e => [key(e), e.activityGrowth]));
      if (byExposure.size !== p.exposures.length || byExposure.size !== shares.length ||
          shares.some(s => !byExposure.has(key(s)))) throw new Error("Missing or duplicated regional sector trajectory");
      for (const s of shares) activity.set(key(s), activity.get(key(s))! * (1 + byExposure.get(key(s))!));
      const activityRatio = shares.reduce((sum, s) => sum + s.weight * activity.get(key(s))!, 0) * p.marketShareMultiplier;
      const revenue = x.baseRevenue * activityRatio;
      const emissionsTonnes = {
        scope1: x.baseEmissionsTonnes.scope1 * activityRatio * p.scope1IntensityMultiplier,
        scope2: x.baseEmissionsTonnes.scope2 * activityRatio * p.scope2IntensityMultiplier,
        scope3: x.baseEmissionsTonnes.scope3 * activityRatio * p.scope3IntensityMultiplier,
      };
      const carbonDrag = (emissionsTonnes.scope1 * p.scope1LiableFraction +
        emissionsTonnes.scope2 * p.scope2LiableFraction) * p.effectiveCarbonPrice * (1 - p.passThrough);
      const operatingProfitBeforeCarbon = revenue * p.operatingMargin;
      const preTaxIncome = operatingProfitBeforeCarbon - carbonDrag - p.interest;
      // No automatic tax refund for losses or unsupported deferred-tax asset.
      const cashTax = Math.max(0, preTaxIncome) * p.taxRate;
      const netIncome = preTaxIncome - cashTax;
      const fcfe = netIncome + p.depreciation - p.capex - p.increaseWorkingCapital + p.netBorrowing;
      if (![revenue, activityRatio, ...Object.values(emissionsTonnes), carbonDrag, fcfe].every(Number.isFinite))
        throw new Error("Nonfinite projected operating ledger");
      return { year: p.year, revenue, activityRatio, emissionsTonnes, operatingProfitBeforeCarbon,
        carbonDrag, interest: p.interest, cashTax, netIncome, depreciation: p.depreciation,
        capex: p.capex, increaseWorkingCapital: p.increaseWorkingCapital, netBorrowing: p.netBorrowing, fcfe };
    });
    const final = years[4].fcfe;
    return { id: member.id, years, growth: final > 0 ? Math.pow(final / x.baseFcfe, 1 / 5) - 1 : null,
      growthStatus: final > 0 ? "positive-endpoint-five-year-CAGR" : "unavailable-nonpositive-final-FCFE" };
  });
  return { status: "conditional-projection" as const, companyId: x.companyId, manifestId: x.manifestId,
    inputHash: contentHash({ ...x, mapping: { ...x.mapping, shares }, members: sourceMembers }),
    members, definition: { basis: "FCFE", horizonYears: 5, currency: x.currency, nominal: true },
    evidenceState: "Bounded/conditional estimate",
    claim: "conditional company operating projection; not empirically validated",
    geographyBasis: x.mapping.basis, productionEligible: false,
    limitations: [
      "Supplied operating exposure, margin bounds and policy assumptions require source review.",
      "Scope 2 charge represents an explicit electricity-price channel, not a duplicate direct tax.",
      "Scope 3 affects physical emissions only; demand effects must already be in regional activity.",
      "No additional target abatement is stacked on supplied intensity pathways.",
      "Terminal reinvestment, full valuation pairing and empirical model selection remain separate.",
    ] };
}
