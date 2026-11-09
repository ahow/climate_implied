import { z } from "zod";

export const quoteCurrencySchema = z.string().regex(/^(?:[A-Z]{3}|GBp|ZAc)$/);
const minor: Record<string, string> = { GBp: "GBP", ZAc: "ZAR", ILA: "ILS" };
/** Case is meaningful: GBP is pounds, GBp is pence. Never uppercase upstream. */
export function majorCurrency(currency: string) {
  quoteCurrencySchema.parse(currency);
  return minor[currency] ?? currency;
}
/** Apply only to values explicitly denominated in the supplied native unit.
 * Provider market capitalisation must not inherit a quote-price scale.
 */
export function normalizeMonetaryValue(value: unknown, currency: string) {
  const nativeValue = z.number().finite().parse(value);
  const target = majorCurrency(currency), factor = minor[currency] ? .01 : 1;
  return { value: nativeValue * factor, currency: target, nativeValue,
    nativeCurrency: currency, factor, method: "unit-normalization-not-FX" };
}
