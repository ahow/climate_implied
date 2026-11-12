/**
 * Allowlisted supplementary source review, separate from the original model freeze.
 * No private file reads, acquisition receipts, paths, raw filings or model changes.
 */
export const producerPrimaryAuthentication = {
  status: "supplementary-primary-table-authentication-resolved",
  scope: "Exxon Mobil Corporation FY2024 consolidated-subsidiary producer tables only",
  officialUrl: "https://www.sec.gov/Archives/edgar/data/34088/000003408825000010/xom-20241231.htm",
  officialHttpStatus: 200,
  entity: "Exxon Mobil Corporation",
  cik: "0000034088",
  accessionNumber: "0000034088-25-000010",
  form: "10-K",
  fiscalEnd: "2024-12-31",
  filingDate: "2025-02-19",
  publishedAt: "2025-02-19T21:39:37Z",
  publicationBasis: "Already-retained SEC submissions acceptanceDateTime; not mirror posting or acquisition time",
  comparedRows: 38,
  comparedNumericCells: 261,
  producerNumericFactsMatched: 39,
  allComparisonsPassed: true,
  hashes: {
    secSubmissionsSha256: "79aacad669ef044bf654934b659b9fda89514e0ba5514838dbfb787d53e48773",
    officialHtmlSha256: "b13a42242d1f6e8baa39cd4126f3fd7ce2aa4cb326d882398880f9da44f04786",
    priorOfficialHtmlSha256: "01d1d6f0831e7d4e85727d24cc3b8195c97cff2cd645effed40b58663e79ea41",
    officialHtmlWithoutScriptNoscriptSha256: "ef8063b86ee33c8bcc1465c3c853752294a3397867621e1762c8fe45abf0ffc5",
  },
  originalFreezeUnchanged: true,
  remainingAuthenticationLimits: [
    "Complete mirrored PDF byte identity to an issuer-hosted original and mirror publication time remain unestablished.",
    "SEC HTML equality after removal of script/noscript elements and selected numeric-row matches do not establish full-page textual equality or complete mirror PDF authentication.",
    "FY2024 registrant identity does not approve successor legal/security continuity or an automatic ticker join.",
    "Public issuer-authored filing access grants no raw-source republication licence or owner authorization.",
    "Owner review, legal ownership allocation and common-equity claim coverage remain unapproved.",
    "Fiscal/cash timing, terminal assumptions, freeze uniqueness, economic sufficiency and scientific or whole-equity acceptance are not established by source-table authentication.",
  ],
} as const;

export type ProducerPrimaryAuthentication = typeof producerPrimaryAuthentication;

/** Exact public allowlist check: rejects added private fields and changed claims. No IO. */
export function isExactProducerPrimaryAuthentication(value: unknown): value is ProducerPrimaryAuthentication {
  const exact = (actual: unknown, expected: unknown): boolean => {
    if (actual === expected) return true;
    if (Array.isArray(expected))
      return Array.isArray(actual) && actual.length === expected.length &&
        Reflect.ownKeys(actual).length === expected.length + 1 &&
        expected.every((entry, index) => exact(actual[index], entry));
    if (expected === null || typeof expected !== "object" ||
        actual === null || typeof actual !== "object" || Array.isArray(actual)) return false;
    const keys = Object.keys(expected);
    return Reflect.ownKeys(actual).length === keys.length && keys.every(key =>
      Object.prototype.hasOwnProperty.call(actual, key) &&
      exact((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key]));
  };
  return exact(value, producerPrimaryAuthentication);
}
