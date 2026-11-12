import { z } from "zod";
import { contentHash } from "./analysisManifest";

const finite = z.number().finite();
const text = z.string().min(1);
const source = z.object({
  id: text, url: z.string().url(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  locator: text, observedAt: z.string().datetime({ offset: true }),
  availableAt: z.string().datetime({ offset: true }),
}).strict();
const measure = z.object({
  value: finite.nonnegative(),
  basis: z.enum(["source-fact", "conditional-assumption"]),
  source,
  rationale: text,
  bounds: z.object({ minimum: finite.nonnegative(), maximum: finite.nonnegative() }).strict(),
}).strict();
const fraction = measure.extend({ value: finite.min(0).max(1) }).strict();
const price = measure.extend({
  unit: z.literal("major-currency/MWh"),
  currency: z.string().regex(/^[A-Z]{3}$/),
  year: z.number().int().min(1900).max(2100),
  kind: z.enum(["issuer-contract", "supplier-tariff", "conditional-price", "regional-context-only"]),
  supplier: text, tariff: text,
}).strict();

export const locationElectricityCashBridgeSchema = z.object({
  companyId: text,
  year: z.number().int().min(1900).max(2100),
  currency: z.string().regex(/^[A-Z]{3}$/),
  cutoff: z.string().datetime({ offset: true }),
  expenseBasis: z.literal("incremental-above-electricity-expense-in-baseline"),
  workingCapitalBasis: z.literal("electricity-increment-excluded-from-baseline-working-capital"),
  scope2DirectTax: z.literal(false),
  locations: z.array(z.object({
    id: text, companyId: text, jurisdiction: text,
    operatingStatus: z.literal("operating"),
    locationSource: source,
    supplier: text, tariff: text,
    // This is evidence that the tariff/contract covers this specific operating
    // site, not a headquarters address or a regional average.
    applicabilitySource: source,
    purchasedElectricity: measure.extend({
      unit: z.literal("MWh"), year: z.number().int(),
    }).strict(),
    baselinePrice: price,
    scenarioPrice: price,
    customerRecoveryFraction: fraction,
    supplierPaymentFraction: fraction,
    customerCollectionFraction: fraction,
  }).strict()).min(1).max(1000),
}).strict();

export type LocationElectricityCashBridgeInput = z.infer<typeof locationElectricityCashBridgeSchema>;

/** Standalone opt-in component for companyProjection. All currency amounts are
 * nominal MAJOR currency, not millions. Never takes emissions or carbon prices.
 * No company tax rate is applied here: the consuming income ledger recomputes
 * tax on its full income, avoiding unsupported tax refunds on loss years.
 */
export function calculateLocationElectricityCashBridge(input: unknown) {
  const x = locationElectricityCashBridgeSchema.parse(input);
  const cutoff = Date.parse(x.cutoff);
  const inspectSource = (s: z.infer<typeof source>) => {
    if (Date.parse(s.observedAt) > cutoff || Date.parse(s.availableAt) > cutoff)
      throw new Error(`Electricity source ${s.id} is after cutoff`);
    if (Date.parse(s.availableAt) > Date.parse(s.observedAt))
      throw new Error(`Electricity source ${s.id} availability is after observation`);
  };
  const inspectMeasure = (m: z.infer<typeof measure>, isFraction = false) => {
    inspectSource(m.source);
    if (m.bounds.minimum > m.bounds.maximum || m.value < m.bounds.minimum || m.value > m.bounds.maximum ||
        (isFraction && m.bounds.maximum > 1))
      throw new Error("Electricity measure outside declared assumption/source bounds");
    if (m.basis === "source-fact" &&
        (m.bounds.minimum !== m.value || m.bounds.maximum !== m.value))
      throw new Error("Source facts must remain distinct from conditional ranges");
  };
  const ids = new Set<string>();
  const locations = [...x.locations].sort((a, b) => a.id.localeCompare(b.id)).map(l => {
    if (ids.has(l.id)) throw new Error("Duplicate electricity location");
    ids.add(l.id);
    if (l.companyId !== x.companyId) throw new Error("Electricity issuer mismatch");
    inspectSource(l.locationSource);
    inspectSource(l.applicabilitySource);
    const q = l.purchasedElectricity;
    inspectMeasure(q);
    if (q.year !== x.year) throw new Error("Purchased electricity delivery period mismatch");
    for (const p of [l.baselinePrice, l.scenarioPrice]) {
      inspectMeasure(p);
      if (p.kind === "regional-context-only")
        throw new Error("Regional electricity average is not an applicable issuer tariff");
      if ((p.kind === "conditional-price") !== (p.basis === "conditional-assumption"))
        throw new Error("Conditional electricity prices must not be relabelled source facts");
      if (p.year !== x.year || p.currency !== x.currency)
        throw new Error("Electricity price delivery period/currency mismatch; no implicit FX or forward fill");
      if (p.supplier !== l.supplier || p.tariff !== l.tariff)
        throw new Error("Electricity supplier/tariff applicability mismatch");
    }
    for (const f of [l.customerRecoveryFraction, l.supplierPaymentFraction, l.customerCollectionFraction])
      inspectMeasure(f, true);
    const incrementalSupplierExpense = q.value * (l.scenarioPrice.value - l.baselinePrice.value);
    const incrementalCustomerRevenue = incrementalSupplierExpense * l.customerRecoveryFraction.value;
    const netAccrualExpense = incrementalSupplierExpense - incrementalCustomerRevenue;
    const incrementalSupplierCashPaid = incrementalSupplierExpense * l.supplierPaymentFraction.value;
    const incrementalCustomerCashCollected = incrementalCustomerRevenue * l.customerCollectionFraction.value;
    const incrementalPayable = incrementalSupplierExpense - incrementalSupplierCashPaid;
    const incrementalReceivable = incrementalCustomerRevenue - incrementalCustomerCashCollected;
    const increaseWorkingCapital = incrementalReceivable - incrementalPayable;
    const preTaxCashImpact = -netAccrualExpense - increaseWorkingCapital;
    const residual = preTaxCashImpact - (-incrementalSupplierCashPaid + incrementalCustomerCashCollected);
    if (![incrementalSupplierExpense, incrementalCustomerRevenue, netAccrualExpense,
      incrementalSupplierCashPaid, incrementalCustomerCashCollected, incrementalPayable,
      incrementalReceivable, increaseWorkingCapital, preTaxCashImpact].every(Number.isFinite))
      throw new Error("Nonfinite electricity bridge");
    if (Math.abs(residual) > 1e-9 * Math.max(1, Math.abs(incrementalSupplierExpense)))
      throw new Error("Electricity accrual-to-cash identity failed");
    const conditionalInputs = [
      ["purchasedElectricity", q],
      ["baselinePrice", l.baselinePrice], ["scenarioPrice", l.scenarioPrice],
      ["customerRecoveryFraction", l.customerRecoveryFraction],
      ["supplierPaymentFraction", l.supplierPaymentFraction],
      ["customerCollectionFraction", l.customerCollectionFraction],
    ].filter(([, m]) => (m as z.infer<typeof measure>).basis === "conditional-assumption")
      .map(([name]) => name as string);
    return { id: l.id, jurisdiction: l.jurisdiction, purchasedElectricityMWh: q.value,
      incrementalSupplierExpense, incrementalCustomerRevenue, netAccrualExpense,
      incrementalSupplierCashPaid, incrementalCustomerCashCollected,
      incrementalPayable, incrementalReceivable, increaseWorkingCapital,
      preTaxCashImpact, reconciliationResidual: residual, conditionalInputs,
      evidence: { location: l.locationSource, applicability: l.applicabilitySource,
        quantity: q, baselinePrice: l.baselinePrice, scenarioPrice: l.scenarioPrice,
        customerRecoveryFraction: l.customerRecoveryFraction,
        supplierPaymentFraction: l.supplierPaymentFraction,
        customerCollectionFraction: l.customerCollectionFraction } };
  });
  const sum = (field: "netAccrualExpense" | "increaseWorkingCapital" | "preTaxCashImpact" |
    "incrementalSupplierExpense" | "incrementalCustomerRevenue") =>
    locations.reduce((s, l) => s + l[field], 0);
  const totals = {
    incrementalSupplierExpense: sum("incrementalSupplierExpense"),
    incrementalCustomerRevenue: sum("incrementalCustomerRevenue"),
    netAccrualExpense: sum("netAccrualExpense"),
    increaseWorkingCapital: sum("increaseWorkingCapital"),
    preTaxCashImpact: sum("preTaxCashImpact"),
  };
  if (!Object.values(totals).every(Number.isFinite)) throw new Error("Nonfinite total electricity bridge");
  return {
    status: locations.some(l => l.conditionalInputs.length) ?
      "conditional-electricity-price-bridge" as const : "source-referenced-electricity-price-bridge" as const,
    companyId: x.companyId, year: x.year, currency: x.currency, cutoff: x.cutoff,
    inputHash: contentHash({ ...x, locations: [...x.locations].sort((a, b) => a.id.localeCompare(b.id)) }),
    channel: "purchased-electricity-prices-not-direct-Scope2-tax" as const,
    coverage: "explicit-listed-operating-locations-only-no-unsourced-company-gross-up" as const,
    locations, totals,
    integration: {
      subtractFromPreTaxIncome: totals.netAccrualExpense,
      addToIncreaseWorkingCapital: totals.increaseWorkingCapital,
      recomputeCompanyCashTax: true,
      directScope2Tax: 0,
      applyToBaselineExpenseAgain: false,
    },
    productionEligible: false,
    claim: "Source-referenced component, not independently authenticated issuer cash validation or owner approval",
  };
}
