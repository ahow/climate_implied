import type { LocationElectricityPublicReport, LocationElectricityPublicSource }
  from "../../shared/locationElectricityPublicTypes";
export type { LocationElectricityPublicReport } from "../../shared/locationElectricityPublicTypes";

/** Public facts transcribed from the authenticated retained SEC and EIA bytes.
 * Mandatory private validator re-extracts those bytes and checks these rows;
 * the public adapter and public tests do not read or require private archives.
 * EIA state averages are deliberately not admissible issuer tariff inputs.
 */
export function buildPublicLocationElectricityReport(): LocationElectricityPublicReport {
  const filing: LocationElectricityPublicSource = {
    id: "SEC-FSLR-0001274494-25-000010",
    url: "https://www.sec.gov/Archives/edgar/data/1274494/000127449425000010/fslr-20241231.htm",
    sha256: "6e67962d0fdc024d97956b21a2f1c2bf2de32de79eb0eedff4d223ec5bd45162",
    locator: "FY2024 Form10-K Item2 Properties p45",
    observedAt: "2026-11-10T13:35:10.345Z",
    availableAt: "2025-02-25T21:11:24.000Z", historicalOriginClaim: false,
  };
  const eia: LocationElectricityPublicSource = {
    id: "EIA-OH-STATE-PROFILE-2024-CAPTURE-20261112",
    url: "https://www.eia.gov/electricity/state/xls/SEP%20Tables%20for%20OH.xlsx",
    sha256: "e84b38fbe758eef26d2b7d85f154c8f2bcda4ae2fd35347811223eb2caf3f7a6",
    locator: "8. Sales!B28:F28; units A25; delivery years B3:F3",
    observedAt: "2026-11-12T14:23:56.564Z",
    // Only observed capture is asserted; no invented release-time precision.
    availableAt: null, historicalOriginClaim: false,
  };
  const names = [
    "Perrysburg and Lake Township, Ohio, United States",
    "Kulim, Kedah, Malaysia",
    "Ho Chi Minh City, Vietnam",
    "Tamil Nadu, India",
    "Trinity, Alabama, United States",
    "Iberia Parish, Louisiana, United States",
  ];
  return {
    version: "location-electricity-public-source-report-1", criterion: "S12-005",
    status: "source-findings-with-unresolved-issuer-inputs",
    cutoff: eia.observedAt,
    freeze: { sha256: "dfd45d53fb1ec53400d7e86b5b77201b9f997b02ef48c9f2d85c9c73e496c1a1",
      protocol: "location-electricity-cash-bridge-1" },
    sourceFacts: {
      operatingLocations: names.map((location, i) => ({
        companyId: "FSLR" as const, location, periodEnd: "2024-12-31" as const,
        operatingStatus: i === 5 ? "under-construction-not-operating-at-source-date" as const : "operating" as const,
        source: { ...filing, locator: filing.locator + (i === 0 ?
          "; Ohio row combines manufacturing/R&D/offices" : i === 5 ?
          "; footnote1: under construction; expected operation second half2025, not verified commissioning" : "") },
        purchasedElectricityMWh: null, supplier: null, tariffEligibility: null,
        customerRecoveryFraction: null, supplierPaymentFraction: null, customerCollectionFraction: null,
        issuerCashBridgeExecutable: false as const,
      })),
      contextualElectricityPrices: [7.1, 7.03, 7.45, 6.55, 6.16].map((reportedValue, i) => ({
        jurisdiction: "US-OH" as const, sector: "industrial" as const, year: 2024 - i,
        currency: "USD" as const, reportedValue, reportedUnit: "US cents/kWh" as const,
        nominalMajorCurrencyPerMWh: reportedValue * 10,
        conversion: "1 cent/kWh = 0.01 USD/kWh *1000 kWh/MWh =10 USD/MWh",
        kind: "regional-context-only" as const, issuerTariff: false as const, applicableToNamedIssuerSite: false as const,
        source: { ...eia, locator: `8. Sales!${"BCDEF"[i]}28; units A25; year ${"BCDEF"[i]}3` },
      })),
    },
    actualIssuerResult: null,
    counts: { evidencedPropertyRows: 6, operatingPropertyRows: 5, constructionPropertyRows: 1,
      regionalPriceRecords: 5, applicableIssuerTariffs: 0, siteConsumptionRecords: 0,
      customerRecoveryRecords: 0, sourceQualifiedIssuerCashBridgeExecutions: 0 },
    missingIssuerInputs: [
      "Annual purchased MWh at each operating site; neither module GW capacity/output nor Scope2 tonnes is purchased electricity.",
      "Applicable issuer supplier/retailer, contract, voltage, demand/time-of-use, fixed charges, hedges/PPA and tariff eligibility. Ohio industrial averages confer no issuer tariff permission.",
      "Same-delivery-year baseline/scenario nominal electricity prices and incremental bridge above costs already in company margin.",
      "Customer-contract electricity cost recovery fraction and cash collection timing; supplier cash payment timing and related WC not already in baseline.",
      "Same-period currency/FX support for foreign operations; Ohio averages cannot populate Alabama, Malaysia, Vietnam or India prices.",
      "Actual Louisiana commissioning/operation evidence; source states construction at2024-12-31 and only expected operation in second half2025.",
      "No original2024 forecast-origin availability established for captured latest-revision EIA historical workbook; no historical backtest asserted.",
    ],
    assumptionValuesAssignedToIssuers: 0, sourceQualifiedIssuerExecution: false,
    productionEligible: false, sourceApproval: false, scientificAcceptance: false,
    boundary: "Actual source findings only, not a fabricated observed tariff or issuer cash result. Optional companyProjection electricity component remains conditional until complete admissible issuer inputs exist. No company gross-up, approval, valuation or original historical execution.",
  };
}
