import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { conditionalCompanySummary, conditionalExportCells, conditionalFactEvidenceReference, type getConditionalCompanySummary } from "./companyConditionalData";

export const conditionalCompanyApiSurfaces = [
  'API GET "/api/cv/company-conditional-summaries"',
  'API GET "/api/cv/company-conditional-summaries/export.json"',
] as const;
export const conditionalCompanyWorkbookSurface = 'API GET "/api/cv/company-conditional-summaries/export.xlsx"';
export const conditionalCompanyFieldSpecs: [string, string, string, string][] = [
  ["schemaVersion", "Immutable public allowlist schema version", "company-conditional-public-1", "identifier"],
  ["scope", "Supplemental research boundary, not original closure", "literal supplemental S12/S16 research qualification", "text"],
  ["readOnly", "No mutation/calculation inputs supported", "literal true", "boolean"],
  ["sourceApproval", "Public aggregate allowlist boundary, not source/scientific certification", "immutable-public-derived-aggregate-allowlist", "label"],
  ["qualifiedOriginalIssuers", "Qualified original issuers across this snapshot", "literal 0; conditional paths do not qualify", "issuers"],
  ["requiredOriginalIssuers", "Original issuer requirement denominator", "literal 3", "issuers"],
  ["qualifiedOriginalPairs", "Qualified original signal/valuation pairs", "literal 0", "pairs"],
  ["tier2Promoted", "No Tier2 promotion", "literal false", "boolean"],
  ["efficacyPromoted", "No efficacy promotion", "literal false", "boolean"],
  ["originalClosure", "No original requirement closure", "literal false", "boolean"],
  ["frozenProtocolsChanged", "No frozen protocol changes by presentation/export", "literal false", "boolean"],
  ["companies[].issuer", "Exact allowlisted company discriminator", "NEE | FSLR | XOM; optional issuer query filters only this array", "issuer identifier"],
  ["companies[].name", "Issuer display name", "same-row immutable allowlisted name", "text"],
  ["companies[].experimentVersion", "Legacy frozen experiment version; additive integration versions are separately enumerated", "same-row default public evidence document version, not silently replaced by a new cohort integration", "identifier"],
  ["companies[].evidenceDocument", "Default legacy public evidence document locator, never a runtime read", "same-row docs/*.json; newer fact sourceLocator may explicitly identify a different public docs/*.json#pointer", "public document path"],
  ["companies[].informationContext", "Issuer-specific information/vintage boundary", "same-row retained revised-history and publication-cutoff qualification", "text"],
  ["companies[].qualifiedOriginalIssuers", "This conditional company does not qualify an original issuer", "literal 0", "issuers"],
  ["companies[].qualifiedOriginalPairs", "This conditional company does not qualify an original pair", "literal 0", "pairs"],
  ["companies[].facts[].id", "Exact fact discriminator within same-row issuer", "finite allowlisted issuer/fact key; not an arbitrary caller field", "fact identifier"],
  ["companies[].facts[].label", "Issuer-specific aggregate label", "same-row fact label from immutable public allowlist", "text"],
  ["companies[].facts[].value", "Allowlisted sourced/derived or conditional scalar, not a generic USD quantity", "same-row issuer/fact-specific formula; unit, classification, sourceLocator and boundary govern; conditionalCompany.fact.<issuer>.<id> binds each exact value", "same-row unit"],
  ["companies[].facts[].unit", "Exact unit of same-row value", "same-row retained unit; USD, GBP, UKA, tCO2e, counts and periods are not interchangeable", "unit identifier"],
  ["companies[].facts[].classification", "Observed/derived versus conditional distinction", "sourced-derived | conditional; neither implies whole-company qualification", "label"],
  ["companies[].facts[].formula", "Exact arithmetic or source/unknown explanation", "same-row public fact formula; no runtime parameter fitting", "formula text"],
  ["companies[].facts[].sourceLocator", "Exact test-time evidence value location", "explicit public docs/*.json#pointer when supplied, otherwise same-row default evidenceDocument#sourceLocator; no private runtime source reads", "public JSON locator"],
  ["companies[].facts[].boundary", "Fact-specific scope and limitations", "same-row explicit missingness, currency, funding or causal boundary", "text"],
  ["companies[].sourced[]", "Source-backed observations and their limitations", "immutable issuer-specific sourced disclosures", "text"],
  ["companies[].conditions[]", "Conditional scenario assumptions, not observations", "immutable issuer-specific conditions; no UI/query override", "text"],
  ["companies[].missingness[]", "Unresolved source/measurement gaps", "immutable issuer-specific missingness; unknown is never zero", "text"],
  ["companies[].refusalReasons[]", "Explicit reasons conditional results do not qualify", "immutable issuer-specific refusals; no root/uniqueness/efficacy promotion", "text"],
];

const common = {
  role: "Output" as const,
  source: "shared/companyConditionalData.ts: explicit immutable public derived aggregate allowlist; evidenceDocument/sourceLocator identify public receipts",
  period: "Issuer-specific FY2024 observations, separately enumerated later2025/2026collection facts and frozen conditional paths; exact same-row informationContext/sourceLocator/boundary control",
  geography: "NEE/FPL selected US/Canada cash scope; FSLR disclosed manufacturing assumptions; XOM selected English permits only; not global equity emissions",
  status: "Supplemental conditional research; 0/3 qualified original issuers, zero qualified pairs; no Tier2 or efficacy promotion",
  missingness: "Explicit null means unknown, not zero. No private/runtime source fallback; unsupported query rejects400",
  uncertainty: "No calibrated probability distribution. Counts describe frozen conditional scenarios, not likelihoods",
  scope: "Read-only allowlisted presentation and lossless JSON/XLSX export; not original closure or whole-company valuation acceptance",
  asOfRule: "Frozen experiment version and issuer-specific informationContext; revised history is not point-in-time evidence",
};
export const conditionalCompanySemantics: OutputFieldSemantic[] = [
  ...conditionalCompanyFieldSpecs.map(([field, meaning, formula, unit]) => ({
    ...common, id: `conditionalCompany.${field}`, meaning, formula, unit,
    dependencies: ["conditionalCompanySummary", field],
  })),
  ...conditionalCompanySummary.companies.flatMap(company => company.facts.map(fact => ({
    ...common, id: `conditionalCompany.fact.${company.issuer}.${fact.id}`,
    meaning: `${company.issuer}: ${fact.label}. ${fact.boundary}`,
    formula: fact.formula, unit: fact.unit,
    dependencies: [conditionalFactEvidenceReference(company, fact), `classification:${fact.classification}`],
    source: `${conditionalFactEvidenceReference(company, fact)}; public allowlist only, no runtime evidence reads`,
    missingness: fact.value === null ? `Explicit unknown null; ${fact.boundary}` : common.missingness,
  }))),
  {
    ...common, id: "conditionalCompany.error", meaning: "Unsupported query/presentation selection; no calculation or source mutation occurred",
    formula: "HTTP400: only optional scalar issuer NEE/FSLR/XOM accepted; unknown keys, repeated/structured issuer and unknown issuer reject",
    unit: "error message", dependencies: ["registerCompanyConditionalRoutes.readIssuer"],
  },
  {
    ...common, id: "conditionalCompany.export.field", meaning: "Exact flattened public JSON leaf path",
    formula: "conditionalExportCells: recurse ordered objects/arrays; array indexes retained as decimal path components",
    unit: "JSON leaf path", dependencies: ["getConditionalCompanySummary", "conditionalExportCells"],
  },
  {
    ...common, id: "conditionalCompany.export.jsonValue", meaning: "JSON-encoded primitive at same-row allowlisted field; not a common measurement unit",
    formula: "JSON.stringify(value); null is literal string null, strings remain JSON quoted, signed numbers/zero preserved; decode and bind same-row field/discriminators",
    unit: "JSON primitive serialization; decoded leaf has its exact qualified unit",
    dependencies: ["conditionalCompany.export.field", "conditionalCompanyFieldSpecs", "conditionalCompany.fact.<issuer>.<id>"],
  },
];

/** Verify the actual workbook payload, not just its two generic column names.
 * Every primitive must exactly equal the frozen summary leaf. Fact values use
 * issuer/id-qualified semantics, preserving unlike units and explicit nulls. */
export function bindConditionalExportCells(
  summary: ReturnType<typeof getConditionalCompanySummary>,
  cells: { field: string; jsonValue: string }[],
) {
  const definitions = new Map(conditionalCompanySemantics.map(s => [s.id, s]));
  const expected = conditionalExportCells(summary);
  if (expected.length !== cells.length || expected.some((cell, i) => cell.field !== cells[i].field))
    throw new Error("Conditional export requires complete ordered allowlisted leaf coverage");
  return cells.map(cell => {
    const keys = cell.field.split(".");
    let value: unknown = summary;
    for (const key of keys) {
      if (!value || typeof value !== "object" || !Object.hasOwn(value, key))
        throw new Error(`Unknown conditional export leaf: ${cell.field}`);
      value = (value as Record<string, unknown>)[key];
    }
    if (value !== null && typeof value === "object" || JSON.stringify(value) !== cell.jsonValue)
      throw new Error(`Conditional export value mismatch: ${cell.field}`);
    const normalized = cell.field.replace(/\.\d+/g, "[]");
    let id = `conditionalCompany.${normalized}`;
    if (/^companies\.\d+\.facts\.\d+\.value$/.test(cell.field)) {
      const company = summary.companies[Number(keys[1])];
      id = `conditionalCompany.fact.${company.issuer}.${company.facts[Number(keys[3])].id}`;
    }
    const semantic = definitions.get(id);
    if (!semantic) throw new Error(`Unmapped conditional export leaf: ${cell.field}`);
    return { field: cell.field, id, unit: semantic.unit, transform: "Lossless JSON primitive serialization; exact same-row unit/discriminators retained" };
  });
}
