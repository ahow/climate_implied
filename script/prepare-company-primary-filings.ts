import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { buildCompanyFilingPair } from "../server/calculation/companyFilingPair";
import { fmpRequest } from "../server/financialData/provider";

if (process.env.NODE_ENV === "production") throw new Error("Private development calculation only");
const root = "generated-artifacts/company-operating-corpus/primary-filings";
mkdirSync(root, { recursive: true });
const sha = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
if (process.argv.includes("--market-attempt")) {
  await attemptExistingMarketProvider();
  process.exit(0);
}

async function attemptExistingMarketProvider() {
  const prior = JSON.parse(readFileSync(`${root}/readiness-report.json`, "utf8"));
  const startedAt = new Date().toISOString();
  const attempts = [];
  for (const c of prior.cases) {
    const symbol = c.facts.symbol;
    const responses: Record<string, Record<string, unknown>[]> = {};
    const requests = [];
    // Exactly nine read-only calls maximum, no retries or expanded provider allowlist.
    for (const endpoint of ["profile", "quote", "balance-sheet-statement"]) {
      const params = endpoint === "balance-sheet-statement"
        ? { symbol, period: "annual", limit: "1" } : { symbol };
      const observedAt = new Date().toISOString();
      try {
        const rows = await fmpRequest(endpoint, params);
        responses[endpoint] = rows;
        // Keep selected non-secret provider fields privately; never persist credential-bearing URLs.
        const fields = ["symbol", "isin", "cik", "currency", "exchange", "isAdr", "isActivelyTrading",
          "price", "timestamp", "marketCap", "sharesOutstanding", "sharesDate", "date",
          "fiscalYear", "period", "reportedCurrency", "filingDate", "acceptedDate",
          "commonStockSharesOutstanding", "weightedAverageShsOut", "weightedAverageShsOutDil"];
        const selectedRows = rows.map(row => Object.fromEntries(fields.filter(k => k in row).map(k => [k, row[k]])));
        requests.push({ endpoint: `/stable/${endpoint}`, params, observedAt,
          status: "success", returnedRows: rows.length, responseHash: sha(JSON.stringify(rows)),
          responseFields: rows.map(row => Object.keys(row).sort()),
          retainedFieldsHash: sha(JSON.stringify(selectedRows)), selectedRows });
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const safeStatus = /^FMP HTTP \d{3}$/.test(message) || [
          "FMP credential is not configured", "FMP request failed or timed out",
          "FMP returned invalid JSON", "FMP returned an unexpected response",
        ].includes(message) ? message : "Provider request failed; unsafe error details suppressed";
        requests.push({ endpoint: `/stable/${endpoint}`, params, observedAt, status: safeStatus });
      }
    }
    const profile = responses.profile?.[0], quote = responses.quote?.[0];
    const balance = responses["balance-sheet-statement"]?.[0];
    const quoteDate = typeof quote?.timestamp === "number" && Number.isFinite(quote.timestamp) &&
      quote.timestamp > 0 && quote.timestamp < 1e11
      ? new Date(quote.timestamp * 1000).toISOString() : null;
    const issues = [];
    const expectedIsin = { FSLR: "US3364331070", NEE: "US65339F1012", XOM: "US30231G1022" }[symbol as "FSLR" | "NEE" | "XOM"];
    if (profile?.symbol !== symbol || profile?.isin !== expectedIsin ||
      String(profile?.cik).padStart(10, "0") !== c.facts.cik ||
      profile?.currency !== "USD" || profile?.isAdr !== false)
      issues.push("Profile exact ISIN/CIK/symbol/USD/non-ADR identity is unavailable or mismatched.");
    if (!quoteDate) issues.push("Quote has no admissible Unix-second price timestamp.");
    if (quoteDate && Date.parse(quoteDate) > Date.now() + 300000)
      issues.push("Quote timestamp is in the future relative to capture.");
    const explicitShares = quote?.sharesOutstanding ?? profile?.sharesOutstanding;
    const explicitSharesDate = quote?.sharesDate ?? profile?.sharesDate;
    if (typeof explicitShares !== "number" || explicitShares <= 0)
      issues.push("Neither quote nor profile supplies explicit positive total common sharesOutstanding; marketCap/price is not an independently observed share count.");
    if (!explicitSharesDate || explicitSharesDate !== quoteDate?.slice(0, 10))
      issues.push(`Share effective date ${String(explicitSharesDate ?? "absent")} does not establish same-date shares for quote ${quoteDate ?? "absent"}.`);
    if (balance) issues.push(`Balance-sheet date ${String(balance.date ?? "absent")} is a fiscal observation, not shares effective on quote date ${quoteDate?.slice(0, 10) ?? "absent"}; latest balance data will not replace frozen FY2024 cash-flow inputs.`);
    issues.push(...c.facts.accountingCaveats);
    if (c.baseFcfe <= 0) issues.push("Existing positive-FCFE solver cannot execute this issuer without supported recovery.");
    issues.push("Frozen flat-cash diagnostic is not an accepted justified operating forecast; no new forward or terminal assumption introduced.");
    attempts.push({ symbol, requests, quoteDate, explicitShares: explicitShares ?? null,
      explicitSharesDate: explicitSharesDate ?? null, status: "blocked", issues,
      recovery: "Obtain explicitly dated total common outstanding shares paired with authorized quote date and source scope; reconcile issuer-specific common-equity operating/financing claims and justified forward assumptions. Historical share endpoint is outside existing client allowlist; no expansion or purchase attempted.",
      executedActualPairs: 0 });
  }
  const report = { provider: "FMP via existing fmpRequest client", startedAt,
    completedAt: new Date().toISOString(), maximumRequests: 9, attempts,
    authorizedMarketReferences: 0, executedActualPairs: 0, completeApprovedIssuerCases: 0,
    unchangedAssumptions: true, noProductionWrites: true,
    authorization: "Existing installed-provider read-only access explicitly requested; no redistribution licence or new billing authorization inferred.",
  };
  writeFileSync(`${root}/market-reference-attempt.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ path: `${root}/market-reference-attempt.json`,
    attempts: attempts.map(a => ({ symbol: a.symbol, requests: a.requests.map(r => ({ endpoint: r.endpoint, status: r.status })),
      quoteDate: a.quoteDate, explicitSharesDate: a.explicitSharesDate, executedActualPairs: 0 })) }));
}
const definitions = [
  { symbol: "FSLR", issuer: "First Solar, Inc.", cik: "0001274494",
    security: "Common stock, $0.001 par value", slug: "f/NASDAQ_FSLR",
    documentDate: "2025-02-25", unit: 1000,
    rows: [
      ["Net cash provided by operating activities", "1,217,999", 1217999],
      ["Purchases of property, plant and equipment", "(1,526,076)", 1526076],
      ["Proceeds from borrowings under debt arrangements, net of issuance costs", "258,461", 258461],
      ["Repayment of debt", "(205,821)", 205821],
    ], accountingCaveats: ["Growth capex and 45X monetization/tax timing require prospective operating bridge; FY2024 cannot replace the separate FY2025/guidance conditional five-year experiment."] },
  { symbol: "NEE", issuer: "NextEra Energy, Inc.", cik: "0000753308",
    security: "Common Stock, $0.01 Par Value", slug: "n/NYSE_NEE",
    documentDate: "2025-02-14", unit: 1000000,
    rows: [
      ["Net cash provided by operating activities", "13,260", 13260],
      ["Capital expenditures of FPL", "(7,992)", 7992],
      ["Independent power and other investments of NEER", "(16,215)", 16215],
      ["Nuclear fuel purchases", "(399)", 399],
      ["Other capital expenditures", "(123)", 123],
      ["Issuances of long-term debt, including premiums and discounts", "24,769", 24769],
      ["Retirements of long-term debt", "(10,113)", 10113],
      ["Net change in commercial paper", "(2,980)", 2980],
      ["Proceeds from other short-term debt", "6,575", 6575],
      ["Repayments of other short-term debt", "(6,613)", 6613],
    ], accountingCaveats: ["NEER investments include broader investing than ordinary capex; differential membership/NCI claims, related-party cash sweeps, asset-sale proceeds, restricted funds and financing sustainability require common-equity allocation. Not an FPL-only issuer case."] },
  { symbol: "XOM", issuer: "Exxon Mobil Corporation", cik: "0000034088",
    security: "Common Stock, without par value", slug: "e/NYSE_XOM",
    documentDate: "2025-02-19", unit: 1000000,
    rows: [
      ["Net cash provided by operating activities", "55,022", 55022],
      ["Additions to property, plant and equipment", "(24,306)", 24306],
      ["Additions to long-term debt", "899", 899],
      ["Reductions in long-term debt", "(1,150)", 1150],
      ["Additions to short-term debt", "—", 0],
      ["Reductions in short-term debt", "(4,743)", 4743],
    ], accountingCaveats: ["PP&E-only capex bridge excludes additional investments/advances, acquisitions and divestments; NCI distributions and full common-equity claim boundary require reconciliation. No CCS tariff or CAT coefficient inferred."] },
];
const cases = definitions.map(d => {
  const sourceUrl = `https://www.annualreports.com/HostedData/AnnualReportArchive/${d.slug}_2024.pdf`;
  const pdf = `${root}/${d.symbol}-2024.pdf`, txt = `${root}/${d.symbol}-2024.txt`;
  // Public mirrored primary documents, not a claim of independently authenticated SEC archive.
  execFileSync("curl", ["--fail", "--location", "--silent", "--show-error", "--max-time", "90", sourceUrl, "-o", pdf]);
  const observedAt = new Date().toISOString();
  execFileSync("pdftotext", ["-layout", pdf, txt]);
  const text = readFileSync(txt, "utf8");
  if (!text.includes("December 31, 2024") || !text.includes("FORM 10-K"))
    throw new Error(`${d.symbol}: fiscal period or filing type missing`);
  const shareFacts = {
    FSLR: { shares: 107062105, token: "107,062,105", referenceDate: "2025-02-21" },
    NEE: { shares: 2057026280, token: "2,057,026,280", referenceDate: "2025-01-31" },
    XOM: { shares: 4339143313, token: "4,339,143,313", referenceDate: "2025-01-31" },
  }[d.symbol as "FSLR" | "NEE" | "XOM"];
  if (!text.includes(shareFacts.token)) throw new Error("Missing cover-page common shares");
  if (d.symbol === "XOM" && !text.includes("$115.12")) throw new Error("Missing cover-page historical price");
  const locators = d.rows.map(([label, token, amount]) => {
    const line = text.split("\n").find(l => l.includes(String(label)) && l.includes(String(token)));
    if (!line) throw new Error(`${d.symbol}: missing filing row ${label} / ${token}`);
    return { label, token, amount, line: text.split("\n").indexOf(line) + 1 };
  });
  const v = d.rows.map(r => Number(r[2]) * d.unit);
  const facts = {
    symbol: d.symbol, issuer: d.issuer, cik: d.cik, security: d.security, currency: "USD",
    fiscalEnd: "2024-12-31", documentDate: d.documentDate, observedAt, sourceUrl,
    sourceHash: sha(readFileSync(pdf)), textHash: sha(text),
    operatingCashFlow: v[0],
    capitalSpend: d.symbol === "NEE" ? v[1] + v[2] + v[3] + v[4] : v[1],
    debtProceeds: d.symbol === "NEE" ? v[5] + v[8] : d.symbol === "XOM" ? v[2] + v[4] : v[2],
    debtRepayments: d.symbol === "NEE" ? v[6] + v[7] + v[9] : d.symbol === "XOM" ? v[3] + v[5] : v[3],
    accountingCaveats: d.accountingCaveats,
  };
  return { ...buildCompanyFilingPair(facts), locators, extractionUnit: d.unit,
    disclosedMarketFacts: {
      shares: shareFacts.shares, sharesDate: shareFacts.referenceDate,
      sharesBasis: "Total common outstanding on filing cover, not diluted weighted-average shares",
      price: d.symbol === "XOM" ? 115.12 : null,
      priceDate: d.symbol === "XOM" ? "2024-06-28" : null,
      sourceHash: facts.sourceHash, locator: "Form 10-K cover page",
      usablePairedReference: false,
      missingLink: "No matching-date total shares plus authorized closing price; June non-affiliate float is not whole-company equity. Cover price predates annual filing.",
    },
    sourceStatus: "Public mirror of issuer annual report containing Form 10-K; SEC endpoint returned 403. Hash proves retained-byte integrity, not authenticity approval.",
    documentDateBasis: "Date on signed/audited annual report; SEC acceptance timestamp not independently verified.",
    licence: "Public disclosure retained privately; no redistribution licence asserted.",
    frozenAt: observedAt,
  };
});
const report = {
  cases, requestedCases: 3, primaryDocumentExtractions: cases.length,
  independentlySecAuthenticatedCases: 0, authorizedMarketReferences: 0,
  executedWholeEquityPairs: 0, completeApprovedIssuerCases: 0,
  unchanged: ["Gordon primary", "completed beta", "common-eight failure", "no empirical refit",
    "original hypothetical FSLR five-year FCFE/PV remains separate and incomplete"],
  limitations: ["Three historical issuer filing bridges, not three complete forward operating cases.",
    "2025 archive URLs were unavailable; FY2024 chosen explicitly, not silently substituted as latest.",
    "No dated authorized market input or justified full-horizon operating forecast; no arbitrary terminal supplied to force execution.",
    "No approvals, backdating, central-ledger changes, production writes or paid calls."],
};
writeFileSync(`${root}/readiness-report.json`, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ path: `${root}/readiness-report.json`, extracted: cases.length,
  cases: cases.map(c => ({ symbol: c.facts.symbol, baseFcfe: c.baseFcfe, status: c.status })),
  executedWholeEquityPairs: 0, completeApprovedIssuerCases: 0 }));
