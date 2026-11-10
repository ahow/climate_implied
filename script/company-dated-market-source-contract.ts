import { primaryCommonSharesSchema } from "../server/calculation/companyShareEvidence";

/** Each exact primary observation is its own target. In particular, the two
 * XOM CIKs/classes are NEVER deduplicated or joined by their shared ticker. */
export function primaryDatedQuoteTargets(observations: unknown[]) {
  return observations.map(input => {
    const source = primaryCommonSharesSchema.parse(input);
    if (!source.allCommonClassesCovered || source.classes.length !== 1 ||
        source.classes[0].precision !== "exact")
      throw new Error("Quote targeting requires exact primary common shares, not float, weighted-average EPS or rounded shares");
    const common = source.classes[0];
    if (common.issued !== null && common.treasury !== null &&
        common.issued - common.treasury !== common.outstanding)
      throw new Error("Primary outstanding shares do not reconcile");
    return { symbol: source.symbol, cik: source.cik, security: common.security,
      quoteDateRequired: source.effectiveDate, primaryShares: common.outstanding,
      sharePublishedDate: source.evidence.publishedDate, shareSourceHash: source.evidence.sha256,
      shareSourceUrl: source.evidence.url, shareCapturedAt: source.evidence.capturedAt,
      informationTreatment: source.evidence.publishedDate > source.effectiveDate ?
        "Later publication of exact dated shares: conditional assembly only, not known at that historical close" :
        "Publication date alone does not establish an intraday information cutoff",
      identityApproved: false, automaticTickerJoin: false };
  });
}

export type PublicSourceReceipt = {
  id: string; status: string; httpStatus: number | null;
  sha256: string | null; capturedAt: string; requestedQuoteDate: string | null;
};
/** Deliberate allowlist: raw quote prices, shares, source bodies, URLs,
 * request headers, cookies and session tokens NEVER enter public receipts. */
export function publicSourceReceipt(receipt: Record<string, unknown>): PublicSourceReceipt {
  return { id: String(receipt.id), status: typeof receipt.status === "string" ? receipt.status :
    typeof receipt.httpStatus === "number" ? `HTTP-${receipt.httpStatus}` : "not-observed",
  httpStatus: typeof receipt.httpStatus === "number" ? receipt.httpStatus : null,
  sha256: typeof receipt.sha256 === "string" ? receipt.sha256 : null,
  capturedAt: String(receipt.capturedAt),
  requestedQuoteDate: typeof receipt.requestedQuoteDate === "string" ? receipt.requestedQuoteDate : null };
}

/** The official non-split endpoint names its prices adjClose. Preserve that
 * field name and document semantics; never infer currency from its magnitude. */
export function inspectFmpDatedUnadjustedRows(rows: Record<string, unknown>[],
  target: ReturnType<typeof primaryDatedQuoteTargets>[number]) {
  const exact = rows.filter(row => row.symbol === target.symbol && row.date === target.quoteDateRequired);
  const issues: string[] = [];
  if (exact.length !== 1) issues.push("Expected one exact symbol/date row; no nearest-date selection or forward-fill.");
  const row = exact.length === 1 ? exact[0] : null;
  const close = row?.adjClose;
  if (typeof close !== "number" || !Number.isFinite(close) || close <= 0)
    issues.push("Missing explicit positive numeric adjClose in documented non-split response.");
  return {
    status: issues.length ? "blocked-response-fields" : "same-date-price-primary-shares-candidate",
    issues, target, responseFields: rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v]))),
    quoteDate: row?.date ?? null, rawPriceField: "adjClose", unadjustedClose: typeof close === "number" ? close : null,
    priceBasis: "Official non-split-adjusted endpoint is documented WITHOUT stock-split adjustments; adjClose is its literal response key. No transformation applied.",
    currency: typeof row?.currency === "string" ? row.currency : null,
    unitEvidence: typeof row?.currency === "string" ? "Currency explicitly returned; class/listing units still require review" :
      "Response omits currency/unit; no currency or minor-unit conversion inferred. Listing/currency evidence remains separate.",
    primarySharesSourceHash: target.shareSourceHash,
    quoteResponseDoesNotAuthenticateCikOrClass: !row || !Object.hasOwn(row, "cik") || !Object.hasOwn(row, "security"),
    identityApproved: false, productionEligible: false, actualValuationPairs: 0 };
}
