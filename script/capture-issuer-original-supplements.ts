import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

// Seven bounded free public SEC requests maximum; no provider SDK or collector.
if (process.env.NODE_ENV === "production") throw new Error("Private primary-source capture only");
const funding = process.argv.includes("--funding");
const root = `generated-artifacts/company-operating-corpus/issuer-original-v3/${funding ? "funding-sources" : "supplements"}`;
if (existsSync(`${root}/receipts.json`)) throw new Error("Supplement capture already retained; do not repeat");
mkdirSync(root, { recursive: true });
const targets = funding ? [
  { symbol: "XOM", base: "https://corporate.exxonmobil.com/news/news-releases/2024/",
    document: "1211_exxonmobil-announces-2030-corporate-plan", limit: 0,
    sought: "Primary 2030 corporate-plan replacement/growth spending and lower-emission economics; no tariff inferred" },
  { symbol: "NEE", base: "https://www.investor.nexteraenergy.com/",
    document: "financial-information/quarterly-results", limit: 1,
    sought: "Dated FY2024 presentation link for non-common cash and project return/funding evidence" },
] : [
  { symbol: "FSLR", base: "https://www.sec.gov/Archives/edgar/data/1274494/000127449425000009/",
    document: "fslr-20250225.htm", limit: 1, sought: "FY2024 termination normalization, 2025 capital/credit guidance and financing" },
  { symbol: "NEE", base: "https://www.sec.gov/Archives/edgar/data/753308/000075330825000003/",
    document: "nee-20250124.htm", limit: 2, sought: "NEE consolidated growth/capital funding, NEER project return and non-common cash allocation" },
  { symbol: "XOM", base: "https://www.sec.gov/Archives/edgar/data/34088/000003408825000006/",
    document: "xom-20250131.htm", limit: 1, sought: "Issuer-wide 2025-2030 capital/replacement funding, LCS/CCS costs, returns and tariff" },
];
const receipts: object[] = [];
let requests = 0;
async function capture(symbol: string, url: string, suffix: string) {
  if (++requests > 7) throw new Error("Public primary request budget exceeded");
  const startedAt = new Date().toISOString();
  try {
    const r = await fetch(url, { headers: { "User-Agent": "CompanyEvidenceReview/1.0 evidence@example.com" },
      signal: AbortSignal.timeout(30000), redirect: "error" });
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > 8e6) throw new Error("Bounded primary source size exceeded");
    const path = `${root}/${symbol}-${suffix}${r.headers.get("content-type")?.includes("pdf") ? ".pdf" : ".html"}`;
    writeFileSync(path, bytes, { flag: "wx" });
    receipts.push({ symbol, url, path, startedAt, capturedAt: new Date().toISOString(),
      httpStatus: r.status, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") });
    return r.ok ? bytes.toString("utf8") : null;
  } catch (error) {
    receipts.push({ symbol, url, startedAt, capturedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Primary attempt failed" });
    return null;
  }
}
async function main() {
  for (const t of targets) {
    const html = await capture(t.symbol, `${t.base}${t.document}`, "8k");
    if (!html) continue;
    const anchors = Array.from(html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi))
      .filter(m => funding ? /2024/i.test(m[1]) && /q4|fourth|4q/i.test(m[1]) && /presentation|slides/i.test(m[1] + m[2]) :
        /99[.\-_ ]?[12]|press release|presentation|news release/i.test(m[1] + " " + m[2]))
      .map(m => new URL(m[1], t.base).href)
      .filter(u => (funding ? /^https:\/\/(?:www\.investor\.nexteraenergy\.com|www\.nexteraenergy\.com)\//.test(u) :
        u.startsWith(t.base)) && !u.includes("#"));
    for (const [i, url] of [...new Set(anchors)].slice(0, t.limit).entries())
      await capture(t.symbol, url, `exhibit-${i + 1}`);
  }
  writeFileSync(`${root}/receipts.json`, JSON.stringify({ requestedAt: new Date().toISOString(),
    maximumRequests: 7, requests, targets, receipts }, null, 2) + "\n", { flag: "wx" });
  console.log(JSON.stringify({ requests, receipts: receipts.map((r: any) =>
    ({ symbol: r.symbol, url: r.url, path: r.path, status: r.httpStatus ?? r.error })) }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
