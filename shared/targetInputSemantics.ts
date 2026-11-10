import type { OutputFieldSemantic } from "./outputFieldSemantics";

const specs:[string,string,string,string][] = [
  ["companyId","Exact issuer identity in the selected immutable workbook","Positive integer workbook company ID; applyOverlays requires matching company; no ticker-only match","workbook identifier"],
  ["field","Target value destination","literal emissionTarget2050; copied to matched company atomically with targetEvidence","field identifier"],
  ["kind","Overlay evidence category","literal target; targetEvidence is forbidden on non-target entries","label"],
  ["value","Signed cumulative scope 1+2 change from the explicitly evidenced base year to 2050","E_2050/E_baseYear - 1; finite value > -1; -0.5 means 50% reduction, 0 means unchanged, positive means increase; never percent points","fractional change"],
  ["unit","Target value representation","literal fractional-change; percent and absolute tonnes are rejected","unit label"],
  ["observationDate","Overlay observation day, not target base year","ISO date; targetEvidence.publishedAt <= observationDate <= availableAt","ISO calendar day"],
  ["availableAt","Declared overlay information availability day","ISO date >= observationDate and publication day; must be <= replay cutoff","ISO calendar day"],
  ["source","Submitted source attribution","Required nonempty entry.source; retained in content-hashed overlay, not automatically authenticated","text"],
  ["approvalEvidence","Existing operator review evidence, not scientific acceptance","Required nonempty approvalEvidence; existing ;decidedAt:...; markers when present must agree within overlay, be ordered across overlays and not exceed cutoff","text"],
  ["historyBasis","Declared history classification","literal revised-history; reviewed availability is not proof of original vintage","label"],
  ["targetEvidence.baseYear","Source-explicit emissions comparison base year; never assumed 2024","Integer >=1900 and <2050; cannot exceed publication calendar year; absent metadata leaves annual rate unavailable","calendar year"],
  ["targetEvidence.targetYear","Fixed target horizon","literal 2050; other horizons rejected by this contract","calendar year"],
  ["targetEvidence.accountingScope","Source-explicit emissions boundary","literal scope1+scope2; no scope 3 or scope 1-only substitution, no assumption of net zero","accounting boundary"],
  ["targetEvidence.unit","Evidence declaration of signed target units","literal fractional-change; must accompany target entry of the same unit","unit label"],
  ["targetEvidence.publishedAt","Source-declared publication day, not capture or approval timestamp","ISO calendar date <= observationDate and availableAt; baseYear <= publication year; declaration requires independent source review","ISO calendar day"],
  ["targetEvidence.sourceLocator","Source location for the target assertion","Trimmed nonempty locator; no requirement that it be an authenticated URL","text"],
  ["targetEvidence.sourceExcerpt","Source evidence supporting base year, scope and target","Trimmed nonempty excerpt; content retained verbatim after schema trimming; nonempty is not scientific validation","text"],
];
const context = {
  source:"server/snapshots/overlayContract.ts targetEvidenceSchema/packOverlay/applyOverlays; existing operator review/capture path",
  period:"Explicit target base year through 2050; observation/publication/availability are separate dates",
  geography:"Exact matched workbook issuer; no inferred geographic allocation",
  status:"Source-declared revised-history input; operator review is not scientific acceptance",
  missingness:"Target entries require all seven targetEvidence fields and finite value > -1. Invalid overlays reject; legacy workbook target without valid targetEvidence yields null annual rate, never zero or assumed 2024. No imputation.",
  uncertainty:"No probability distribution or calibrated target-delivery probability; conditional target arithmetic only",
  scope:"Read-only input contract disclosure; no public target mutation or editable approval UI",
  asOfRule:"Publication <= observation <= availability <= cutoff. Recorded approval markers also cannot exceed cutoff. These checks do not establish original-vintage source authenticity.",
};
export const targetInputSemantics:OutputFieldSemantic[] = [
  ...specs.map(([field,meaning,formula,unit]):OutputFieldSemantic=>({
    id:`targetInput.${field}`,meaning,formula,unit,role:"Input",...context,
    dependencies:["selected workbook company identity","content-hashed target overlay entry","targetEvidenceSchema"],
  })),
  {id:"targetInput.annualDecarbRate",meaning:"Conditional constant annual scope 1+2 decline implied by an evidenced cumulative target, not a forecast",
    role:"Calculated",formula:"100 * (1 - (1 + emissionTarget2050) ** (1 / (2050 - targetEvidence.baseYear))); computeCompanyAnnualDecarbRate first validates targetEvidence; positive cumulative change gives negative annual decline",
    unit:"percent/year",dependencies:["targetInput.value","targetInput.targetEvidence.baseYear","targetInput.targetEvidence.targetYear"],
    ...context,source:"server/climateValuation/sharedUtils.ts computeCompanyAnnualDecarbRate/computeAnnualDecarbRate",
  },
];
