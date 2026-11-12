/** Public, source-derived findings, not a tariff calibration or issuer approval.
 * No private archive paths or executable synthetic issuer cases are exposed. */
export interface LocationElectricityPublicSource {
  id: string;
  url: string;
  sha256: string;
  locator: string;
  observedAt: string;
  availableAt: string | null;
  historicalOriginClaim: false;
}
export interface LocationElectricityPublicReport {
  version: "location-electricity-public-source-report-1";
  criterion: "S12-005";
  status: "source-findings-with-unresolved-issuer-inputs";
  cutoff: string;
  freeze: { sha256: string; protocol: "location-electricity-cash-bridge-1" };
  sourceFacts: {
    operatingLocations: {
      companyId: "FSLR";
      location: string;
      periodEnd: "2024-12-31";
      operatingStatus: "operating" | "under-construction-not-operating-at-source-date";
      source: LocationElectricityPublicSource;
      purchasedElectricityMWh: null;
      supplier: null;
      tariffEligibility: null;
      customerRecoveryFraction: null;
      supplierPaymentFraction: null;
      customerCollectionFraction: null;
      issuerCashBridgeExecutable: false;
    }[];
    contextualElectricityPrices: {
      jurisdiction: "US-OH";
      sector: "industrial";
      year: number;
      currency: "USD";
      reportedValue: number;
      reportedUnit: "US cents/kWh";
      nominalMajorCurrencyPerMWh: number;
      conversion: string;
      kind: "regional-context-only";
      issuerTariff: false;
      applicableToNamedIssuerSite: false;
      source: LocationElectricityPublicSource;
    }[];
  };
  actualIssuerResult: null;
  counts: {
    evidencedPropertyRows: number;
    operatingPropertyRows: number;
    constructionPropertyRows: number;
    regionalPriceRecords: number;
    applicableIssuerTariffs: 0;
    siteConsumptionRecords: 0;
    customerRecoveryRecords: 0;
    sourceQualifiedIssuerCashBridgeExecutions: 0;
  };
  missingIssuerInputs: string[];
  assumptionValuesAssignedToIssuers: 0;
  sourceQualifiedIssuerExecution: false;
  productionEligible: false;
  sourceApproval: false;
  scientificAcceptance: false;
  boundary: string;
}
