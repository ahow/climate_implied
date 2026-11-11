import { attachmentPlain } from "./issuerAttachmentGrantInputs";
import { sourceExhibit } from "./issuerSourceExhibits";
export function extractCfCurrentEconomics(full: string) {
  if (!/CENTRAL INDEX KEY:\s*0001324404/.test(full) || !/ACCESSION NUMBER:\s*0001324404-26-000023/.test(full))
    throw new Error("Actual declared CF earnings accession required, not the same-date investor deck");
  const primary = sourceExhibit(full, "8-K"), exhibit = sourceExhibit(full, "EX-99.1");
  if (primary.name !== "cf-20261104.htm" || exhibit.name !== "cf-11042026_ex991xearnings.htm")
    throw new Error("Declared primary/earnings exhibit identity mismatch");
  const t = attachmentPlain(exhibit.body);
  const cash = t.match(/cash and cash equivalents of \$([\d.]+) billion, of which \$([\d,]+) million was held by the Blue Point One joint venture/);
  if (!cash || !t.includes("CF Industries consolidates the Blue Point One joint venture") ||
    !t.includes("the combined 60% interest owned by JERA and Mitsui recorded as noncontrolling interests"))
    throw new Error("Actual consolidated JV/cash-perimeter clauses required");
  const ownership = t.match(/CF Industries holds ([\d.]+)% ownership, JERA holds ([\d.]+)% ownership, and Mitsui holds ([\d.]+)% ownership/);
  if (!ownership) throw new Error("Actual named partner ownership percentages required");
  const pair = (label: string) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const m = t.match(new RegExp(escaped + "\\s+(?:\\$\\s*)?([\\d,]+)\\s+(?:\\$\\s*)?([\\d,]+)"));
    if (!m) throw new Error(`Two reported quarter/YTD capex cells required: ${label}`);
    return [Number(m[1].replace(/,/g, "")) * 1e6, Number(m[2].replace(/,/g, "")) * 1e6];
  };
  const credits = t.match(/45Q tax credits \(2\)((?:\s+\(\s*\d+\s*\)){8})/);
  if (!credits || !t.includes("Included in other operating income")) throw new Error("Actual eight-cell before/after-tax45Qincome row required");
  const values = Array.from(credits[1].matchAll(/\(\s*(\d+)\s*\)/g)).map(m => Number(m[1]) * 1e6);
  return { declaredExhibit: exhibit.name, consolidatedCashUsd: Number(cash[1]) * 1e9, bluePointJvCashUsd: Number(cash[2].replace(/,/g, "")) * 1e6,
    totalCapexQuarterYtdUsd: pair("Total Capital Expenditures"),
    existingOperationsCapexQuarterYtdUsd: pair("CF Industries Existing Operations (100% attributable to CF Industries)"),
    jvCapexQuarterYtdUsd: pair("Total Blue Point One Joint Venture (40% attributable to CF Industries)"),
    commonFacilitiesCapexQuarterYtdUsd: pair("Blue Point Common Facilities (100% attributable to CF Industries)"),
    capitalizedInterestQuarterYtdUsd: pair("Capitalized Interest"),
    quarter45qOperatingIncomeBeforeTaxUsd: values[0], yearToDate45qOperatingIncomeBeforeTaxUsd: values[4],
    quarter45qOperatingIncomeAfterTaxUsd: values[1], yearToDate45qOperatingIncomeAfterTaxUsd: values[5],
    cfJvOwnershipPercent: Number(ownership[1]), jeraJvOwnershipPercent: Number(ownership[2]), mitsuiJvOwnershipPercent: Number(ownership[3]),
    actual45qCashCollectionsUsd: null, actualXomCcsFeePaymentUsd: null, actualCreditQualifiedCo2MassTonnes: null };
}
export function reconcileCfCurrentEconomics(s: ReturnType<typeof extractCfCurrentEconomics>) {
  const residuals = [0, 1].map(i => s.existingOperationsCapexQuarterYtdUsd[i] + s.jvCapexQuarterYtdUsd[i] +
    s.commonFacilitiesCapexQuarterYtdUsd[i] + s.capitalizedInterestQuarterYtdUsd[i] - s.totalCapexQuarterYtdUsd[i]);
  if (residuals.some(v => v !== 0) || s.bluePointJvCashUsd > s.consolidatedCashUsd ||
    s.cfJvOwnershipPercent + s.jeraJvOwnershipPercent + s.mitsuiJvOwnershipPercent !== 100)
    throw new Error("Actual CF cash/capex/ownership perimeter fails reconciliation");
  return { ...s, capexQuarterYtdResidualsUsd: residuals,
    consolidatedCashOutsideBluePointJvBookUsd: s.consolidatedCashUsd - s.bluePointJvCashUsd,
    firstHalf45qOperatingIncomeBeforeTaxUsd: s.yearToDate45qOperatingIncomeBeforeTaxUsd - s.quarter45qOperatingIncomeBeforeTaxUsd,
    observedCommonExcessCashFromJvUsd: null, actualCommonCashFromOutsideJvPoolUsd: null,
    capitalizedInterestStandaloneCashPaymentUsd: null, xomActualProjectFundingUsd: null,
    originalXomCashAddedOrBaselineCostDeductedAgainUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "NewCFearnings, not olddeck:496mJVcash remains inside2820mconsolidatedcash;2324moutsideJV is bookcash, NOT excess/distributablecommoncash. CFconsolidatesJVdespite40%equity;35%JERA/25%Mitsui ownership does not allocate freecash. Capex includes99mcommonfacilities and24mcapitalizedinterest YTD—do not deduct interestagain or call it separatelyobservedpaidcash.45Q62mYTD/19mquarter is otheroperatingINCOME, not collections, per-tonneprice, capturedCO2mass or XOMfee. No linkage of this company-widecreditrow to Rose/nativeCO2/ownership share."
  };
}
export function extractEnlinkClosingContinuity(full: string) {
  if (!/CENTRAL INDEX KEY:\s*0001592000/.test(full) || !/ACCESSION NUMBER:\s*0001213900-25-008864/.test(full))
    throw new Error("Actual January31,2025EnLink closing accession required");
  const t = attachmentPlain(sourceExhibit(full, "8-K").body);
  for (const clause of ["with EnLink surviving the First Merger",
    "with Merger Sub II surviving the Second Merger as a direct, wholly-owned subsidiary of ONEOK",
    "Merger Sub II assumed all of the obligations of EnLink and EnLink was released from its obligations under the applicable Indenture"])
    if (!t.includes(clause)) throw new Error("Both actual legal merger steps and limited note-assumption scope required");
  const formation = sourceExhibit(full, "EX-3.1"), agreement = sourceExhibit(full, "EX-3.2"), debt = sourceExhibit(full, "EX-4.1");
  if (!attachmentPlain(formation.body).includes("Name . The name of the limited liability company is Elk Merger Sub II, L.L.C.") ||
    !attachmentPlain(debt.body).includes("Elk Merger Sub II, L.L.C."))
    throw new Error("Declared formation/debt successor legal name required");
  return { legalEventDate: "2025-01-31", originalParent: "EnLink Midstream, LLC",
    firstMergerSurvivor: "EnLink Midstream, LLC", secondMergerSurvivor: "Elk Merger Sub II, L.L.C.",
    secondMergerSurvivorOwnerAtClosing: "ONEOK, Inc.; direct wholly-owned subsidiary",
    declaredFormationExhibit: formation.name, declaredLlcAgreementExhibit: agreement.name, declaredFirstDebtSupplement: debt.name,
    debtAssumptionScope: "Four named senior-note indentures, not certification of every operating CCS contract/guarantee",
    enlinkCcsOperatingSubsidiaryLegalName: null, xomContractSubsidiaryLegalName: null, currentCcsSettlementCashUsd: null,
    currentCcsSettlementEffectiveDate: null, currentCcsExecutedPaymentAgreement: null, currentXomPerTonneFeeUsd: null,
    mergerCreditFacilityRepaymentIsCcsSettlement: false, debtSuccessorIsCertifiedCcsContractCounterparty: false,
    originalXomCashAddedUsd: 0, qualifiedOriginalIssuers: 0,
    boundary: "Actual closing has TWO mergers: oldEnLink survivesfirst then merges INTOElkMergerSubII. Do not report oldEnLink as finalsurvivor. Formation/LLCagreement/bondsupplements authenticate datedparent/debtidentity only; no executedEnLink/XOMCCSsettlement disclosed in this package. Creditfacilitytermination/mergerexchange are not CCSrecovery. Current2026status/operatingcontractnovation/payment remainunverified, not zero."
  };
}
