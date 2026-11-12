import { z } from "zod";
import { contentHash } from "./analysisManifest";
import { calculateQualifiedCarbonDrag, qualifiedProjectionPassThroughSchema } from "./carbonPassThroughAdmission";
import { bindNestedOutput } from "../../shared/outputFieldSemantics";
import { calculateLocationElectricityCashBridge, locationElectricityCashBridgeSchema }
  from "./locationElectricityCashBridge";

const finite = z.number().finite(), fraction = finite.min(0).max(1);
const evidence = z.array(z.string().min(1)).min(1);
const exposure = z.object({ region: z.string().min(1), sector: z.string().min(1) });
const scopes = ["scope1", "scope2", "scope3"] as const;
const abatementEvidence = z.array(z.string().trim().min(1)).min(1);
const measureIdentity = { measureId: z.string().trim().min(1), evidence: abatementEvidence };
const scopeAbatement = z.object({
  intensityEvidence: abatementEvidence,
  measures: z.array(z.discriminatedUnion("treatment", [
    z.object({ ...measureIdentity, treatment: z.literal("embedded-in-intensity") }).strict(),
    z.object({ ...measureIdentity, treatment: z.literal("separate-abatement"),
      remainingEmissionsMultiplier: fraction, deliveryEvidence: abatementEvidence,
      disjointnessEvidence: abatementEvidence }).strict(),
  ])).max(100),
}).strict();
// Opt-in, complete all-scope accounting. Absence preserves the old contract:
// supplied intensity is final, with no additional target abatement.
const abatementAccounting = z.object({
  scope1: scopeAbatement, scope2: scopeAbatement, scope3: scopeAbatement,
}).strict();

function reconcileAbatement(accounting: z.infer<typeof abatementAccounting>,
  base: Record<typeof scopes[number], number>, activityRatio: number,
  intensity: Record<typeof scopes[number], number>) {
  const embedded = new Set<string>(), separate = new Set<string>();
  for (const scope of scopes) {
    for (const measure of accounting[scope].measures) {
      const own = measure.treatment === "embedded-in-intensity" ? embedded : separate;
      if (own.has(measure.measureId))
        throw new Error(`Duplicate abatement measure across scopes: ${measure.measureId}`);
      own.add(measure.measureId);
    }
  }
  for (const id of Array.from(separate)) if (embedded.has(id))
    throw new Error(`Double-counted abatement already embedded in intensity: ${id}`);
  // Identifiers denote disjoint physical measures, not merely differently named
  // targets. Evidence review must establish that fact; IDs cannot prove it.
  // Reuse across years/members is valid; stacking occurs within a member-year.
  // Factors are explicit residual fractions for this year relative to the base
  // intensity path, not annual improvements compounded from the prior year.
  const reconcile = (scope: typeof scopes[number]) => {
    const remainingEmissionsMultiplier = accounting[scope].measures.reduce((product, measure) =>
      measure.treatment === "separate-abatement" ? product * measure.remainingEmissionsMultiplier : product, 1);
    const beforeSeparateAbatementTonnes = base[scope] * activityRatio * intensity[scope];
    return { baseEmissionsTonnes: base[scope], activityRatio, intensityMultiplier: intensity[scope],
      beforeSeparateAbatementTonnes, remainingEmissionsMultiplier,
      emissionsTonnes: beforeSeparateAbatementTonnes * remainingEmissionsMultiplier };
  };
  return { noDoubleCountingCheck: "passed-declared-disjoint-measure-ids" as const, declaredAccounting: accounting,
    scope1: reconcile("scope1"), scope2: reconcile("scope2"), scope3: reconcile("scope3") };
}

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
      nonOperatingIncome: finite, incomeAttributionAdjustment: finite, otherCashAdjustments: finite,
      scope1IntensityMultiplier: finite.nonnegative(), scope2IntensityMultiplier: finite.nonnegative(),
      scope3IntensityMultiplier: finite.nonnegative(), scope1LiableFraction: fraction,
      scope2LiableFraction: fraction, effectiveCarbonPrice: finite.nonnegative(), passThrough: fraction,
      qualifiedPassThrough: qualifiedProjectionPassThroughSchema.optional(),
      abatementAccounting: abatementAccounting.optional(),
      locationElectricity: locationElectricityCashBridgeSchema.optional(),
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
      ...(y.abatementAccounting ? { abatementAccounting: {
        scope1: { ...y.abatementAccounting.scope1, measures: [...y.abatementAccounting.scope1.measures].sort((a, b) => a.measureId.localeCompare(b.measureId)) },
        scope2: { ...y.abatementAccounting.scope2, measures: [...y.abatementAccounting.scope2.measures].sort((a, b) => a.measureId.localeCompare(b.measureId)) },
        scope3: { ...y.abatementAccounting.scope3, measures: [...y.abatementAccounting.scope3.measures].sort((a, b) => a.measureId.localeCompare(b.measureId)) },
      } } : {}),
      ...(y.locationElectricity ? { locationElectricity: { ...y.locationElectricity,
        locations: [...y.locationElectricity.locations].sort((a, b) => a.id.localeCompare(b.id)),
      } } : {}),
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
      const abatementReconciliation = p.abatementAccounting ?
        reconcileAbatement(p.abatementAccounting, x.baseEmissionsTonnes, activityRatio, {
          scope1: p.scope1IntensityMultiplier, scope2: p.scope2IntensityMultiplier, scope3: p.scope3IntensityMultiplier,
        }) : undefined;
      const emissionsTonnes = abatementReconciliation ? {
        scope1: abatementReconciliation.scope1.emissionsTonnes,
        scope2: abatementReconciliation.scope2.emissionsTonnes,
        scope3: abatementReconciliation.scope3.emissionsTonnes,
      } : {
        scope1: x.baseEmissionsTonnes.scope1 * activityRatio * p.scope1IntensityMultiplier,
        scope2: x.baseEmissionsTonnes.scope2 * activityRatio * p.scope2IntensityMultiplier,
        scope3: x.baseEmissionsTonnes.scope3 * activityRatio * p.scope3IntensityMultiplier,
      };
      // Absence keeps legacy conditional arithmetic/output/hash byte-compatible.
      // Raw passThrough is not a source-admitted coefficient. The opt-in replaces,
      // never stacks with, that legacy drag and cannot cover mixed company markets.
      let qualifiedCarbonDrag: ReturnType<typeof calculateQualifiedCarbonDrag> | undefined;
      if (p.qualifiedPassThrough) {
        const q = p.qualifiedPassThrough;
        if (q.companyId !== x.companyId) throw new Error("Qualified pass-through issuer mismatch");
        if (x.mapping.basis !== "operating-geography" || shares.length !== 1 ||
            shares[0].region !== q.assumption.jurisdiction || shares[0].sector !== q.assumption.sector)
          throw new Error("Qualified pass-through requires exact single operating geography/sector exposure");
        if (p.scope2LiableFraction !== 0)
          throw new Error("Qualified direct Scope1 recovery cannot cover Scope2 electricity-price costs");
        if (p.passThrough !== 0)
          throw new Error("Qualified pass-through cannot coexist with legacy raw passThrough");
        qualifiedCarbonDrag = calculateQualifiedCarbonDrag(q.assumption, {
          scope: "scope1", year: p.year, currency: x.currency,
          incrementalLiableTonnesNetAllocation: emissionsTonnes.scope1 * p.scope1LiableFraction,
          incrementalEffectivePricePerTonne: p.effectiveCarbonPrice,
          priceBasis: q.priceBasis, accountingBasis: q.accountingBasis,
        });
      }
      const carbonDrag = qualifiedCarbonDrag ? qualifiedCarbonDrag.carbonDrag :
        (emissionsTonnes.scope1 * p.scope1LiableFraction +
          emissionsTonnes.scope2 * p.scope2LiableFraction) * p.effectiveCarbonPrice * (1 - p.passThrough);
      let electricityPriceBridge: ReturnType<typeof calculateLocationElectricityCashBridge> | undefined;
      if (p.locationElectricity) {
        const electricity = p.locationElectricity;
        if (electricity.companyId !== x.companyId || electricity.year !== p.year ||
            electricity.currency !== x.currency)
          throw new Error("Location electricity company/year/currency mismatch");
        if (p.scope2LiableFraction !== 0)
          throw new Error("Location electricity requires zero legacy Scope2 charge; no duplicate direct tax");
        if (x.mapping.basis !== "operating-geography" ||
            electricity.locations.some(l => !shares.some(s => s.region === l.jurisdiction)))
          throw new Error("Location electricity requires matching operating geography, not headquarters fallback");
        electricityPriceBridge = calculateLocationElectricityCashBridge(electricity);
      }
      const operatingProfitBeforeCarbon = revenue * p.operatingMargin;
      // Subtract the incremental accrual expense, not the cash-paid component.
      // WC separately converts that accrual to cash exactly once. Absence keeps
      // legacy arithmetic/output/hash unchanged.
      const incomeBeforeElectricity = operatingProfitBeforeCarbon - carbonDrag - p.interest + p.nonOperatingIncome;
      const preTaxIncome = electricityPriceBridge ?
        incomeBeforeElectricity - electricityPriceBridge.integration.subtractFromPreTaxIncome : incomeBeforeElectricity;
      const increaseWorkingCapital = electricityPriceBridge ?
        p.increaseWorkingCapital + electricityPriceBridge.integration.addToIncreaseWorkingCapital : p.increaseWorkingCapital;
      // No automatic tax refund for losses or unsupported deferred-tax asset.
      const cashTax = Math.max(0, preTaxIncome) * p.taxRate;
      const netIncome = preTaxIncome - cashTax + p.incomeAttributionAdjustment;
      const fcfe = netIncome + p.depreciation + p.otherCashAdjustments -
        p.capex - increaseWorkingCapital + p.netBorrowing;
      if (![revenue, activityRatio, ...Object.values(emissionsTonnes), carbonDrag, fcfe].every(Number.isFinite))
        throw new Error("Nonfinite projected operating ledger");
      const carbonDragQualification = qualifiedCarbonDrag ? {
        inputMode: "source-referenced-analyst-assumption-incremental-scope1" as const,
        component: qualifiedCarbonDrag, cashBridge: p.qualifiedPassThrough!.cashBridge,
        legacyPassThroughTreatment: "zero-sentinel-not-a-second-recovery-coefficient" as const,
        claim: "Conditional accrual component consumed by FCFE ledger; no empirical issuer cash validation",
      } : undefined;
      if (carbonDragQualification) bindNestedOutput("companyProjection.carbonDragQualification", carbonDragQualification);
      return { year: p.year, revenue, activityRatio, emissionsTonnes, operatingProfitBeforeCarbon,
        ...(electricityPriceBridge ? { electricityPriceBridge,
          baselineIncreaseWorkingCapital: p.increaseWorkingCapital } : {}),
        ...(carbonDragQualification ? { carbonDragQualification } : {}),
        ...(abatementReconciliation ? { abatementReconciliation } : {}),
        carbonDrag, interest: p.interest, nonOperatingIncome: p.nonOperatingIncome,
        incomeAttributionAdjustment: p.incomeAttributionAdjustment,
        otherCashAdjustments: p.otherCashAdjustments, cashTax, netIncome, depreciation: p.depreciation,
        capex: p.capex, increaseWorkingCapital, netBorrowing: p.netBorrowing, fcfe };
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
      ...(sourceMembers.some(m => m.years.some(y => y.abatementAccounting)) ?
        ["Separate abatement uses explicit remaining-emissions factors and delivery evidence; declared measure IDs are disjoint across all scopes within each member-year. Source review must verify physical disjointness and delivery credibility."] :
        ["No additional target abatement is stacked on supplied intensity pathways."]),
      "Terminal reinvestment, full valuation pairing and empirical model selection remain separate.",
      "Non-operating income, attribution and other cash adjustments must be explicit; residuals are not assumed recurring evidence.",
    ] };
}
