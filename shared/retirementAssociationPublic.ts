/** Public filing facts and unscored method status only, never private issuer rows. */
export const retirementAssociationPublic = {
  version:"retirement-association-public-1",
  claim:"Unit book arithmetic and unscored prospective methods; no market-implied retirement, issuer FCFE, causal association or efficacy",
  source:{
    issuer:"PacifiCorp",fiscalEnd:"2023-12-31",coverDate:"2024-03-07",publicationInstant:null,
    url:"https://pscdocs.utah.gov/electric/24docs/2403511/332746RMPAnlRprtFrm10KPrdEndDec3120233-7-2024.pdf",
    sha256:"c63273a2d6f8e2da0e4b294c77e8cd5eee50086d8e02e290bee29082da19ea2e",
    locator:"Item 2, Wyodak No. 1; PacifiCorp Note 4, printed page 234, Wyodak row",
    unit:"Wyodak No. 1",site:"Gillette, Wyoming",fuel:"coal",
    facilityNetMW:332,reportedOwnedMW:266,ownershipPercent:80,
    ownedPlantInServiceUsdMillion:491,ownedAccumulatedDepreciationUsdMillion:285,
  },
  assumptions:{
    retirementTiming:"Beginning of declared calendar year; no generation in retirement year",
    cashBasis:"Conditional unit-unlevered nominal USD million; ownership applied once to gross unit cash",
    sourceCaveat:"Actual operating costs may be allocated by ownership or production. Uniform ownership allocation is not proven actual unit economics.",
    terminal:"Explicit zero residual; all recovery and decommissioning cash must lie inside declared horizon",
    inversion:"Exhaustive declared discrete candidate set; multiple and no-root outcomes retained; not a continuous market-implied pace",
    adjustableInputs:"Offline explicit year, dispatch, prices, costs, replacement, recovery, cash taxes/WC, discount and timing within declared contracts. No public write or arbitrary override.",
  },
  association:{
    protocol:"s13-006-gordon-association-2",declaredAt:"2026-11-12T15:52:36Z",
    basis:"g=r-positive earnings/market capitalization; steady-state fully distributable earnings Gordon, not five-year FCFE",
    transitionExposure:"Scope1 + location-based Scope2 tCO2e / same-period USD million revenue; Scope3 excluded",
    controls:["sector","operatingRegion","logMarketCapUsd","operatingProfitOverAssets","capexOverRevenue","commodityRevenueShare","netDebtOverAssets","pastThreeYearRevenueCagr"],
    method:"OLS with fixed categories and HC3 covariance; approximate Student-t intervals; complete cases with full frozen denominator",
    gates:"n>=max(30,3*p); full rank; standardized condition<=1e8; leverage<1-1e-10",
    actualEstimate:null,actualStudyExecuted:false,
    missing:["Frozen exact admitted issuer population/cutoff and settings","Same-period evidenced exposure and all conventional controls","Reviewed original/restated dated financial and security identities"],
    claim:"Conditional association only, not climate-attributable growth or causation",
  },
  missingRetirementInputs:["Unit generation and applicable revenue/operating costs","Dated announced versus committed retirement","Unit liability cash schedule and regulatory recovery","Replacement power/capital/WC/tax schedules","Compatible asset target and common-equity bridge"],
  retirementResult:null,marketImpliedRetirement:null,qualifiedIssuerCase:false,
  formulas:{
    ownedBookValue:"ownedPlantInServiceUsdMillion - ownedAccumulatedDepreciationUsdMillion; already issuer share",
    capacityRoundingResidual:"reportedOwnedMW - facilityNetMW*ownershipPercent/100; disclosure rounding, not a correction",
    generation:"full-unit MW * 8760 (8784 leap year) * capacity factor while operating",
    cash:"revenue - variable/fixed expense - maintenance/replacement capex - replacement purchases - cash taxes - deltaWC + recovery - decommissioning cash; multiply ownership once",
    valuation:"sum(owned annual cash/(1+r)^year); book balance not deducted as cash",
  },
} as const;
export function buildRetirementAssociationPublic() {
  return {...retirementAssociationPublic, calculated:{
    ownedBookValueUsdMillion:retirementAssociationPublic.source.ownedPlantInServiceUsdMillion-retirementAssociationPublic.source.ownedAccumulatedDepreciationUsdMillion,
    capacityRoundingResidualMW:Number((retirementAssociationPublic.source.reportedOwnedMW-
      retirementAssociationPublic.source.facilityNetMW*retirementAssociationPublic.source.ownershipPercent/100).toFixed(10)),
    claim:"Source-defined book balance arithmetic only, not recoverable cash or valuation",
  }};
}
