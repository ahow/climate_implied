/** Manually transcribed retained primary-disclosure aggregates. No file reads at runtime. */
export const producerReserveSource = {
  entity: "Exxon Mobil Corporation", scope: "Consolidated subsidiaries producing activities, including noncontrolling interests; excludes equity companies",
  documentDate: "2025-02-19", documentDateBasis: "Signed/audited report date, NOT independently verified SEC acceptance/publication timestamp",
  retainedAt: "2026-11-10T07:40:27.320Z",
  url: "https://www.annualreports.com/HostedData/AnnualReportArchive/e/NYSE_XOM_2024.pdf",
  pdfSha256: "8a79decedd1d5c317d18ef7d16e14c8311e5bac370cf120d726120140b7e30e2",
  textSha256: "89441ab5d1133b95f990ea60273d1719efc3659a0c0c017620f95ae397b4203f",
} as const;
export const producerReserveFacts = {
  // Supplemental oil/gas information p130. These are not the combined equity-company totals.
  reserves: { opening: 13716, revisions: 521, improvedRecovery: 0, purchases: 2281,
    sales: -123, extensionsDiscoveries: 1915, production: -1355, closing: 16955 },
  // p133, consolidated column. Future production costs already include retirement obligations (p132).
  standardized: { revenue: 874162, productionCosts: 284600, development: 115321,
    incomeTaxes: 186682, netCash: 287559, discountEffect: 136065, pv10: 151494 },
  // p121 producing activities; third-party sales + intra-company transfers, not consolidated revenue.
  operations: { thirdParty: 26484, transfers: 44334, revenue: 70818, productionCosts: 15516,
    exploration: 826, depreciationDepletion: 18229, productionTaxes: 5145,
    incomeTaxes: 11701, earnings: 19401 },
  // p124 costs incurred are NOT cash capex; include expensed items and noncash ARO/acquisitions.
  costsIncurred: { provedAcquisitions: 39272, unprovedAcquisitions: 45201,
    exploration: 1262, development: 19359, total: 105094 },
  // p11 daily production; p12 realized prices. USD/bbl and USD/thousand cubic feet.
  commodity: [
    { product: "crude", dailyVolume: 1858, volumeUnit: "thousand bbl/day", price: 76.57, priceUnit: "USD/bbl" },
    { product: "NGL", dailyVolume: 423, volumeUnit: "thousand bbl/day", price: 24.32, priceUnit: "USD/bbl" },
    { product: "bitumen", dailyVolume: 374, volumeUnit: "thousand bbl/day", price: 54.02, priceUnit: "USD/bbl" },
    { product: "synthetic", dailyVolume: 62, volumeUnit: "thousand bbl/day", price: 74.16, priceUnit: "USD/bbl" },
    { product: "gas", dailyVolume: 5438, volumeUnit: "million cubic feet/day", price: 3.13, priceUnit: "USD/thousand cubic feet" },
  ],
} as const;
export const producerReserveEvidenceLocators = [
  { id: "reserves", period: "2024 stock rollforward", unit: "million boe; gas converted at 6 billion cubic feet per million boe", locator: "p130, Natural Gas and Oil-Equivalent Proved Reserves; consolidated subsidiaries, oil-equivalent total; extracted text lines 7122–7129, gas conversion footnote 7145" },
  { id: "standardized", period: "2024-12-31 future reserve cash flows", unit: "USD million", locator: "pp132–133, Standardized Measure of Discounted Future Net Cash Flows, consolidated subsidiaries 2024; text 7271–7280; p132 methodology/retirement cost inclusion" },
  { id: "operations", period: "FY2024", unit: "USD million", locator: "p121, Results of Operations; consolidated subsidiaries only, Total column; text 6619–6632" },
  { id: "costsIncurred", period: "FY2024", unit: "USD million; NOT cash capital expenditure", locator: "pp123–124, costs-incurred definition and 2024 consolidated table; text 6774–6794" },
  { id: "commodity", period: "FY2024 daily average / realized sales prices", unit: "thousand bbl/day or million cubic feet/day; USD/bbl or USD/thousand cubic feet", locator: "pp11–13, Production and Production Prices, consolidated subsidiaries ONLY; text 943–984, 1008–1021, 1099–1105" },
] as const;
