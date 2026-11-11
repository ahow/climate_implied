/** Discovery-only adapter: corporate registrations/guarantees never certify an operating CCS contract. */
export function successorPlain(s: string): string {
  return s.replace(/<ix:header[\s\S]*?<\/ix:header>/g, "").replace(/<[^>]*>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}
const expectedEntities = ["Elk Merger Sub II, L.L.C.", "EnLink CCS, LLC", "EnLink Midstream Operating, LP", "EnLink Midstream Partners, LP", "EnLink Midstream Services, LLC"];
export function extractSuccessorSubsidiaryInventory(html: string) {
  const t = successorPlain(html);
  if (!/ONEOK, Inc\./.test(t) || !/SUBSIDIARIES OF THE COMPANY AS OF DECEMBER 31, 2025/.test(t)) throw new Error("Wrong dated subsidiary inventory");
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map(m => successorPlain(m[1]));
  const entities = expectedEntities.map(name => {
    const matched = rows.filter(r => r.startsWith(`${name} `));
    if (matched.length !== 1) throw new Error(`Missing/ambiguous source subsidiary row: ${name}`);
    const jurisdiction = matched[0].slice(name.length).trim();
    if (!["Delaware", "Texas"].includes(jurisdiction)) throw new Error("Unqualified jurisdiction/ownership suffix");
    return { legalName: name, jurisdiction, sourceDate: "2025-12-31", relationship: "Listed ONEOK group subsidiary; direct parent chain not specified here" };
  });
  return { entities, actualCcsContractParty: null, ccsOperatingAssetOwnershipPercent: null, directParentChainCertified: false,
    sourceSupportsQualifiedCashBridge: false,
    boundary: "EnLink CCS, LLC is a listed Delaware subsidiary, NOT authenticated as the XOM transportation/settlement operating counterparty. No 100%-projectownership, novation or cash inferred from an unqualified subsidiary list." };
}
export function extractSuccessorReportingNotice(html: string) {
  const t = successorPlain(html);
  if (!/15-15D/.test(t) || !/SCHEDULE A SUBSIDIARY GUARANTOR REGISTRANT/.test(t) || !/Date: February 10, 2025/.test(t)) throw new Error("Wrong dated reporting notice");
  if (!/EnLink Midstream Partners, LP Delaware/.test(t) || !/Elk Merger Sub II, L\.L\.C\./.test(t) ||
    !/separate corporate existence of EnLink ended upon consummation of the Second Merger/.test(t)) throw new Error("Notice legal continuity not authenticated");
  const checkedRules = Array.from(t.matchAll(/Rule ([\w()\-]+)\s+☒/g)).map(m => m[1]);
  if (checkedRules.join("|") !== "12g-4(a)(1)|12h-3(b)(1)(i)") throw new Error("Unexpected source reporting-rule selections");
  return { noticeDate: "2025-02-10", successorRegistrant: "Elk Merger Sub II, L.L.C.", subsidiaryGuarantorRegistrant: "EnLink Midstream Partners, LP",
    subsidiaryGuarantorJurisdiction: "Delaware", checkedRules, allOtherReportingClassesListed: "None",
    coveredSecurities: ["Common LLC units", "5.375% Senior Notes due 2029 and related guarantees", "5.650% Senior Notes due 2034 and related guarantees"],
    ccsOperatingContractTerminated: null, ccsOperatingContractNovated: null, ccsPayment: null,
    boundary: "Form15 reporting/registration notice and old parent legal extinction, NOT cessation of operating pipelines, extinguishment/novation of CCS contracts or actual settlement/payment. Does not certify all future group reporting ceased." };
}
export function inspectFirstPostMergerQuarter(html: string) {
  const t = successorPlain(html);
  if (!/March 31, 2025/.test(t) || !/ONEOK/.test(t) ||
    !/EnLink Partners EnLink Midstream Partners, LP, a wholly owned subsidiary of ONEOK/.test(t)) throw new Error("Wrong first postmerger issuer/quarter/glossary");
  const rows = Array.from(html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)).map(m => successorPlain(m[1])).filter(r => /^10\.\d/.test(r));
  const index = rows.map(r => {
    const m = r.match(/^(10\.\d+)\*?\s+([\s\S]+)$/); if (!m) throw new Error("Ambiguous declared contract row");
    const category = /Award Agreement/.test(m[2]) ? "employee-award" : /Credit Agreement|Guaranty Agreement/.test(m[2]) ? "corporate-bank-credit-or-guaranty" : "unclassified-needs-review";
    return { exhibit: m[1], category, description: m[2] };
  });
  if (index.length !== 5 || index.some(r => r.category === "unclassified-needs-review")) throw new Error("Unexpected declared contract index: manual review required");
  const namedXomOrPecanMentions = (t.match(/Exxon(?:\s*Mobil)?|Pecan\s*Island/gi) ?? []).length;
  const namedCarbonCaptureMentions = (t.match(/\bCCS\b|carbon capture|sequestration/gi) ?? []).length;
  if (namedXomOrPecanMentions || namedCarbonCaptureMentions) throw new Error("Named operating CCS evidence requires substantive manual review; no absence assertion permitted");
  if (!/noncash compensation expense related to the settlement of share-based awards/.test(t)) throw new Error("Settlement context requires review");
  return { periodEnded: "2025-03-31", parent: "ONEOK, Inc.", enlinkPartnersParentRelationship: "wholly owned ONEOK subsidiary per quarter glossary, not a direct legal-chain or project-ownership assertion",
    namedXomOrPecanMentions, namedCarbonCaptureMentions, declaredEx10Index: index,
    settlementContext: "Employee share-based awards/noncash compensation, NOT named CCS counterparty settlement",
    contractLiabilityContext: "Aggregate deferred transport/storage/construction contributions, not project/counterparty CCS billing or cash",
    actualCcsContractParty: null, actualXomContractParty: null, actualCcsBillingUsd: null, actualCcsSettlementPaymentUsd: null,
    actualCcsProjectFundingUsd: null, actualCcsOpexUsd: null, actualCcsReplacementCapexUsd: null,
    sourceSupportsQualifiedCashBridge: false, appliedOriginalCashAdjustmentUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "No named operating CCS terms in this exact new Q1filing/index; corporate credit/guarantees do not certify CCS funding or novation. Generic immaterial contract asset/liability text is not zero CCS cash. No recognition-to-cash conversion, historical844m allocation, CF45Q transfer, baseline double deduction or original-model mutation." };
}
