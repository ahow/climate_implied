/** Counterparty-side cash partition; NEVER substitutes XPLR's NCI for NEE's consolidated NCI. */
export function extractNeeRelatedPartnerCash(html: string) {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  for (const clause of ["NEE's Indirect Noncontrolling Ownership Interests", "Distributions related to the noncontrolling interests, other than the differential membership interests and Class B noncontrolling membership interests, are reflected as partner distributions",
    "Primarily reflects NEE Equity", "Silver State", "Sunlight Renewables Holdings", "Emerald Breeze"])
    if (!text.includes(clause)) throw new Error(`Actual counterparty classification required: ${clause}`);
  const contexts = new Map(Array.from(html.matchAll(/<xbrli:context\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/xbrli:context>/g)).map(m => [m[1], m[2]]));
  const facts = Array.from(html.matchAll(/<ix:nonFraction\b([^>]+)>([\s\S]*?)<\/ix:nonFraction>/g));
  const member = "xplr:NoncontrollingOwnershipInterestsInXPLROpCoTexasPipelineAndSilverStateMember";
  function f(name: string, dimension: boolean, instant?: number) {
    const matches = facts.filter(m => {
      const attr = (key: string) => m[1].match(new RegExp(`\\b${key}="([^"]+)"`))?.[1];
      const c = contexts.get(attr("contextRef") ?? "") ?? "";
      return attr("name") === name && attr("unitRef") === "usd" &&
        /<xbrli:identifier\b[^>]*>0001603145<\/xbrli:identifier>/.test(c) &&
        (dimension ? c.includes(`>${member}</xbrldi:explicitMember>`) : !c.includes("<xbrli:segment>")) &&
        (instant ? c.includes(`<xbrli:instant>${instant}-12-31</xbrli:instant>`) :
          c.includes("<xbrli:startDate>2024-01-01</xbrli:startDate>") && c.includes("<xbrli:endDate>2024-12-31</xbrli:endDate>"));
    }).map(m => Number(m[2].replace(/<[^>]*>/g, "").replace(/,/g, "")) *
      10 ** Number(m[1].match(/\bscale="([^"]+)"/)?.[1] ?? 0) * (m[1].includes('sign="-"') ? -1 : 1));
    const unique = Array.from(new Set(matches));
    if (unique.length !== 1 || !Number.isFinite(unique[0])) throw new Error(`Unique authenticated counterparty fact required: ${name}`);
    return unique[0];
  }
  return {
    version: "nee-related-partner-cash-1", fiscalYear: 2024, currency: "USD",
    totalPartnerCashDistributions: f("us-gaap:PaymentsOfCapitalDistribution", false),
    publicUnitDistributions: f("us-gaap:LimitedPartnersCapitalAccountDistributionAmount", false),
    allOtherOwnerDistributions: f("xplr:RelatedPartyDistributions", false),
    neeCategoryDistributions: f("xplr:RelatedPartyDistributions", true),
    neeCategoryContributionsEquityMovement: f("xplr:RelatedPartyContributions", true),
    totalPartnerCashContributions: f("us-gaap:ProceedsFromPartnershipContribution", false),
    neeCategoryOpeningEquity: f("us-gaap:MinorityInterest", true, 2023),
    neeCategoryClosingEquity: f("us-gaap:MinorityInterest", true, 2024),
    neeCategoryNoteReceivableMovement: f("xplr:NoncontrollingInterestIncreaseDecreaseFromMemberNoteReceivable", true),
    neeCategoryIncome: f("us-gaap:NetIncomeLossAttributableToNoncontrollingInterest", true),
    neeCategoryOtherEquityMovement: f("xplr:StockholdersEquityOther1", true)
  };
}
export function reconcileNeeRelatedPartnerCash(s: ReturnType<typeof extractNeeRelatedPartnerCash>) {
  if (s.fiscalYear !== 2024 || s.currency !== "USD" || Object.values(s).some(v => typeof v === "number" && !Number.isFinite(v)))
    throw new Error("Authentic finite FY2024/USD counterparty input required");
  const cashPartitionResidual = s.totalPartnerCashDistributions - s.publicUnitDistributions - s.allOtherOwnerDistributions;
  const otherOwnerDistributions = s.allOtherOwnerDistributions - s.neeCategoryDistributions;
  const closing = s.neeCategoryOpeningEquity + s.neeCategoryNoteReceivableMovement + s.neeCategoryIncome +
    s.neeCategoryContributionsEquityMovement - s.neeCategoryDistributions + s.neeCategoryOtherEquityMovement;
  if (cashPartitionResidual !== 0 || closing !== s.neeCategoryClosingEquity || otherOwnerDistributions < 0)
    throw new Error("Counterparty cash/equity partition did not close");
  return {
    version: s.version, grossDistributionsInNeeIndirectOwnershipCategoryUsd: s.neeCategoryDistributions,
    otherOwnerCashDistributionsUsd: otherOwnerDistributions,
    neeCategoryContributionsEquityMovementUsd: s.neeCategoryContributionsEquityMovement,
    distributionsLessContributionEquityMovementUsd: s.neeCategoryDistributions - s.neeCategoryContributionsEquityMovement,
    distributionsLessContributionIsCertifiedNetCash: false,
    cashPartitionResidualUsd: cashPartitionResidual, equityRollforwardResidualUsd: closing - s.neeCategoryClosingEquity,
    exactSubsetOfNee811mOperatingAffiliateCashUsd: null, contributionCashInNeeCategoryUsd: null,
    neeConsolidatedGrossNonDmiCashSolved: false, futureCommonCashAddedUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "Counterparty FY2024NEE-indirect-owner category, footnote primarily NEEEquity/NEER; not sole XPLROpCo common distribution. Not NEE's outgoing consolidated NCI.422m cannot be deducted from811m operating affiliate cash without NEE cash-flow classification/recipient mapping.58m is an equity contribution movement, not automatically cash; total partner cash contributions63m has no programme recipient bridge. No FY2025future remittance or owner allocation inferred."
  };
}
