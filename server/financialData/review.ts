import { createHash } from "node:crypto";
import { z } from "zod";
import { reviewedIdentitySchema } from "./identity";
import { majorCurrency, normalizeMonetaryValue, quoteCurrencySchema } from "./currencies";

export const snapshotSchema = z.object({
  identity: reviewedIdentitySchema,
  quote: z.object({
    price: z.number().finite().positive(), marketCap: z.number().finite().positive(),
    marketCapCurrency: quoteCurrencySchema.optional(),
    observedAt: z.string().datetime(),
  }).strict(),
  statement: z.object({
    netIncome: z.number().finite(), period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    filingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }).strict(),
  fetchedAt: z.string().datetime(),
}).strict().superRefine((v, ctx) => {
  const quoteMajor = majorCurrency(v.identity.currency);
  if (quoteMajor !== v.identity.currency && !v.quote.marketCapCurrency) ctx.addIssue({
    code: "custom", message: "Minor-unit quotes require an explicit market-cap denomination",
  });
  if (quoteMajor !== v.statement.currency ||
      majorCurrency(v.quote.marketCapCurrency ?? v.identity.currency) !== v.statement.currency) ctx.addIssue({
    code: "custom", message: "Quote and statement currency must match; no implied FX conversion",
  });
  if (v.statement.filingDate < v.statement.period) ctx.addIssue({ code: "custom", message: "Filing precedes reporting period" });
  if (new Date(v.quote.observedAt).getTime() > new Date(v.fetchedAt).getTime() + 300000)
    ctx.addIssue({ code: "custom", message: "Quote timestamp is in the future" });
});
export type FinancialSnapshot = z.infer<typeof snapshotSchema>;
export type ReviewStatus = "pending" | "approved" | "rejected" | "superseded";
export function snapshotId(snapshot: FinancialSnapshot) {
  const { fetchedAt, ...economicInputs } = snapshotSchema.parse(snapshot);
  return createHash("sha256").update(JSON.stringify(economicInputs)).digest("hex");
}
export function transition(status: ReviewStatus, decision: "approved" | "rejected"): ReviewStatus {
  if (status === decision) return status;
  if (status !== "pending") throw new Error("Only pending proposals can change state");
  return decision;
}
export function financialCalculation(snapshot: FinancialSnapshot, now = Date.now()) {
  const s = snapshotSchema.parse(snapshot);
  const normalizedQuotePrice = normalizeMonetaryValue(s.quote.price, s.identity.currency);
  const normalizedMarketCap = normalizeMonetaryValue(s.quote.marketCap, s.quote.marketCapCurrency ?? s.identity.currency);
  return {
    inputId: snapshotId(s),
    normalizedQuotePrice, normalizedMarketCap,
    priceToLastAnnualEarnings: s.statement.netIncome > 0 ? normalizedMarketCap.value / s.statement.netIncome : null,
    reason: s.statement.netIncome > 0 ? null : "Annual earnings are non-positive",
    quoteAgeHours: Math.max(0, (now - new Date(s.quote.observedAt).getTime()) / 3600000),
  };
}
