import { extractNeeRelatedPartnerCash, reconcileNeeRelatedPartnerCash } from "./neeRelatedPartnerCash";
/** Equity-table presentation, not native taxonomy debit/credit sign. */
export function displayedEquityCellValue(html: string, tagIndex: number, magnitude: number) {
  const start = html.lastIndexOf("<td", tagIndex), end = html.indexOf("</td>", tagIndex);
  if (start < 0 || end < 0) throw new Error("Authentic visible equity-table cell required");
  const cell = html.slice(start, end).replace(/<[^>]*>/g, " ").replace(/&#160;|&nbsp;/g, " ").trim();
  if (!Number.isFinite(magnitude) || magnitude < 0) throw new Error("Finite visible magnitude required");
  return /\(/.test(cell) && /\)/.test(cell) ? -magnitude : magnitude;
}
/**
 * v1 correctly refused a nonclosing native-sign equity rollforward. Preserve it.
 * v2 explicitly reads the displayed equity-table signs for the three signed
 * equity movements; native taxonomy facts remain separately identified.
 */
export function extractNeeRelatedPartnerCashPresentation(html: string) {
  const native = extractNeeRelatedPartnerCash(html);
  const contexts = new Map(Array.from(html.matchAll(/<xbrli:context\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/g)).map(m => [m[1], m[2]]));
  const matchedRefs = Array.from(contexts.entries()).filter(([, c]) =>
    /<xbrli:identifier\b[^>]*>0001603145<\/xbrli:identifier>/.test(c) &&
    c.includes(">xplr:NoncontrollingOwnershipInterestsInXPLROpCoTexasPipelineAndSilverStateMember</xbrldi:explicitMember>") &&
    c.includes("<xbrli:startDate>2024-01-01</xbrli:startDate>") &&
    c.includes("<xbrli:endDate>2024-12-31</xbrli:endDate>")).map(([ref]) => ref);
  function displayed(name: string) {
    const ms = Array.from(html.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/g))
      .filter(m => m[1].includes(`name="${name}"`) &&
        matchedRefs.includes(m[1].match(/contextRef="([^"]+)"/)?.[1] ?? ""));
    const vs = ms.map(m => displayedEquityCellValue(html, m.index!,
      Number(m[2].replace(/<[^>]*>/g, "").replace(/,/g, "")) * 10 ** Number(m[1].match(/scale="([^"]+)"/)?.[1] ?? 0)));
    if (new Set(vs).size !== 1) throw new Error(`Unique displayed equity cell required: ${name}`);
    return vs[0];
  }
  return {
    ...native, version: "nee-related-partner-cash-2",
    neeCategoryNoteReceivableMovement: displayed("xplr:NoncontrollingInterestIncreaseDecreaseFromMemberNoteReceivable"),
    neeCategoryIncome: displayed("us-gaap:NetIncomeLossAttributableToNoncontrollingInterest"),
    neeCategoryOtherEquityMovement: displayed("xplr:StockholdersEquityOther1"),
    nativeEquitySignFacts: { note: native.neeCategoryNoteReceivableMovement, income: native.neeCategoryIncome, other: native.neeCategoryOtherEquityMovement },
    visibleEquityTablePresentationUsed: true
  };
}
export { reconcileNeeRelatedPartnerCash };
