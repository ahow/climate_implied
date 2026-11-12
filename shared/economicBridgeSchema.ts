/** Supplemental prospective calculations only. Never part of original1001,
 * the fixed prior matrix, old124 results, or the fourteen FaIR pins. */
export const economicBridgeContracts = {
  retirementAssociation: {
    route: "/api/cv/retirement-association",
    claim: "Public coal-unit book arithmetic and unscored retirement/association methods; no market-implied retirement, common-equity valuation, accepted issuer case or causal inference",
  },
  producerReserve: {
    route: "/api/cv/producer-reserve",
    claim: "Prospective deterministic public producer/reserve conditional calculation; not issuer approval, observed cash, retained execution or investment advice",
  },
  locationElectricity: {
    route: "/api/cv/location-electricity",
    claim: "Public location/electricity source findings and deterministic contextual unit conversion only; issuer cash bridge not executed because required inputs are missing. Not issuer approval, qualified economics, retained execution or investment advice",
  },
} as const;
export type EconomicBridgeKey = keyof typeof economicBridgeContracts;
/** Exact additional browser writers, not permission for arbitrary Blob URLs.
 * The portable AST audit verifies the named reader -> shared readback -> exact
 * selected-body comparison chain before registering either writer. */
export const economicBridgeDownloadWriters = [
  {
    key:"retirementAssociation",
    source:"client/src/components/retirement-association-panel.tsx",
    readerSource:"client/src/lib/retirement-association-reader.ts",
    reader:"readBoundRetirementAssociationExport",
    parser:"parseRetirementAssociationDocument",
    filename:"supplemental-retirementAssociation-${document.identity.id}.${format}",
    route:economicBridgeContracts.retirementAssociation.route,
    formats:["json","xlsx"],
    kind:"valuation",
    readbackSource:"client/src/lib/economic-export-readback.ts",
    readback:"readBoundEconomicExport",
    body:"Complete currently consumed EconomicBridgeDocument, including full prospective identity, units, formulas, literal nulls and container types",
    boundary:economicBridgeContracts.retirementAssociation.claim,
    original1001Delta:0,
    fixedPriorMatrixDelta:0,
  },
  {
    key: "producerReserve",
    source: "client/src/components/producer-reserve-panel.tsx",
    readerSource: "client/src/lib/producer-reserve-reader.ts",
    reader: "readBoundProducerReserveExport",
    parser: "parseProducerReserveDocument",
    filename: "supplemental-producerReserve-${document.identity.id}.${format}",
    route: economicBridgeContracts.producerReserve.route,
    formats: ["json", "xlsx"],
    kind: "valuation",
    readbackSource: "client/src/lib/economic-export-readback.ts",
    readback: "readBoundEconomicExport",
    body: "Complete currently consumed EconomicBridgeDocument, including full prospective identity, units, formulas, literal nulls and container types",
    boundary: economicBridgeContracts.producerReserve.claim,
    original1001Delta: 0,
    fixedPriorMatrixDelta: 0,
  },
  {
    key: "locationElectricity",
    source: "client/src/components/location-electricity-panel.tsx",
    readerSource: "client/src/lib/location-electricity-reader.ts",
    reader: "readBoundLocationElectricityExport",
    parser: "parseLocationElectricityDocument",
    filename: "supplemental-locationElectricity-${document.identity.id}.${format}",
    route: economicBridgeContracts.locationElectricity.route,
    formats: ["json", "xlsx"],
    kind: "valuation",
    readbackSource: "client/src/lib/economic-export-readback.ts",
    readback: "readBoundEconomicExport",
    body: "Complete currently consumed EconomicBridgeDocument, including full prospective identity, units, formulas, literal nulls and container types",
    boundary: economicBridgeContracts.locationElectricity.claim,
    original1001Delta: 0,
    fixedPriorMatrixDelta: 0,
  },
] as const;
/** Formulas transcribed from the actual worker calculation, not a second
 * calculator. The code closure checks that executed source bytes remain exact. */
export const producerReserveCalculationSemantics = [
  { field: "annualRows[].year", unit: "calendar year", formula: "2024 + t; t = 1,...,100" },
  { field: "annualRows[].openingReserves", unit: "million boe", formula: "R[t-1]; R[0] = disclosed consolidated closing proved reserves" },
  { field: "annualRows[].production", unit: "million boe/year", formula: "min(R[t-1], (-disclosed FY2024 reserve production) * (1-d)^(t-1))" },
  { field: "annualRows[].replacement", unit: "million boe/year", formula: "0, explicit closed-pool conditional assumption, not an observed forward zero" },
  { field: "annualRows[].closingReserves", unit: "million boe", formula: "max(0, R[t-1] - Q[t])" },
  { field: "annualRows[].revenue", unit: "USD million/year", formula: "Q[t] / R[0] * disclosed standardized future revenue * revenueMultiplier" },
  { field: "annualRows[].productionCostsIncludingAbandonment", unit: "USD million/year", formula: "Q[t] / R[0] * disclosed standardized future production costs * costMultiplier; abandonment included once" },
  { field: "annualRows[].developmentCapex", unit: "USD million/year", formula: "Q[t] / R[0] * disclosed standardized future development costs * costMultiplier" },
  { field: "annualRows[].cashTaxes", unit: "USD million/year", formula: "Q[t] / R[0] * disclosed standardized future income taxes; fixed per boe, not price-responsive tax" },
  { field: "annualRows[].deltaWorkingCapital", unit: "USD million/year", formula: "0, explicit conditional assumption; no inferred actual segment working capital" },
  { field: "annualRows[].unleveredCashFlow", unit: "USD million/year", formula: "revenue - productionCostsIncludingAbandonment - developmentCapex - cashTaxes - deltaWorkingCapital" },
  { field: "annualRows[].discountedCashFlow", unit: "USD million at 2024-12-31", formula: "unleveredCashFlow / (1 + discountRate)^t; annual year-end; no stub" },
  { field: "baseResult.decline", unit: "fraction/year", formula: "Conditional bisection root of sum(discountedCashFlow) - disclosed consolidated reserve PV10 = 0 within frozen [0,0.08]; positive-margin/discount analytic uniqueness gate" },
  { field: "baseResult.residualUsdMillion", unit: "USD million", formula: "sum(discountedCashFlow) - disclosed standardized PV10; null on refusal" },
  { field: "sensitivityRows[].discountRate", unit: "fraction/year", formula: "Frozen one-factor deterministic discountRate; not probability" },
  { field: "sensitivityRows[].revenueMultiplier", unit: "dimensionless", formula: "Frozen one-factor revenue deck multiplier; not probability" },
  { field: "sensitivityRows[].costMultiplier", unit: "dimensionless", formula: "Frozen one-factor production/development cost multiplier; fixed tax per boe" },
  { field: "sensitivityRows[].valueAtZeroDecline", unit: "USD million", formula: "sum(discountedCashFlow) at frozen decline lower bound 0" },
  { field: "sensitivityRows[].valueAtMaximumDecline", unit: "USD million", formula: "sum(discountedCashFlow) at frozen decline upper bound 0.08" },
  { field: "marketEquityTarget,marketImpliedDecline,fcfe", unit: "not applicable / unidentified", formula: "Explicit null; no upstream market allocation or enterprise-to-equity/FCFE bridge, never substitute reserve PV10 for equity" },
] as const;
export interface EconomicBridgeDocument {
  version: "supplemental-economic-calculation-1";
  key: EconomicBridgeKey;
  report: unknown;
  identity: {
    version: "prospective-economic-identity-1";
    key: EconomicBridgeKey;
    claim: string;
    codeArtifact: {
      id: string;
      contract: "calculation-source-1";
      files: { path: string; sha256: string }[];
    };
    sourceArtifact: { id: string; value: unknown };
    materialInputs: { id: string; value: unknown };
    assumptions: { id: string; value: unknown };
    model: { id: string; value: unknown };
    parent: { kind: "public-prospective-inputs"; id: string; retainedResultId: null };
    derivation: { id: string; value: unknown };
    resultHash: string;
    retainedExecution: false;
    originalHistoricalExport: false;
    sourceApproval: false;
    scientificAcceptance: false;
    id: string;
  };
}
export interface EconomicBridgeCell { pointer: string; jsonValue: string }
/** Every scalar AND container type is preserved. JSON pointer escaping prevents
 * field-name ambiguity. JSON text preserves null, finite numbers and strings. */
export function economicBridgeCells(value: unknown): EconomicBridgeCell[] {
  const rows: EconomicBridgeCell[] = [];
  function visit(item: unknown, pointer: string) {
    if (item !== null && typeof item === "object" && Object.keys(item).length) {
      rows.push({ pointer, jsonValue: Array.isArray(item) ? "[]" : "{}" });
      for (const [key, child] of Object.entries(item)) {
        visit(child, `${pointer}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`);
      }
    } else {
      const jsonValue = JSON.stringify(item);
      if (jsonValue === undefined || jsonValue.length > 32767 || pointer.length > 32767)
        throw new Error("Public calculation cannot be represented as literal XLSX cells");
      rows.push({ pointer, jsonValue });
    }
  }
  visit(value, "");
  return rows;
}
export function readEconomicBridgeCells(rows: EconomicBridgeCell[]): unknown {
  if (!rows.length || rows[0].pointer !== "") throw new Error("Missing calculation workbook root");
  const root: unknown = JSON.parse(rows[0].jsonValue);
  const seen = new Set([""]);
  for (const row of rows.slice(1)) {
    if (!row.pointer.startsWith("/") || seen.has(row.pointer)) throw new Error("Invalid or repeated calculation pointer");
    seen.add(row.pointer);
    const keys = row.pointer.slice(1).split("/").map(key => {
      if (/~(?![01])/g.test(key)) throw new Error("Invalid calculation pointer escape");
      return key.replace(/~1/g, "/").replace(/~0/g, "~");
    });
    let parent = root;
    for (const key of keys.slice(0, -1)) {
      if (!parent || typeof parent !== "object" || !Object.hasOwn(parent, key))
        throw new Error("Missing calculation pointer parent");
      parent = (parent as Record<string, unknown>)[key];
    }
    const key = keys[keys.length - 1];
    if (!parent || typeof parent !== "object" || Object.hasOwn(parent, key) ||
      Array.isArray(parent) && (!/^(?:0|[1-9]\d*)$/.test(key) || Number(key) !== parent.length))
      throw new Error("Conflicting calculation pointer");
    Object.defineProperty(parent, key, { value: JSON.parse(row.jsonValue), enumerable: true, writable: true, configurable: true });
  }
  return root;
}
export const economicBridgeSupplementalCensus = {
  version: "supplemental-economic-census-1",
  original1001Delta: 0,
  fixedPriorMatrixDelta: 0,
  old124Delta: 0,
  fairPinDelta: 0,
  routes: Object.values(economicBridgeContracts).flatMap(({ route }) =>
    [route, `${route}/export.json`, `${route}/export.xlsx`]),
  jsonSuccessSurfaces: Object.values(economicBridgeContracts).flatMap(({ route }) => [route, `${route}/export.json`]),
  binarySuccessSurfaces: Object.values(economicBridgeContracts).map(({ route }) => `${route}/export.xlsx`),
  workbook: {
    sheet: "Public calculation",
    columns: ["JSON pointer", "Literal JSON value"],
    semantics: "Exact ordered lossless scalar/container-type serialization of the same API body, including units, formulas, missingness and prospective identity. No spreadsheet formulas.",
  },
  refusalFields: { error: "Explicit request/source/code/parent/derivation verification refusal message" },
  boundary: "New additive read-only prospective calculations. No original cohort closure credit, denominator changes, qualified issuer cases, real approvals, private raws, provider calls or retained execution.",
} as const;
