import { z } from "zod";
import type { assessMapping } from "./provider";
import { validIsin } from "./isin";
import { quoteCurrencySchema } from "./currencies";

export const reviewedIdentitySchema = z.object({
  companyId: z.number().int().positive(),
  isin: z.string().refine(validIsin, "Invalid ISIN checksum"),
  symbol: z.string().min(1),
  currency: quoteCurrencySchema,
  exchange: z.string().min(1),
  shareClassFIGI: z.string().min(1),
  issuerId: z.string().min(3),
  marketCapScope: z.literal("issuer"),
  primaryListingEvidence: z.string().url().startsWith("https://"),
  issuerEvidence: z.string().url().startsWith("https://"),
  reviewedAt: z.string().datetime(),
});
export type ReviewedIdentity = z.infer<typeof reviewedIdentitySchema>;

/** An explicit evidenced review resolves a candidate; candidate selection alone does not. */
export function acceptIdentity(review: unknown, assessment: ReturnType<typeof assessMapping>) {
  const parsed = reviewedIdentitySchema.parse(review);
  if (assessment.isin !== parsed.isin || !assessment.candidates.some(c =>
    c.symbol === parsed.symbol && c.currency === parsed.currency && c.exchange === parsed.exchange &&
    c.shareClassFIGI === parsed.shareClassFIGI)) throw new Error("Review must match independently checked provider evidence");
  return parsed;
}
export function reconcileIdentities(inputs: Array<{ id: number; isin: string }>, accepted: ReviewedIdentity[]) {
  const companies = new Set<number>(), issuers = new Set<string>();
  for (const item of accepted) {
    reviewedIdentitySchema.parse(item);
    if (!inputs.some(i => i.id === item.companyId && i.isin === item.isin)) throw new Error("Identity not in input universe");
    if (companies.has(item.companyId) || issuers.has(item.issuerId)) throw new Error("Duplicate issuer/company acceptance");
    companies.add(item.companyId); issuers.add(item.issuerId);
  }
  const eligible = inputs.filter(i => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(i.isin)).length;
  return { universe: inputs.length, eligible, accepted: accepted.length,
    unresolved: eligible - accepted.length, outOfScope: inputs.length - eligible,
    coverage: eligible ? accepted.length / eligible : 0,
    passed: eligible > 0 && accepted.length / eligible >= .95,
    eligibilityRule: "All input records with structurally valid ISINs; frozen before provider matching" };
}
