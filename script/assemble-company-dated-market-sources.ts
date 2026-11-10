/** Bounded private source discovery. No model assumptions or research reruns. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { primaryDatedQuoteTargets, publicSourceReceipt } from "./company-dated-market-source-contract";

if (process.env.NODE_ENV === "production") throw new Error("Private development source assembly only");
const root = "generated-artifacts/company-operating-corpus/dated-market-sources";
mkdirSync(root, { recursive: true });
const sha = (bytes: string) => createHash("sha256").update(bytes).digest("hex");
const discovery = [
  { id: "fmp-full-documentation", url: "https://site.financialmodelingprep.com/developer/docs/stable/historical-price-eod-full" },
  { id: "fmp-nonsplit-documentation", url: "https://site.financialmodelingprep.com/developer/docs/stable/historical-price-eod-non-split-adjusted" },
  { id: "FSLR-issuer-stock", url: "https://investor.firstsolar.com/stock-information/default.aspx" },
  { id: "NEE-issuer-stock", url: "https://www.investor.nexteraenergy.com/stock-information/stock-quote-and-chart" },
  { id: "XOM-issuer-historical", url: "https://investor.exxonmobil.com/stock-info/historical-data" },
];
const issuerLinks = [
  { id: "NEE-issuer-historical", url: "https://www.investor.nexteraenergy.com/stock-information/historical-price-lookup" },
  { id: "XOM-public-qmod-loader", url: "https://qmod.quotemedia.com/js/qmodLoader.js" },
  { id: "fmp-official-docs-domain", url: "https://financialmodelingprep.com/developer/docs/stable/historical-price-eod-full" },
];
const embeddedSources = [
  { id: "NEE-issuer-embedded-lookup", url: "https://irs.tools.investis.com/Clients/us/nextera_energy_inc/SharePriceLookup/Default.html?culture=en-US" },
  { id: "XOM-public-pricehistory-component", url: "https://qmod.quotemedia.com/static/v1.45.0/pricehistory.js" },
];
const embeddedAssets = [
  { id: "NEE-public-resource-loader", url: "https://irs.tools.investis.com/Clients/us/nextera_energy_inc/SharePriceLookup/js/resource-loader.js" },
  { id: "XOM-public-qmod-commons", url: "https://qmod.quotemedia.com/static/v1.45.0/commons.js" },
];
const neeLookupAssets = [
  { id: "NEE-public-lookup-config", url: "https://irs.tools.investis.com/Clients/us/nextera_energy_inc/SharePriceLookup/js/config.js" },
  { id: "NEE-public-lookup-component", url: "https://irs.tools.investis.com/Clients/us/nextera_energy_inc/SharePriceLookup/js/lookup.min.js" },
];
const sources = process.argv.includes("--nee-exact-quote") || process.argv.includes("--xom-exact-quote") ? [] :
  process.argv.includes("--nee-lookup-assets") ? neeLookupAssets :
  process.argv.includes("--embedded-assets") ? embeddedAssets :
  process.argv.includes("--embedded-sources") ? embeddedSources :
  process.argv.includes("--issuer-links") ? issuerLinks : discovery;
const receipts: Record<string, any>[] = [];
if (existsSync(`${root}/discovery-report.json`))
  receipts.push(...JSON.parse(readFileSync(`${root}/discovery-report.json`, "utf8")).receipts);
for (const source of sources) {
  if (receipts.some(r => r.url === source.url)) continue; // No retries.
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(30000),
      headers: { "User-Agent": "CompanyEvidenceReview/1.0" } });
    const text = await response.text(), path = `${root}/${source.id}.html`;
    writeFileSync(path, text);
    receipts.push({ ...source, startedAt, capturedAt: new Date().toISOString(), httpStatus: response.status,
      sha256: sha(text), path, finalUrl: response.url });
  } catch (error) {
    receipts.push({ ...source, startedAt, capturedAt: new Date().toISOString(),
      status: "transport-error", errorType: error instanceof Error ? error.name : "UnknownError" });
  }
}
if (process.argv.includes("--xom-exact-quote") && !receipts.some(r => r.id === "XOM-public-tool-access")) {
  // Exact public issuer embed authorization, as published in its retained JS.
  // The digest names the public pricehistory tool; it is not a credential.
  const url = `https://app.quotemedia.com/auth/g/authenticate/dataTool/v0/93303/${sha("pricehistory")}`;
  const startedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { method: "POST", redirect: "error", signal: AbortSignal.timeout(30000) });
    const text = await response.text();
    receipts.push({ id: "XOM-public-tool-access", url, startedAt, capturedAt: new Date().toISOString(),
      httpStatus: response.status, sha256: sha(text), requestedQuoteDate: "2025-01-31",
      bodyRetention: "public-session-token-not-retained" });
    let access: any = null;
    if (response.ok) { try { access = JSON.parse(text); } catch { /* explicit no-data below */ } }
    if (typeof access?.token === "string" && access.token.length) {
      const quoteUrl = new URL("https://app.quotemedia.com/datatool/getFullHistory.json");
      Object.entries({ symbol: "XOM", start: "2025-01-31", end: "2025-01-31",
        unadjusted: "true", adjusted: "true", adjustmentType: "None", zeroTradeDays: "true" })
        .forEach(([key, value]) => quoteUrl.searchParams.set(key, value));
      const safeUrl = quoteUrl.toString();
      quoteUrl.searchParams.set("token", access.token);
      const observedAt = new Date().toISOString();
      const quote = await fetch(quoteUrl, { redirect: "error", signal: AbortSignal.timeout(30000) });
      const raw = await quote.text(), path = `${root}/XOM-primary-date-quote.json`;
      writeFileSync(path, raw);
      receipts.push({ id: "XOM-primary-date-quote", url: safeUrl, startedAt: observedAt,
        capturedAt: new Date().toISOString(), httpStatus: quote.status, sha256: sha(raw), path,
        requestedQuoteDate: "2025-01-31" });
    }
  } catch (error) {
    receipts.push({ id: "XOM-public-workflow-error", startedAt, capturedAt: new Date().toISOString(),
      status: "transport-error", errorType: error instanceof Error ? error.name : "UnknownError" });
  }
}
if (process.argv.includes("--nee-exact-quote") && !receipts.some(r => r.id === "NEE-public-session")) {
  // Reproduce only the issuer's published public lookup workflow. No account
  // credentials, invented tokens, login bypass or alternate entitlements.
  const clientPath = "https://irs.tools.investis.com/Clients/us/nextera_energy_inc/SharePriceLookup/";
  const defaultPath = "https://irs.tools.investis.com/Clients/default_lookup/";
  const headers: Record<string, string> = { ClientName: "nextera_energy_inc", defaultPath, clientPath,
    "User-Agent": "CompanyEvidenceReview/1.0" };
  const request = async (id: string, query: string, retainBody: boolean) => {
    const url = `${clientPath}ProxyPage.aspx?${query}`, startedAt = new Date().toISOString();
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000), redirect: "error" });
      const text = await response.text();
      const path = retainBody ? `${root}/${id}.json` : null;
      if (path) writeFileSync(path, text);
      receipts.push({ id, url, startedAt, capturedAt: new Date().toISOString(), httpStatus: response.status,
        sha256: sha(text), path, requestedQuoteDate: "2025-01-31",
        bodyRetention: retainBody ? "private-ignored" : "public-session-token-not-retained" });
      if (!response.ok) return null;
      try { return JSON.parse(text); } catch { return null; }
    } catch (error) {
      receipts.push({ id, url, startedAt, capturedAt: new Date().toISOString(), status: "transport-error",
        errorType: error instanceof Error ? error.name : "UnknownError", requestedQuoteDate: "2025-01-31" });
      return null;
    }
  };
  const session = await request("NEE-public-session", "type=GetAccessToken", false);
  const token = session?.GetAccessTokenResult;
  if (typeof token === "string" && token.length && token !== "Invalid Request") {
    headers.Token = token;
    const configuration = await request("NEE-public-lookup-configuration", "type=getconfiguration", true);
    if (configuration) await request("NEE-primary-date-quote",
      "type=getlookupdata&lookupdate=2025-01-31&matchlookupdate=true&ControlName=table&YearToShow=5", true);
  }
}
const shares = JSON.parse(readFileSync("generated-artifacts/company-operating-corpus/primary-filings/share-review/report.json", "utf8"));
const report = { capturedAt: new Date().toISOString(), receipts,
  primaryShareDates: primaryDatedQuoteTargets(shares.observations),
  exactDateSourceAssessment: [
    { symbol: "FSLR", cik: "0001274494", requestedQuoteDate: "2025-02-21",
      issuerPage: "HTTP403: no dated quote content returned",
      fmpHistoricalAccess: "Not attempted: official documentation returned HTTP403; endpoint semantics could not be verified",
      match: false },
    { symbol: "NEE", cik: "0000753308", requestedQuoteDate: "2025-01-31",
      issuerPage: "HTTP200 public historical lookup and embedded workflow located",
      lookupAccess: "Public session request transport TypeError under redirect:error; HTTP status not observed. No access token retained; dated data request not attempted",
      match: false },
    { symbol: "XOM", cik: "0000034088", requestedQuoteDate: "2025-01-31",
      issuerPage: "HTTP200 issuer unadjusted history tool and public workflow located",
      lookupAccess: "Tool authorization HTTP403; stopped, no history data request",
      match: false, automaticSuccessorJoin: false },
    { symbol: "XOM", cik: "0002115436", requestedQuoteDate: "2026-09-30",
      lookupAccess: "Not requested after same issuer history-tool authorization HTTP403; successor kept distinct",
      match: false, automaticPredecessorJoin: false },
  ],
  historicalCloseAccess: "Public site/static content granted on NEE/XOM; historical quote data not granted/observed. This is not an FMP historical entitlement denial",
  exactDateQuoteShareCandidates: 0,
  fmpRequests: 0, valuationRuns: 0, approvals: 0 };
writeFileSync(`${root}/discovery-report.json`, JSON.stringify(report, null, 2) + "\n");
const publicReceipts = receipts.map(publicSourceReceipt);
writeFileSync(`${root}/public-receipts.json`, JSON.stringify(publicReceipts, null, 2) + "\n");
console.log(JSON.stringify({ receipts: publicReceipts, fmpRequests: 0 }));
