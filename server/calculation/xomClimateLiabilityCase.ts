import ExcelJS from "exceljs";

export interface XomPermitEvidence {
  installationId: number;
  permitId: string;
  operator: string;
  installationName: string;
  regulator: "EA";
  jurisdiction: "England";
  regulatedActivity: string;
  period: 2024;
  reportedUnit: "tCO2e";
  recordedCoveredEmissions: number;
  allocationEntitlement: number;
  allocationDelivered: number;
  allocationUnit: "UKA";
  votingOwnershipPercent: 100;
  ownershipBasis: "Direct or indirect voting securities; NOT a measured equity-emissions allocation";
  actualUncommittedBankUnits: null;
  nativeCo2Tonnes: null;
  corporateGhgScope: null;
  globalCoverageShare: null;
}
export interface XomClimateEvidence {
  permits: XomPermitEvidence[];
  emissionsDefinition: string;
  subsidiaryAsOf: "2024-12-31";
  excludedChemicalPermit: { id: number; reason: string };
  informationContext: "revised-history";
}
function plain(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/&#8211;/g, "-").replace(/\s+/g, " ").trim();
}
async function table(bytes: Buffer, sheet: string): Promise<Record<string, unknown>[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.getWorksheet(sheet);
  if (!worksheet || !worksheet.rowCount) throw new Error(`Missing original registry worksheet ${sheet}`);
  let headerRowNumber = 0;
  for (let n = 1; n <= worksheet.rowCount; n++) if (worksheet.getRow(n).hasValues) { headerRowNumber = n; break; }
  if (!headerRowNumber) throw new Error(`Missing original registry header ${sheet}`);
  const headers: string[] = [];
  worksheet.getRow(headerRowNumber).eachCell((cell, column) => { headers[column - 1] = cell.text.trim(); });
  const rows: Record<string, unknown>[] = [];
  for (let n = headerRowNumber + 1; n <= worksheet.rowCount; n++) {
    const row: Record<string, unknown> = {};
    worksheet.getRow(n).eachCell((cell, column) => {
      row[headers[column - 1]] = cell.value && typeof cell.value === "object" ? cell.text : cell.value;
    });
    rows.push(row);
  }
  return rows;
}
function number(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new Error(`Missing/non-numeric original ${field}`);
  return value;
}
export async function extractXomClimateEvidence(operators: Buffer, compliance: Buffer, subsidiaryHtml: string): Promise<XomClimateEvidence> {
  const subsidiaryText = plain(subsidiaryHtml);
  if (!/Subsidiaries of the Registrant/.test(subsidiaryText) ||
    !/December 31, 2024/.test(subsidiaryText) ||
    !/Percentage of Voting Securities Owned Directly or Indirectly by Registrant/.test(subsidiaryText))
    throw new Error("Original FY2024 subsidiary/voting boundary not authenticated");
  const subsidiaryRows = Array.from(subsidiaryHtml.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi));
  const legal = subsidiaryRows.filter(row => plain(row[0]).includes("Esso Petroleum Company Limited"));
  if (legal.length !== 1 || !/Esso Petroleum Company Limited 100 United Kingdom/.test(plain(legal[0][0])))
    throw new Error("Exact legal subsidiary and 100% voting row absent/ambiguous");
  const allocations = await table(operators, "Data"), recorded = await table(compliance, "Data");
  const definitions = await table(compliance, "Field Categorisation");
  const definition = definitions.find(row => row.Variable === "Recorded emissions [year]");
  const description = String(definition?.Description ?? "");
  if (!description.includes("verified emissions in tonnes of carbon dioxide equivalent greenhouse gas emissions (tCO2e)"))
    throw new Error("Source native tCO2e definition unavailable; never relabel as native CO2");
  const permits = [1000118, 1000119].map(id => {
    const a = allocations.filter(row => row["Installation ID"] === id);
    const e = recorded.filter(row => row["Operator ID"] === id);
    if (a.length !== 1 || e.length !== 1) throw new Error(`Unique exact registry installation join missing: ${id}`);
    const allocation = a[0], emission = e[0];
    const permit = String(allocation["Permit ID"]);
    if (emission["Permit ID or Monitoring plan ID"] !== permit ||
      allocation["Account Holder Name"] !== "Esso Petroleum Company Limited" ||
      emission["Account Holder Name"] !== allocation["Account Holder Name"] ||
      allocation.Regulator !== "EA" || emission.Regulator !== "EA" ||
      emission["Account type"] !== "OPERATOR_HOLDING_ACCOUNT")
      throw new Error(`Exact legal operator/permit/English regulator mismatch: ${id}`);
    if (allocation["Installation Name"] !== emission["Installation name"])
      throw new Error(`Installation names disagree: ${id}`);
    const expected = id === 1000118 ? "UK-E-IN-12019" : "UK-E-IN-11402";
    if (permit !== expected) throw new Error("Original permit identity mismatch");
    return {
      installationId: id, permitId: permit, operator: "Esso Petroleum Company Limited",
      installationName: String(allocation["Installation Name"]), regulator: "EA" as const,
      jurisdiction: "England" as const, regulatedActivity: String(allocation["Regulated activity"]),
      period: 2024 as const, reportedUnit: "tCO2e" as const,
      recordedCoveredEmissions: number(emission["Recorded emissions 2024"], "Recorded emissions 2024"),
      allocationEntitlement: number(allocation["Allocation Entitlement_2024"], "Allocation Entitlement_2024"),
      allocationDelivered: number(allocation["Allocation Delivered_2024"], "Allocation Delivered_2024"),
      allocationUnit: "UKA" as const, votingOwnershipPercent: 100 as const,
      ownershipBasis: "Direct or indirect voting securities; NOT a measured equity-emissions allocation" as const,
      actualUncommittedBankUnits: null, nativeCo2Tonnes: null, corporateGhgScope: null, globalCoverageShare: null,
    };
  });
  return { permits, emissionsDefinition: description, subsidiaryAsOf: "2024-12-31",
    excludedChemicalPermit: { id: 1000124, reason: "ExxonMobil Chemical Limited is a DIFFERENT legal operator; exact FY2024 Exhibit 21 legal entity/ownership link not identified. Do not include by ExxonMobil name resemblance." },
    informationContext: "revised-history" };
}

export interface ClimateForwardAssumptions {
  disclosure: "conditional-forward-stress-not-observed";
  // These are prospective stress inputs, not historical UKA price/FX facts.
  priceIncrementGbpPerUka: number;
  forwardUsdPerGbp: number;
  allocationFractionOf2024Delivered: number;
  openingUncommittedBankUnits: Record<string, number>;
  allowancesPerReportedTco2e: 1;
  passThroughFraction: number;
  passThroughLagYears: 0 | 1;
  marginalCashTaxReliefFraction: 0;
  commonCashBurdenFraction: 1;
  cashTiming: "Purchases in emissions year; units earmarked for later surrender; surplus bank excludes earmarked obligation";
}
export interface CarbonIndexRow { year: number; nominalPriceIndex: number }
export function buildXomPermitClimateCash(evidence: XomClimateEvidence, index: CarbonIndexRow[], a: ClimateForwardAssumptions) {
  if (!evidence.permits.length || new Set(evidence.permits.map(p => p.permitId)).size !== evidence.permits.length)
    throw new Error("Nonempty, disjoint exact permit boundaries required");
  if (a.disclosure !== "conditional-forward-stress-not-observed" || a.allowancesPerReportedTco2e !== 1 ||
    a.marginalCashTaxReliefFraction !== 0 || a.commonCashBurdenFraction !== 1)
    throw new Error("Explicit forward units/no-tax-shield/full-common-burden assumptions required");
  for (const [name, x] of Object.entries({ price: a.priceIncrementGbpPerUka, fx: a.forwardUsdPerGbp,
    allocation: a.allocationFractionOf2024Delivered, recovery: a.passThroughFraction }))
    if (!Number.isFinite(x) || x < 0) throw new Error(`Invalid conditional ${name}`);
  if (!(a.forwardUsdPerGbp > 0) || a.passThroughFraction > 1 || a.allocationFractionOf2024Delivered > 1 ||
    ![0, 1].includes(a.passThroughLagYears)) throw new Error("Conditional bound exceeded");
  if (index.length !== 16 || index.some((r, i) => r.year !== 2026 + i || !(r.nominalPriceIndex > 0 && Number.isFinite(r.nominalPriceIndex))))
    throw new Error("Explicit original 2026-2041 five-year/fade/terminal index required");
  const bank: Record<string, number> = {};
  for (const p of evidence.permits) {
    if (p.reportedUnit !== "tCO2e" || p.jurisdiction !== "England") throw new Error("Native unit/jurisdiction mismatch");
    number(p.recordedCoveredEmissions, "permit reported tCO2e");
    number(p.allocationDelivered, "permit delivered UKAs");
    const balance = a.openingUncommittedBankUnits[p.permitId];
    if (!(Number.isFinite(balance) && balance >= 0)) throw new Error(`Explicit conditional opening bank required for ${p.permitId}`);
    bank[p.permitId] = balance;
  }
  let previousRecognizedRecoveryUsd = 0, previousPassReceivableUsd = 0;
  const rows = index.map(period => {
    const permits = evidence.permits.map(p => {
      const opening = bank[p.permitId], free = p.allocationDelivered * a.allocationFractionOf2024Delivered;
      const obligation = p.recordedCoveredEmissions * a.allowancesPerReportedTco2e;
      const purchased = Math.max(0, obligation - free - opening);
      const closing = opening + free + purchased - obligation;
      if (Math.abs(closing - Math.max(0, opening + free - obligation)) > 1e-8) throw new Error("Allowance-unit reconciliation failed");
      bank[p.permitId] = closing;
      const costGbp = purchased * a.priceIncrementGbpPerUka * period.nominalPriceIndex;
      return { permitId: p.permitId, reportedCoveredTco2e: p.recordedCoveredEmissions,
        openingUncommittedBankUnits: opening, freeAllocationUnits: free, purchasedUnits: purchased,
        earmarkedSurrenderUnits: obligation, closingUncommittedBankUnits: closing, incrementalCostGbp: costGbp };
    });
    const incrementalGrossCostGbp = permits.reduce((sum, p) => sum + p.incrementalCostGbp, 0);
    const incrementalGrossCostUsd = incrementalGrossCostGbp * a.forwardUsdPerGbp;
    const recognizedPassThroughUsd = incrementalGrossCostUsd * a.passThroughFraction;
    const cashPassThroughUsd = a.passThroughLagYears === 0 ? recognizedPassThroughUsd : previousRecognizedRecoveryUsd;
    const closingPassReceivableUsd = a.passThroughLagYears === 0 ? 0 : recognizedPassThroughUsd;
    const passReceivablesIncreaseUsd = closingPassReceivableUsd - previousPassReceivableUsd;
    const incrementalOperatingProfitUsd = recognizedPassThroughUsd - incrementalGrossCostUsd;
    const incrementalOperatingCashUsd = cashPassThroughUsd - incrementalGrossCostUsd;
    if (Math.abs(incrementalOperatingProfitUsd - passReceivablesIncreaseUsd - incrementalOperatingCashUsd) > .01)
      throw new Error("Pass-through accrual/collection bridge failed");
    previousRecognizedRecoveryUsd = recognizedPassThroughUsd;
    previousPassReceivableUsd = closingPassReceivableUsd;
    return { year: period.year, nominalPriceIndex: period.nominalPriceIndex, permits,
      incrementalGrossCostGbp, incrementalGrossCostUsd, recognizedPassThroughUsd, cashPassThroughUsd,
      closingPassReceivableUsd, passReceivablesIncreaseUsd, incrementalOperatingProfitUsd, incrementalOperatingCashUsd };
  });
  const terminalDepletionUnpriced = evidence.permits.some(p =>
    bank[p.permitId] > 0 && p.recordedCoveredEmissions > p.allocationDelivered * a.allocationFractionOf2024Delivered);
  return { rows, terminalDepletionUnpriced, sourceGlobalCoveredShare: null, observedBankClaimed: false,
    observedUkaPriceClaimed: false, observedFxClaimed: false, qualifiedOriginalIssuers: 0,
    basis: "Permit-covered reported tCO2e only, NOT native CO2 or corporate/equity/Scope1-total allocation" };
}

export function integrateXomClimateCash(baseline: any, climate: ReturnType<typeof buildXomPermitClimateCash>) {
  if (climate.terminalDepletionUnpriced) throw new Error("Terminal bank depletion remains unpriced beyond horizon");
  const x = baseline.engineInput;
  if (x.symbol !== "XOM" || x.currency !== "USD" || ![.025, .0325, .04].includes(x.terminalGrowth))
    throw new Error("Original USD XOM/terminal basis required");
  const sourceRows = [...baseline.ledger.years, ...baseline.ledger.continuationYears, baseline.ledger.terminalYear];
  if (sourceRows.length !== 16) throw new Error("Original five/fade/terminal cash rows incomplete");
  const rows = sourceRows.map((b: any, i: number) => {
    const c = climate.rows[i];
    if (b.year !== c.year) throw new Error("Original carbon/operating calendar mismatch");
    const openingCarbonReceivable = i === 0 ? 0 : climate.rows[i - 1].closingPassReceivableUsd;
    const revenue = b.revenue + c.recognizedPassThroughUsd;
    const operatingProfitBeforeClimate = b.operatingProfitBeforeClimate + c.recognizedPassThroughUsd;
    const climateOperatingCost = b.climateOperatingCost + c.incrementalGrossCostUsd;
    const operatingProfit = b.operatingProfit + c.incrementalOperatingProfitUsd;
    const openingReceivables = b.openingReceivables + openingCarbonReceivable;
    const closingReceivables = b.closingReceivables + c.closingPassReceivableUsd;
    const receivablesIncrease = b.receivablesIncrease + c.passReceivablesIncreaseUsd;
    if (Math.abs(closingReceivables - openingReceivables - receivablesIncrease) > .02 ||
      Math.abs(operatingProfitBeforeClimate - climateOperatingCost + b.recognizedPolicyCredit - operatingProfit) > .02)
      throw new Error("Carbon income-statement/receivable-stock bridge failed");
    const operatingCashFlow = operatingProfit + b.depreciation + b.otherNonCash + b.otherOperatingCash -
      b.recognizedPolicyCredit + b.cashPolicyCredit - receivablesIncrease -
      b.increaseOtherOperatingWorkingCapital - b.interestPaid - b.cashTax;
    const fcfe = operatingCashFlow - b.capitalSpend + b.debtProceeds - b.debtRepayments - b.nonCommonCashClaims;
    if (Math.abs(fcfe - b.fcfe - c.incrementalOperatingCashUsd) > .02) throw new Error("Funded operating/carbon reconciliation failed");
    return { ...b, revenue, nonClimateRevenue: b.nonClimateRevenue + c.recognizedPassThroughUsd,
      operatingProfitBeforeClimate, operatingMarginBeforeClimateCostsAndCredits: operatingProfitBeforeClimate / revenue,
      climateOperatingCost, operatingProfit, openingReceivables, closingReceivables, receivablesIncrease,
      collections: revenue - receivablesIncrease, operatingCashFlow, fcfe,
      climateIncrementalGrossCostUsd: c.incrementalGrossCostUsd,
      climateRecognizedRecoveryUsd: c.recognizedPassThroughUsd,
      climateCashRecoveryUsd: c.cashPassThroughUsd,
      climatePassReceivablesIncreaseUsd: c.passReceivablesIncreaseUsd };
  });
  const g = x.terminalGrowth;
  for (const key of ["fcfe", "climateIncrementalGrossCostUsd", "climateCashRecoveryUsd", "climatePassReceivablesIncreaseUsd"])
    if (Math.abs(rows[15][key] - rows[14][key] * (1 + g)) > .02) throw new Error(`Original funded terminal not steady: ${key}`);
  const time = (date: string) => (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
  const stubPv = x.stub.cashFlows.reduce((sum: number, y: any) => sum + y.fcfe / (1 + x.discountRate) ** time(y.date), 0);
  const formalSignedCashSum = stubPv + rows.slice(0, 15).reduce((sum: number, y: any) =>
    sum + y.fcfe / (1 + x.discountRate) ** time(y.cashFlowDate), 0) +
    rows[15].fcfe / (x.discountRate - g) / (1 + x.discountRate) ** time(rows[14].cashFlowDate);
  return { rows, stubPv, formalSignedCashSum, forwardWholeEquity: rows[15].fcfe > 0 && formalSignedCashSum > 0 ? formalSignedCashSum : null,
    status: rows[15].fcfe > 0 && formalSignedCashSum > 0 ? "conditional-geographic-cost-component" : "rejected-nonpositive-terminal-or-value",
    qualifiedOriginalIssuers: 0, reverseScoringPerformed: false, originalReplacementFundingUnchanged: true,
    embeddedHistoricalCarbonExpenseIdentified: false, ccsTariffInvented: false };
}
