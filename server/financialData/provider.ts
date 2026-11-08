/** Fixed provider hosts/endpoints only; never forward arbitrary public URLs. */
const FMP_ENDPOINTS = new Set(["quote", "profile", "income-statement", "search-isin",
  "cash-flow-statement", "balance-sheet-statement"]);
export async function fmpRequest(endpoint: string, params: Record<string, string>) {
  if (!FMP_ENDPOINTS.has(endpoint)) throw new Error("Unsupported FMP endpoint");
  const key = process.env.FMP_API_KEY;
  if (!key) throw new Error("FMP credential is not configured");
  const url = new URL(`https://financialmodelingprep.com/stable/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  url.searchParams.set("apikey", key);
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: "error" });
  } catch {
    // Never propagate fetch errors containing credential-bearing request URLs.
    throw new Error("FMP request failed or timed out");
  }
  if (!response.ok) throw new Error(`FMP HTTP ${response.status}`);
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error("FMP returned invalid JSON"); }
  if (!Array.isArray(data)) throw new Error("FMP returned an unexpected response");
  return data as Record<string, unknown>[];
}

export async function figiRequest(isins: string[]) {
  if (!isins.length || isins.length > 10 || isins.some(x => !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(x))) {
    throw new Error("OpenFIGI accepts 1–10 valid ISIN jobs per request");
  }
  let response: Response;
  try {
    response = await fetch("https://api.openfigi.com/v3/mapping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isins.map(idValue => ({
        idType: "ID_ISIN", idValue, marketSecDes: "Equity", includeUnlistedEquities: true,
      }))),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    });
  } catch { throw new Error("OpenFIGI request failed or timed out"); }
  if (!response.ok) throw new Error(`OpenFIGI HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length !== isins.length) throw new Error("OpenFIGI returned an unexpected response");
  return data as Array<{ data?: FigiCandidate[]; warning?: string; error?: string }>;
}

export interface FigiCandidate {
  figi: string;
  ticker?: string;
  exchCode?: string;
  marketSector?: string;
  securityType?: string;
  shareClassFIGI?: string;
  compositeFIGI?: string;
}

export interface Profile {
  symbol: string;
  isin: string;
  currency: string;
  exchange: string;
  isAdr?: boolean;
  isActivelyTrading?: boolean;
}

// Conservative reviewed mapping. Unsupported exchanges stay unresolved.
const EXCHANGE_CODES: Record<string, string[]> = {
  NASDAQ: ["US", "UW", "UQ"], NYSE: ["US", "UN"], AMEX: ["US", "UA"],
  LSE: ["LN"], TSX: ["CN", "CT"], XETRA: ["GY", "GR"], EURONEXT: ["FP", "NA", "BB"],
};

/** Candidate evidence, not an automatic issuer or primary-listing selection. */
export function assessMapping(isin: string, profiles: Profile[], figis: FigiCandidate[]) {
  const candidates = profiles.flatMap(profile => {
    if (profile.isin !== isin || !profile.symbol || !profile.currency || !profile.exchange ||
        profile.isActivelyTrading === false || profile.isAdr) return [];
    const codes = EXCHANGE_CODES[profile.exchange.toUpperCase()];
    if (!codes) return [];
    const baseTicker = profile.symbol.split(".")[0].toUpperCase();
    const matches = figis.filter(f => f.marketSector === "Equity" &&
      f.ticker?.toUpperCase() === baseTicker && codes.includes(f.exchCode ?? "") && f.shareClassFIGI);
    const classes = Array.from(new Set(matches.map(f => f.shareClassFIGI)));
    if (classes.length !== 1) return [];
    return [{
      symbol: profile.symbol, currency: profile.currency, exchange: profile.exchange,
      shareClassFIGI: classes[0]!, figis: matches.map(f => f.figi),
      compositeFIGIs: Array.from(new Set(matches.map(f => f.compositeFIGI).filter(Boolean))),
    }];
  });
  const unique = Array.from(new Map(candidates.map(c => [c.symbol, c])).values());
  return {
    isin,
    status: unique.length === 1 ? "candidate-needs-issuer-review" :
      unique.length > 1 ? "ambiguous" : "unmatched",
    candidates: unique,
    accepted: false,
    reason: "Issuer relationship, listing preference and market-cap scope require review; no automatic merges.",
  };
}
