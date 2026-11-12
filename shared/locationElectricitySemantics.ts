import type { OutputFieldSemantic } from "./outputFieldSemantics";

const context = {
  source: "server/calculation/locationElectricityCashBridge.ts; caller-supplied same-member-year location evidence, source hashes, locators and observed/available dates; references are assertions, not independent source authentication",
  period: "Explicit delivery year, equal to the consuming companyProjection member-year",
  geography: "Explicit operating locations only; companyProjection requires operating-geography mapping with every jurisdiction represented; no headquarters or company gross-up",
  status: "Optional conditional component; productionEligible=false; no source approval or empirical issuer cash validation",
  missingness: "Absent entire input preserves legacy output/arithmetic/hash. Present input requires every strict-schema field; incomplete/mismatched/nonfinite/after-cutoff inputs reject. Unknown is not zero; no tariff, quantity, FX or timing defaults.",
  uncertainty: "Explicit source-fact point bounds or conditional-assumption ranges, not calibrated probabilities; conditionalInputs identifies assumptions actually consumed",
  scope: "Purchased electricity price increment above expense already in baseline; not emissions times carbon price, not a direct Scope2 tax. Public location findings do not supply the missing issuer inputs.",
  asOfRule: "Each referenced source requires availableAt <= observedAt <= cutoff; no original publication or historical forecast-origin authenticity inferred from dates/hashes",
};
const inputPrefix = "members[].years[].locationElectricity";
const outputPrefix = "members[].years[].electricityPriceBridge";
type Spec = readonly [string, string, string, string];
const identitySpecs: Spec[] = [
  ["companyId", "Issuer identity", "identifier", "Equal to consuming companyId; mismatch rejects"],
  ["year", "Delivery year", "calendar year", "Equal to consuming member-year; no forward fill"],
  ["currency", "Explicit monetary denomination", "ISO-4217 major currency code", "Equal to consuming company currency and both price currencies; no implicit FX or millions scaling"],
  ["cutoff", "Evidence availability cutoff", "ISO-8601 timestamp", "Explicit offset datetime; all source dates checked against cutoff"],
];
const sourceSpecs: Spec[] = [
  ["id", "Referenced source identity", "identifier", "Nonempty caller-supplied reference"],
  ["url", "Referenced source URL", "URL", "Strict URL; component does not retrieve/authenticate its content"],
  ["sha256", "Declared source byte identity", "SHA-256", "64 lowercase hex characters; caller assertion, not a retrieval receipt"],
  ["locator", "Exact asserted source location", "source locator", "Nonempty page/table/cell locator"],
  ["observedAt", "Evidence observation date", "ISO-8601 timestamp", "Offset datetime; availableAt <= observedAt <= cutoff"],
  ["availableAt", "Declared evidence availability date", "ISO-8601 timestamp", "Offset datetime; availableAt <= observedAt <= cutoff; not original-vintage proof"],
];
const locationSpecs: Spec[] = [
  ["id", "Unique operating location identity", "identifier", "Nonempty; duplicate location IDs reject; sorted by id for inputHash"],
  ["companyId", "Same issuer as component", "identifier", "Must equal component companyId"],
  ["jurisdiction", "Operating jurisdiction", "jurisdiction identifier", "Must match an operating exposure region in companyProjection"],
  ["operatingStatus", "Operating eligibility, not proposed construction", "literal operating", "Only operating accepted; construction is not silently promoted"],
  ["supplier", "Applicable supplier", "identifier", "Both baseline/scenario price supplier must equal location supplier"],
  ["tariff", "Applicable tariff or contract", "identifier", "Both price tariffs must equal location tariff; regional averages rejected"],
];
const measureSpecs: Spec[] = [
  ["basis", "Observation versus explicit assumption", "source-fact | conditional-assumption", "Source-fact requires bounds.minimum = value = bounds.maximum; assumption remains labelled"],
  ["rationale", "Source or assumption justification", "text", "Required nonempty rationale; no inferred issuer fact"],
];
const measureUnits: Record<string, string> = {
  purchasedElectricity: "MWh/year",
  baselinePrice: "nominal major currency/MWh",
  scenarioPrice: "nominal major currency/MWh",
  customerRecoveryFraction: "fraction [0,1]",
  supplierPaymentFraction: "fraction [0,1]",
  customerCollectionFraction: "fraction [0,1]",
};
const cashSpecs: Spec[] = [
  ["incrementalSupplierExpense", "Incremental supplier accrual expense, signed", "nominal major currency/year", "purchasedElectricity.value * (scenarioPrice.value - baselinePrice.value)"],
  ["incrementalCustomerRevenue", "Incremental customer recovery accrual, signed", "nominal major currency/year", "incrementalSupplierExpense * customerRecoveryFraction.value"],
  ["netAccrualExpense", "Net expense consumed once by company pre-tax income", "nominal major currency/year", "incrementalSupplierExpense - incrementalCustomerRevenue"],
  ["incrementalSupplierCashPaid", "Signed supplier cash increment", "nominal major currency/year", "incrementalSupplierExpense * supplierPaymentFraction.value"],
  ["incrementalCustomerCashCollected", "Signed customer cash increment", "nominal major currency/year", "incrementalCustomerRevenue * customerCollectionFraction.value"],
  ["incrementalPayable", "Incremental unpaid supplier balance", "nominal major currency", "incrementalSupplierExpense - incrementalSupplierCashPaid"],
  ["incrementalReceivable", "Incremental uncollected customer balance", "nominal major currency", "incrementalCustomerRevenue - incrementalCustomerCashCollected"],
  ["increaseWorkingCapital", "Incremental receivables less payables, separate from baseline WC", "nominal major currency/year", "incrementalReceivable - incrementalPayable"],
  ["preTaxCashImpact", "Signed pre-tax cash increment", "nominal major currency/year", "-netAccrualExpense - increaseWorkingCapital = -incrementalSupplierCashPaid + incrementalCustomerCashCollected"],
  ["reconciliationResidual", "Accrual-to-cash reconciliation error", "nominal major currency/year", "preTaxCashImpact - (-incrementalSupplierCashPaid + incrementalCustomerCashCollected); reject abs(residual) > 1e-9 * max(1, abs(incrementalSupplierExpense))"],
];
function define(prefix: string, role: OutputFieldSemantic["role"], specs: Spec[]): OutputFieldSemantic[] {
  return specs.map(([path, meaning, unit, formula]) => ({
    ...context, id: `companyProjection.${prefix}.${path}`, role, meaning, unit, formula,
    dependencies: [`members[].years[].${prefix}.${path}`,
      "locationElectricityCashBridgeSchema", "calculateLocationElectricityCashBridge"],
  }));
}
const sources = (prefix: string, role: OutputFieldSemantic["role"]) => define(prefix, role, sourceSpecs);
const measures = (prefix: string, role: OutputFieldSemantic["role"]) => Object.entries(measureUnits).flatMap(([name, unit]) => [
  ...define(`${prefix}.${name}`, role, [
    ["value", `Explicit ${name}`, unit, `Finite nonnegative value within declared bounds${name.endsWith("Fraction") ? "; value and maximum <= 1" : ""}`],
    ["bounds.minimum", `Lower declared ${name} bound`, unit, "Finite nonnegative minimum <= value <= maximum; not probabilistic"],
    ["bounds.maximum", `Upper declared ${name} bound`, unit, `Finite nonnegative maximum >= minimum${name.endsWith("Fraction") ? "; maximum <= 1" : ""}`],
    ...measureSpecs,
    ...(name === "purchasedElectricity" ? [
      ["unit", "Purchased energy unit", "literal MWh", "Only MWh accepted; capacity/output/emissions are not purchased electricity"],
      ["year", "Purchased energy delivery period", "calendar year", "Must equal component year"],
    ] as Spec[] : []),
    ...(["baselinePrice", "scenarioPrice"].includes(name) ? [
      ["unit", "Price unit", "literal major-currency/MWh", "No cents/kWh conversion inside component"],
      ["currency", "Price denomination", "ISO-4217 major currency code", "Must equal component currency; no implicit FX"],
      ["year", "Price delivery year", "calendar year", "Must equal component year"],
      ["kind", "Price applicability and assumption discriminator", "issuer-contract | supplier-tariff | conditional-price", "regional-context-only rejects; conditional-price iff basis=conditional-assumption"],
      ["supplier", "Price supplier identity", "identifier", "Must equal location supplier"],
      ["tariff", "Price tariff/contract identity", "identifier", "Must equal location tariff"],
    ] as Spec[] : []),
  ]),
  ...sources(`${prefix}.${name}.source`, role),
]);
export const locationElectricitySemantics: OutputFieldSemantic[] = [
  ...define("locationElectricity", "Input", [
    ...identitySpecs,
    ["expenseBasis", "No double counting baseline electricity", "literal incremental-above-electricity-expense-in-baseline", "Only incremental expense is admissible"],
    ["workingCapitalBasis", "Separate incremental electricity WC", "literal electricity-increment-excluded-from-baseline-working-capital", "Baseline WC must exclude this increment"],
    ["scope2DirectTax", "No direct electricity emissions tax", "literal false", "False required; consuming legacy scope2LiableFraction must be zero"],
  ]),
  ...define("locationElectricity.locations[]", "Input", locationSpecs),
  ...sources("locationElectricity.locations[].locationSource", "Input"),
  ...sources("locationElectricity.locations[].applicabilitySource", "Input"),
  ...measures("locationElectricity.locations[]", "Input"),
  ...define("electricityPriceBridge", "Output", [
    ...identitySpecs,
    ["status", "Source-reference versus conditional bridge classification", "status label", "conditional-electricity-price-bridge iff any location.conditionalInputs nonempty; otherwise source-referenced-electricity-price-bridge, not independent authentication"],
    ["inputHash", "Exact component input identity", "SHA-256", "contentHash(parsed input with locations sorted by id)"],
    ["channel", "Purchased energy price channel", "literal purchased-electricity-prices-not-direct-Scope2-tax", "Fixed label; never substitutes scope2 tonnes for MWh"],
    ["coverage", "Limited location coverage", "literal explicit-listed-operating-locations-only-no-unsourced-company-gross-up", "Only explicitly supplied locations summed"],
    ["productionEligible", "No production admission", "literal false", "Always false"],
    ["claim", "Evidence limitation", "text", "Source-referenced component, not independently authenticated issuer cash validation or owner approval"],
    ["integration.subtractFromPreTaxIncome", "Accrual expense consumed once", "nominal major currency/year", "totals.netAccrualExpense"],
    ["integration.addToIncreaseWorkingCapital", "WC increment consumed once", "nominal major currency/year", "totals.increaseWorkingCapital"],
    ["integration.recomputeCompanyCashTax", "Consuming ledger recomputes tax", "literal true", "cashTax = max(0, incomeBeforeElectricity - totals.netAccrualExpense) * taxRate; no loss-year refund"],
    ["integration.directScope2Tax", "No direct Scope2 tax", "nominal major currency/year", "Literal 0; purchased electricity price is not direct emissions liability"],
    ["integration.applyToBaselineExpenseAgain", "No second baseline expense deduction", "literal false", "Always false; input must explicitly exclude baseline costs"],
  ]),
  ...define("electricityPriceBridge.locations[]", "Output", [
    ["id", "Exact input location identity", "identifier", "locations[].id"],
    ["jurisdiction", "Exact input operating jurisdiction", "jurisdiction identifier", "locations[].jurisdiction"],
    ["purchasedElectricityMWh", "Purchased electricity consumed", "MWh/year", "locations[].purchasedElectricity.value"],
    ["conditionalInputs[]", "Names of actually consumed conditional measures", "measure identifier", "Filter the six measures where basis=conditional-assumption; empty array means no declared conditional measures, not verified source approval"],
    ...cashSpecs,
  ]),
  ...sources("electricityPriceBridge.locations[].evidence.location", "Output"),
  ...sources("electricityPriceBridge.locations[].evidence.applicability", "Output"),
  ...measures("electricityPriceBridge.locations[].evidence", "Output").map(s => ({
    ...s, id: s.id.replace(".evidence.purchasedElectricity.", ".evidence.quantity."),
    dependencies: s.dependencies.map(path => path.replace(".evidence.purchasedElectricity.", ".evidence.quantity.")),
  })),
  ...define("electricityPriceBridge.totals", "Output", cashSpecs
    .filter(([field]) => ["incrementalSupplierExpense", "incrementalCustomerRevenue", "netAccrualExpense", "increaseWorkingCapital", "preTaxCashImpact"].includes(field))
    .map(([field, meaning, unit]) => [field, `Listed-location total: ${meaning}`, unit, `sum(locations[].${field}); finite result required`])),
  ...define("locationElectricityIntegration", "Output", [
    ["baselineIncreaseWorkingCapital", "Original WC preserved for audit when component present", "nominal major currency/year", "members[].years[].baselineIncreaseWorkingCapital = input member-year increaseWorkingCapital"],
    ["increaseWorkingCapital", "Combined baseline and incremental electricity WC", "nominal major currency/year", "members[].years[].increaseWorkingCapital = baselineIncreaseWorkingCapital + electricityPriceBridge.totals.increaseWorkingCapital"],
    ["fcfe", "Company cash flow includes accrual, tax and WC exactly once", "nominal major currency/year", "netIncome + depreciation + otherCashAdjustments - capex - increaseWorkingCapital + netBorrowing; netIncome recomputed after electricity accrual and max(0, preTaxIncome)*taxRate"],
  ]).map(s => ({ ...s, dependencies: [
    `members[].years[].${s.id.split(".").at(-1)}`,
    `${outputPrefix}.totals.netAccrualExpense`, `${outputPrefix}.totals.increaseWorkingCapital`,
    `${inputPrefix}.currency`,
  ] })),
];
