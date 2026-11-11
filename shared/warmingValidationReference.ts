/** Source-reviewed validation datum only. Never import into numerical engines,
 * offsets, forcing, model acceptance or future inventory replacement code. */
function freeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const WARMING_VALIDATION_REFERENCE = freeze({
  version: "igcc-2025-human-warming-reference-1",
  role: "dated-validation-reference-only",
  calculationInput: false,
  modelAcceptance: false,
  observable: "human-induced GMST",
  temperatureBaseline: "1850-1900 inclusive",
  unit: "degC anomaly",
  inventory: {
    year: 2024,
    version: "igcc-2024-candidate-1",
    basis: "Native gas inventory; AR6 GWP100 used for reporting only",
    status: "candidate-not-promoted",
  },
  headline2025: {
    year: 2025,
    valueC: 1.37,
    definition: "SR1.5-labelled 2025 human-induced warming headline; final value of the 2011-2025 linear trend, not the ordinary 2025 annual mean",
    trendStartYear: 2011,
    trendEndYear: 2025,
  },
  decade: {
    firstYear: 2016,
    lastYear: 2025,
    meanC: 1.24,
    p05C: 1.0,
    p95C: 1.5,
    rangeDefinition: "Published assessed multi-method human-induced GMST p05-p95 range for the 2016-2025 mean; not dashboard member uncertainty",
  },
  source: {
    assessment: "IGCC-2025a",
    publicationUrl: "https://essd.copernicus.org/articles/18/3889/2026/",
    publicationDate: null,
    dateQualification: "Original publication day not established in this retained reference; metadata creation and retrieval timestamps are not publication dates",
    revision: "d9726573dccd9381652432b58b38f670af493c1c",
    path: "data/base/anthropogenic_warming/Assessment-Update-2025_GMST_headlines.csv",
    url: "https://raw.githubusercontent.com/ClimateIndicator/data/d9726573dccd9381652432b58b38f670af493c1c/data/base/anthropogenic_warming/Assessment-Update-2025_GMST_headlines.csv",
    sha256: "d419c3f7d513b42052f5635454853610739d8b5f1749f55b5df03862dfe28879",
    metadataDateCreated: "2026-07-22T10:13:14Z",
    retrievedAtUTC: "2026-11-10T12:09:00.306870+00:00",
    licence: "CC-BY-4.0",
    credit: "Christopher Smith and Tristram Walsh; ROF/Gillett, KCC/Ribes and GWI/Walsh synthesis; Forster et al. (2026), section 8, doi:10.5194/essd-18-3889-2026",
    temporalDefinitionUrl: "https://essd.copernicus.org/articles/18/3889/2026/essd-18-3889-2026-supplement.pdf",
    temporalDefinitionLocator: "S8.1.1, PDF pages 29-30; Figure S12 caption, PDF page 43",
    temporalDefinitionSha256: "c533320e534438ef760ac494d2eef030e2b9714d197557a9d6ec4c0d627ecd1d",
  },
  qualification: "Reference, not offset/calculation/acceptance. Keep 2025 headline, 2016-2025 mean and 2024 inventory separate. The source ordinary Annual row is 1.38 C, not a replacement for the required 1.37 C SR1.5 headline. No fitted adjustment, GSAT-to-GMST conversion or model-member acceptance is implied.",
} as const);
