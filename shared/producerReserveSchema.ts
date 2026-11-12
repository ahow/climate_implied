/** Aggregate-only producer research contract. Money is USD million; stocks/flows million boe. */
export type ProducerReserveSource = {
  id: string; entity: string; scope: string; period: string; unit: string;
  documentDate: string; documentDateBasis: string; retainedAt: string;
  url: string; pdfSha256: string; textSha256: string; locator: string;
};
export type ProducerReserveAssumption = {
  id: string; value: string | number | number[]; status: "conditional-not-observed";
  justification: string;
};
export type ProducerReserveYear = {
  year: number; openingReserves: number; production: number; replacement: number;
  closingReserves: number; revenue: number; productionCostsIncludingAbandonment: number;
  developmentCapex: number; cashTaxes: number; deltaWorkingCapital: number;
  unleveredCashFlow: number; discountedCashFlow: number;
};
export type ProducerReserveSolve = {
  status: "unique-conditional-root" | "no-root" | "multiple-roots" | "nonidentified" | "unsupported-basis";
  decline: number | null; residualUsdMillion: number | null;
  roots: number[]; reason: string; iterations: number; domainHash: string;
};
export type ProducerReserveSensitivity = {
  id: string; discountRate: number; revenueMultiplier: number; costMultiplier: number;
  valueAtZeroDecline: number; valueAtMaximumDecline: number; result: ProducerReserveSolve;
};
export type ProducerReplacementPlan = {
  label: string;
  basis: "explicit-conditional-not-observed";
  moneyBasis: "same fixed-dollar USD million as reserve diagnostic";
  annual: {
    year: number; additionsMillionBoe: number; requestedIncrementalProductionMillionBoe: number;
    replacementCashCapexUsdMillion: number;
    revenuePerBoe: number; operatingAndProductionTaxCostPerBoe: number; cashIncomeTaxPerBoe: number;
    deltaWorkingCapitalUsdMillion: number; evidenceOrConditionalJustification: string;
  }[];
};
export type ProducerReserveReport = {
  schemaVersion: "producer-reserve-v1"; id: string; title: string; label: string;
  status: "conditional-diagnostic-only"; entity: string; valuationDate: string;
  calculationBasis: string; moneyUnit: "USD million"; physicalUnit: "million boe";
  marketEquityTarget: null; marketImpliedDecline: null; fcfe: null;
  ownerApproved: false; scienceAccepted: false; threeCaseAcceptance: false;
  sourceRegister: ProducerReserveSource[]; assumptionRegister: ProducerReserveAssumption[];
  historical: Record<string, unknown>; target: Record<string, unknown>;
  baseResult: ProducerReserveSolve; annualRows: ProducerReserveYear[];
  sensitivityRows: ProducerReserveSensitivity[]; refusalRows: ProducerReserveSolve[];
  reconciliation: Record<string, unknown>; sourceGaps: string[];
  replacementContract: Record<string, unknown>;
  hashes: { parent: string; source: string; material: string; model: string; domain: string };
  preservation: string[]; privateValidationRequired: string[];
};
