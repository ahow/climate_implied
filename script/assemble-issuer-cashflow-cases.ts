/** Private bounded issuer work. Does not touch collectors, providers, production or old experiments. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { authenticatePrimaryIssuerCashflow, buildIssuerCashflowScenario,
  type IssuerCashflowObservation } from "../server/calculation/issuerCashflowCase";
import { calculateCompanyFullCashflowCase, valueCompanyFullCashflowCase } from "../server/calculation/companyFullCashflowCase";
import { pairSourcedCompanyCase } from "../server/calculation/companyCaseEvidence";
import { contentHash } from "../server/calculation/analysisManifest";

if (process.env.NODE_ENV === "production") throw new Error("Private development issuer calculation only");
const root = "generated-artifacts/company-operating-corpus";
const output = `${root}/issuer-cashflow-v1`;
mkdirSync(output, { recursive: true });
const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const prior = read(`${root}/primary-filings/readiness-report.json`);
const publications = read(`${root}/next-company-evidence/publication-attempts.json`);

if (process.argv.includes("--capture-primary")) {
  if (existsSync(`${output}/primary-receipts.json`)) throw new Error("Primary capture exists; no repeat requests");
  const receipts = [];
  for (const c of prior.cases) {
    const p = publications.find((row: any) => row.symbol === c.facts.symbol);
    const annual = p.annual[0];
    const url = `https://www.sec.gov/Archives/edgar/data/${Number(c.facts.cik)}/${annual.accessionNumber.replaceAll("-", "")}/${annual.primaryDocument}`;
    const startedAt = new Date().toISOString();
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000),
        headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" } });
      const body = await response.text();
      const path = `${output}/${c.facts.symbol}-primary.html`;
      writeFileSync(path, body);
      receipts.push({ symbol: c.facts.symbol, cik: c.facts.cik, url, path, startedAt,
        capturedAt: new Date().toISOString(), httpStatus: response.status, sha256: sha(body),
        accession: annual.accessionNumber, availableAt: annual.acceptanceDateTime,
        status: response.ok ? "primary-bytes-captured-not-yet-claim-authenticated" : "http-error" });
    } catch (error) {
      receipts.push({ symbol: c.facts.symbol, url, startedAt, status: "transport-error",
        errorType: error instanceof Error ? error.name : "UnknownError" });
    }
  }
  writeFileSync(`${output}/primary-receipts.json`, JSON.stringify(receipts, null, 2) + "\n");
  console.log(JSON.stringify({ capture: receipts.map(r => ({ symbol: r.symbol, status: r.status })),
    requests: receipts.length, maximumRequests: 3, retries: 0, noProviderRequests: true }));
} else {
  assemble();
}

function assemble() {
  const receipts = read(`${output}/primary-receipts.json`);
  const quotes = read(`${root}/dated-market-sources/fmp-dated-price-attempt.json`);
  const shareReview = read(`${root}/primary-filings/share-review/report.json`);
  const retainedProfiles = read(`${root}/primary-filings/market-reference-attempt.json`);
  const old = read(`${root}/fslr-full-cashflow/latest.json`);
  const retained = read(old.reportPath);
  if (retained.cashSchedulesExecuted !== 10 || retained.annualRowsExecuted !== 50)
    throw new Error("Retained distinct FSLR 10/50 invariant violated");
  const archivedPaths = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => entry.isDirectory() ? archivedPaths(`${directory}/${entry.name}`) : [`${directory}/${entry.name}`]);
  const archive = archivedPaths(`${root}/fslr-full-cashflow/pinned-code`);
  const pinnedCodeAssertions = retained.freezeReceipt.codeSources.map((source: any) => {
    const matches = archive.filter(path => path.endsWith(`/${source.path}`));
    const verified = matches.find(path => sha(readFileSync(path)) === source.sha256);
    if (!verified) throw new Error(`Frozen FSLR pinned source missing or corrupt: ${source.path}`);
    return { path: verified, sha256: source.sha256, matched: true };
  });
  const preserved = { reportPath: old.reportPath, freezePath: old.freezePath,
    reportHash: sha(readFileSync(old.reportPath)), freezeHash: sha(readFileSync(old.freezePath)),
    schedules: 10, annualRows: 50, rerun: false, pinnedCodeAssertions };
  const frozenAt = new Date().toISOString();
  const runDir = `${output}/${frozenAt.replaceAll(":", "-").replaceAll(".", "-")}`;
  mkdirSync(runDir, { recursive: true });
  const preparations: any[] = [], blockedSources: any[] = [];
  for (const c of prior.cases) {
    try {
      const receipt = receipts.find((r: any) => r.symbol === c.facts.symbol);
      if (receipt?.httpStatus !== 200) throw new Error("Primary SEC content unavailable");
      const html = readFileSync(receipt.path, "utf8");
      if (sha(html) !== receipt.sha256) throw new Error("Primary SEC content hash mismatch");
      const primary = authenticatePrimaryIssuerCashflow(html, c.facts);
      const a = primary.annual;
      if (a("us-gaap:NetCashProvidedByUsedInOperatingActivities") !== c.facts.operatingCashFlow)
        throw new Error("Primary FY2024 CFO differs from retained financial basis");
      const candidate = quotes.candidates.find((r: any) => r.target.symbol === c.facts.symbol);
      const quoteReceipt = quotes.receipts.find((r: any) => r.symbol === c.facts.symbol ||
        r.id === `${c.facts.symbol}-fmp-exact-primary-date`);
      if (sha(readFileSync(quoteReceipt.path)) !== quoteReceipt.sha256)
        throw new Error("Retained exact-date provider bytes changed");
      const primaryShares = primary.read("dei:EntityCommonStockSharesOutstanding",
        { annual: false, expected: candidate.target.primaryShares });
      const shareContext = html.match(new RegExp(`<xbrli:context id="${primaryShares.context}">([\\s\\S]*?)<\\/xbrli:context>`))?.[1] ?? "";
      if (!shareContext.includes(`<xbrli:instant>${candidate.quoteDate}</xbrli:instant>`))
        throw new Error("Primary exact share effective date differs from quote");
      const originalShares = shareReview.observations.find((r: any) => r.symbol === c.facts.symbol && r.cik === c.facts.cik);
      const shares = { ...originalShares, evidence: { ...originalShares.evidence,
        url: receipt.url, sha256: receipt.sha256, capturedAt: receipt.capturedAt,
        publicationBasis: "issuer-filing-index",
        locator: `SEC ${receipt.accession}, iXBRL ${primaryShares.id}, exact dated issuer cover shares` } };
      const symbol = c.facts.symbol;
      const isFslr = symbol === "FSLR", isNee = symbol === "NEE";
      const revenue = a(isNee ? "us-gaap:RegulatedAndUnregulatedOperatingRevenue" : "us-gaap:Revenues");
      const depreciation = a(isFslr ? "us-gaap:DepreciationAmortizationAndAccretionNet" :
        isNee ? "us-gaap:DepreciationAndAmortization" : "us-gaap:DepreciationDepletionAndAmortization");
      const interest = a(isFslr ? "us-gaap:InterestPaid" : "us-gaap:InterestPaidNet");
      const capex = isNee ? a("nee:CapitalExpendituresIndependentPowerInvestmentsAndNuclearFuelPurchases") :
        a("us-gaap:PaymentsToAcquirePropertyPlantAndEquipment");
      if (capex !== c.facts.capitalSpend) throw new Error("Primary capex does not reconcile selected FY2024 bridge");
      const debtProceeds = isFslr ? a("us-gaap:ProceedsFromIssuanceOfDebt") :
        isNee ? a("us-gaap:ProceedsFromIssuanceOfLongTermDebt") +
          a("us-gaap:ProceedsFromOtherShortTermDebt") : a("us-gaap:ProceedsFromIssuanceOfLongTermDebt");
      const debtRepayments = isFslr ? a("us-gaap:RepaymentsOfDebt") :
        isNee ? a("us-gaap:RepaymentsOfLongTermDebt") + a("us-gaap:RepaymentsOfOtherShortTermDebt") +
          Math.abs(a("us-gaap:ProceedsFromRepaymentsOfCommercialPaper")) :
          a("us-gaap:RepaymentsOfLongTermDebt") + a("us-gaap:RepaymentsOfShortTermDebtMaturingInMoreThanThreeMonths");
      if (debtProceeds !== c.facts.debtProceeds || debtRepayments !== c.facts.debtRepayments)
        throw new Error("Primary financing differs from unchanged FY2024 bridge");
      const profile = retainedProfiles.attempts.find((r: any) => r.symbol === symbol)?.requests
        .find((r: any) => r.endpoint === "/stable/profile")?.selectedRows?.[0];
      if ((isFslr || isNee) && (profile?.currency !== "USD" || profile?.symbol !== symbol ||
          String(profile?.cik).padStart(10, "0") !== c.facts.cik || profile?.isAdr !== false))
        throw new Error("Provider currency/non-ADR/issuer corroboration missing; no quote currency inferred");
      const policyCredit = isFslr ? primary.read("us-gaap:GovernmentAssistanceAmount",
        { annual: false, expected: 1009451000 }).value : 0;
      const operatingIncome = isFslr ? a("us-gaap:OperatingIncomeLoss") - a("us-gaap:GainLossOnSaleOfBusiness") :
        isNee ? a("us-gaap:OperatingIncomeLoss") :
          // An explicitly labelled cash-margin benchmark, not reported GAAP EBIT.
          c.facts.operatingCashFlow - depreciation + interest + a("us-gaap:IncomeTaxesPaidNet");
      const observation: IssuerCashflowObservation = {
        identity: { symbol, cik: c.facts.cik, security: c.facts.security, fiscalEnd: c.facts.fiscalEnd },
        referenceDate: candidate.quoteDate, frozenAt, sourceHash: receipt.sha256,
        availableAt: receipt.availableAt, historicalBaseFcfe: c.baseFcfe,
        revenue, operatingIncome, depreciation, interest, policyCredit, capex,
        otherInvesting: isFslr ? a("us-gaap:PaymentsForProceedsFromOtherInvestingActivities") :
          isNee ? a("us-gaap:PaymentsForProceedsFromNuclearFuel") : a("xom:AdditionalInvestmentsAndAdvances"),
        nonCommonClaims: isFslr ? 0 : isNee ? Math.abs(a("nee:PaymentsToDifferentialMembershipInvestors")) :
          primary.read("us-gaap:PaymentsOfDividendsMinorityInterest", { expected: 658e6 }).value +
          Math.abs(a("us-gaap:ProceedsFromPaymentsToMinorityShareholders")),
        otherCash: isFslr ? a("us-gaap:ForeignCurrencyTransactionGainLossBeforeTax") +
          a("us-gaap:OtherNonoperatingIncomeExpense") : 0,
        stubLiabilitySettlement: isFslr ? a("us-gaap:CapitalExpendituresIncurredButNotYetPaid") : 0,
        gaps: isFslr ? [] : isNee ? [
          "NEE issuer-wide differential-membership and remaining NCI cash allocation unresolved; $740m deduction is observed, not complete common-claim allocation.",
          "Maintenance D&A benchmark cannot replace issuer-wide NEER investing, nuclear fuel and noncash capex obligations without engineering and claim review.",
        ] : [
          "XOM cash-margin benchmark grossed up from historical CFO is not a complete accrual operating bridge; deferred tax, asset sales, equity-company cash and WC need field-level reconciliation.",
          "All predecessor NCI cash/contingent consideration classification and reinvestment adequacy still require review. Successor CIK/ISIN is deliberately NOT joined.",
        ],
      };
      const facts = { ...c.facts, sourceUrl: receipt.url, sourceHash: receipt.sha256,
        textHash: sha(html.replace(/<[^>]*>/g, "")), observedAt: receipt.capturedAt };
      const market = { symbol, cik: facts.cik, security: facts.security, currency: "USD",
        referenceDate: candidate.quoteDate, priceDate: candidate.quoteDate, sharesDate: candidate.quoteDate,
        price: candidate.unadjustedClose, shares: primaryShares.value,
        sourceUrl: "https://financialmodelingprep.com/stable/historical-price-eod/non-split-adjusted",
        sourceHash: quoteReceipt.sha256, observedAt: quoteReceipt.capturedAt,
        usageAuthorization: "Existing authorized read-only FMP access; private calculation only, no redistribution licence asserted.",
        sharesBasis: "total-common-outstanding-not-diluted-or-float" };
      preparations.push({ facts, receipt, market, shares, quoteReceipt,
        sourceAuthentication: { accession: receipt.accession, primaryHash: receipt.sha256,
          financialBasis: "FY2024 unchanged; primary CIK/duration/USD fields reconcile retained CFO/capex/debt bridge",
          exchange: primary.exchange, marketCurrencyBasis: primary.marketCurrencyBasis,
          providerCurrencyCorroboration: isFslr || isNee ? "Retained profile exact CIK, symbol, USD and non-ADR; primary cover market-equity USD/class/exchange supplies primary cross-check" :
            "Current successor profile deliberately NOT used to qualify predecessor security",
          publicFloatUnitFact: primary.publicFloat.id, exactSharesFact: primaryShares.id,
          successorJoined: false, identityApproved: false },
        scenarios: [false, true].map(stress => buildIssuerCashflowScenario(observation, stress)) });
    } catch (error) {
      blockedSources.push({ symbol: c.facts.symbol, error: error instanceof Error ? error.message : "Source review failed" });
    }
  }
  // All new operating assumptions, market targets and source review precede ANY
  // model execution/outcome. Exclusive create: never rewrite an existing freeze.
  const freeze = { version: "issuer-fy2024-maintenance-1", frozenAt, preparations, blockedSources, preserved,
    modelCode: Object.fromEntries(["server/calculation/issuerCashflowCase.ts",
      "server/calculation/companyFullCashflowCase.ts", "server/calculation/companyCaseEvidence.ts"]
      .map(path => [path, sha(readFileSync(path))])) };
  const freezePath = `${runDir}/frozen-before-outcomes.json`;
  writeFileSync(freezePath, JSON.stringify(freeze, null, 2) + "\n", { flag: "wx" });
  const results = preparations.flatMap(p => p.scenarios.map((scenario: any) => {
    try {
    const ledger = calculateCompanyFullCashflowCase(scenario.engineInput);
    const contract = buildContract(p, scenario, ledger);
    const result = pairSourcedCompanyCase(contract);
    const forward = ledger.status === "blocked" ? null : valueCompanyFullCashflowCase(scenario.engineInput);
    writeFileSync(`${runDir}/${scenario.id}-contract.json`, JSON.stringify(contract, null, 2) + "\n", { flag: "wx" });
    return { id: scenario.id, symbol: p.facts.symbol, scenario, sourceAuthentication: p.sourceAuthentication,
      ledger, forward, assessmentGaps: result.assessment.gaps, pairing: result.pairing };
    } catch (error) {
      return { id: scenario.id, symbol: p.facts.symbol, scenario, ledger: null, forward: null, pairing: null,
        assessmentGaps: [error instanceof Error ? error.message : "Scenario execution failed"],
        calculationFailed: true };
    }
  }));
  if (sha(readFileSync(old.reportPath)) !== preserved.reportHash || sha(readFileSync(old.freezePath)) !== preserved.freezeHash)
    throw new Error("Retained FSLR experiment changed");
  const report = { version: "issuer-fy2024-maintenance-1", frozenAt, calculatedAt: new Date().toISOString(),
    freezePath, freezeHash: sha(readFileSync(freezePath)), results, blockedSources, preserved,
    actualMarketPairs: results.filter((r: any) => r.pairing?.pairing === "conditional-same-basis-whole-equity").length,
    uniquePairedIssuers: Array.from(new Set(results.filter((r: any) =>
      r.pairing?.pairing === "conditional-same-basis-whole-equity").map((r: any) => r.symbol))),
    ownerApproved: false, productionEligible: false, completeApprovedIssuerCases: 0,
    timing: "Revised-history conditional at exact primary share/quote date; later filing and actual 2026 freeze disclosed. NOT historically available signal or current valuation.",
    noProviderRequests: true, noProductionWrites: true };
  const reportPath = `${runDir}/report.json`;
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  writeFileSync(`${output}/latest.json`, JSON.stringify({ reportPath, freezePath }, null, 2) + "\n");
  console.log(JSON.stringify({ reportPath, freezePath, actualPairs: report.actualMarketPairs,
    scenarios: results.map((r: any) => ({ id: r.id, annualRows: r.ledger?.years.length ?? 0,
      continuationRows: r.ledger?.continuationYears.length ?? 0, terminalRows: r.ledger?.terminalYear ? 1 : 0,
      gaps: r.assessmentGaps, pairing: r.pairing?.pairing ?? null })), blockedSources }));
}

function buildContract(p: any, scenario: any, ledger: ReturnType<typeof calculateCompanyFullCashflowCase>) {
  const s = scenario.engineInput, frozenAt = s.frozenAt;
  const claims = (path: string, value: unknown) => ({ path, valueHash: contentHash(value), locator: "Frozen explicit scenario input; see rationale and primary source dependencies" });
  const financialBindings: Record<string, string[]> = {};
  const assumptionClaims: any[] = [];
  const bindRows = (rows: any[], prefix: string) => rows.forEach((row, i) => {
    for (const [key, value] of Object.entries(row)) if (typeof value === "number") {
      const path = `${prefix}/${i}/${key}`;
      financialBindings[path] = ["frozen-scenario"];
      assumptionClaims.push(claims(path, value));
    }
  });
  bindRows(s.years, "/financialCashflow/years");
  bindRows([...s.continuation.years, s.continuation.terminalYear], "/financialCashflow/continuation");
  financialBindings["/financialCashflow/baseFcfe"] = ["primary-fy2024"];
  const topics = ["discountRate", "terminalGrowth", "continuationGrowthAtYear5", "maintenanceAndGrowthReinvestment",
    "workingCapital", "cashTax", "financing", "nonCommonClaims", "policyExpiryAndEligibility"];
  const basisByTopic = Object.fromEntries(topics.map(topic => [topic,
    `${topic}: ${scenario.rationale.join(" ")}`]));
  const terminal = { model: "explicit-fcfe-ten-year-fade", rateBasis: "nominal",
    discountRate: s.discountRate, terminalGrowth: s.terminalGrowth,
    continuationGrowthAtYear5: s.continuationGrowthAtYear5,
    sustainableYearFiveFcfe: ledger.years[4].fcfe, basisByTopic,
    evidenceByTopic: Object.fromEntries(topics.map(topic => [topic, ["frozen-scenario"]])) };
  for (const topic of topics) assumptionClaims.push(claims(`/terminal/basisByTopic/${topic}`, basisByTopic[topic]));
  for (const topic of ["discountRate", "terminalGrowth", "continuationGrowthAtYear5", "sustainableYearFiveFcfe"])
    assumptionClaims.push(claims(`/terminal/${topic}`, terminal[topic as keyof typeof terminal]));
  assumptionClaims.push(claims("/stub", s.stub));
  s.stub.cashFlows.forEach((row: any, i: number) => assumptionClaims.push(claims(`/stub/cashFlows/${i}`, row)));
  const baseEvidence = { symbol: p.facts.symbol, cik: p.facts.cik, security: p.facts.security,
    licence: "Public disclosure or authorized provider observation privately retained; no raw redistribution permission inferred." };
  const evidence = [
    { ...baseEvidence, ...s.evidence[0], url: p.receipt.url, capturedAt: p.receipt.capturedAt,
      publicationBasis: "verified-publication", dependencies: [],
      claims: [claims("/facts", p.facts), claims("/financialCashflow/baseFcfe", s.baseFcfe),
        claims("/market/primaryShares", p.shares)] },
    { ...baseEvidence, ...s.evidence[1], url: p.receipt.url, capturedAt: frozenAt,
      publicationBasis: "actual-assumption-freeze", dependencies: ["primary-fy2024"], claims: assumptionClaims },
    { ...baseEvidence, id: "authorized-exact-date-quote", kind: "primary-disclosure",
      url: p.market.sourceUrl, sha256: p.market.sourceHash, capturedAt: p.market.observedAt,
      availableAt: `${p.market.priceDate}T21:00:00.000Z`, publicationBasis: "verified-publication",
      rationale: "Retained authorized exact primary-share-date unadjusted close; SEC registered class and USD public common-equity market value reviewed separately.",
      dependencies: [], claims: [claims("/market/reference", p.market)] },
  ];
  return { version: "sourced-company-case-1", facts: p.facts,
    referenceAt: s.informationContext.modelAsOf, frozenAt, informationCutoff: frozenAt,
    assessmentMode: "revised-history-conditional", evidence, financialBasisEvidenceIds: ["primary-fy2024"],
    financialCashflow: { engineInput: s, bindings: financialBindings }, stub: s.stub, terminal,
    market: { reference: p.market, quoteAt: `${p.market.priceDate}T21:00:00.000Z`,
      quoteEvidenceIds: ["authorized-exact-date-quote"], shareEvidenceIds: ["primary-fy2024"], primaryShares: p.shares },
    unresolvedClaims: scenario.observation.gaps };
}
