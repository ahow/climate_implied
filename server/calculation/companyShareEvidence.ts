import { z } from "zod";

const day = z.string().date();
const evidence = z.object({
  url: z.string().url(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  capturedAt: z.string().datetime(), publishedDate: day,
  publicationBasis: z.enum(["issuer-filing-index", "signed-report-date"]),
  locator: z.string().min(1),
}).strict();
export const primaryCommonSharesSchema = z.object({
  symbol: z.string().min(1), cik: z.string().regex(/^\d{10}$/),
  issuer: z.string().min(1), effectiveDate: day,
  classes: z.array(z.object({
    security: z.string().min(1), outstanding: z.number().int().positive(),
    precision: z.enum(["exact", "rounded-millions"]),
    issued: z.number().int().positive().nullable(),
    treasury: z.number().int().nonnegative().nullable(),
  }).strict()).min(1),
  allCommonClassesCovered: z.boolean(), evidence,
}).strict();

/** Evidence review only. Same ticker, rounded balance-sheet shares and a later
 * cover count never authorize a dated market reference or an identity merge. */
export function reviewCompanyShareReference(input: unknown, quote: {
  symbol: string; cik: string; security: string; priceDate: string;
  informationCutoffDate?: string;
}) {
  const x = primaryCommonSharesSchema.parse(input);
  const gaps: string[] = [];
  if (x.symbol !== quote.symbol || x.cik !== quote.cik)
    gaps.push("Issuer identity differs; corporate succession requires separate review, never a ticker join.");
  if (x.classes.length !== 1 || x.classes[0].security !== quote.security)
    gaps.push("Class-specific pricing and common-equity claim allocation required.");
  if (!x.allCommonClassesCovered) gaps.push("All common classes are not evidenced.");
  if (x.classes.some(c => c.precision !== "exact")) gaps.push("Rounded shares cannot establish exact dated common equity.");
  if (x.effectiveDate !== quote.priceDate) gaps.push("Primary share effective date does not equal quote date; no carry-forward or interpolation.");
  if (x.evidence.publishedDate > (quote.informationCutoffDate ?? quote.priceDate))
    gaps.push("Share disclosure was published after the information cutoff for the proposed reference.");
  if (x.evidence.publicationBasis !== "issuer-filing-index")
    gaps.push("Signed report date is not independently verified public availability.");
  for (const c of x.classes) {
    if (c.issued !== null && c.treasury !== null && c.issued - c.treasury !== c.outstanding)
      gaps.push("Issued less treasury does not reconcile to outstanding shares.");
  }
  return { status: gaps.length ? "blocked" as const : "candidate-requires-review" as const,
    gaps, shares: x.classes.reduce((n, c) => n + c.outstanding, 0),
    source: x, identityApproved: false, productionEligible: false,
    captureTreatment: "capturedAt is actual retrieval time, never backdated to publishedDate or effectiveDate" };
}
