/**
 * Bounded, unauthenticated primary-source requests. No alternate-host retries,
 * extraction bypass, credentials, paid services, or raw document republication.
 * Usage: node script/regional-diffusion-primary-attempts.mjs
 */
import { createHash } from "node:crypto";

const plan = [
  ["solar-futures", "https://www.energy.gov/eere/solar/solar-futures-study", "regional solar generation-share saturation versus modelled scenario"],
  ["wind-vision", "https://www.energy.gov/eere/wind/wind-vision", "regional wind generation-share saturation versus modelled scenario"],
  ["fslr-quarterly", "https://investor.firstsolar.com/financials/quarterly-results/default.aspx", "new prepared remarks: US eligible watts, credit cash collection, component BOM/current law"],
  ["nee-presentations", "https://www.investor.nexteraenergy.com/news-and-events/presentations", "commissioning dates, gross recipient legal entity, priority, incremental project returns"],
  ["xom-ccs", "https://lowcarbon.exxonmobil.com/what-we-do/carbon-capture-and-storage", "executed fee, novation, billing, opex and funding rather than announced tonnes"],
];
const supplementalPlan = [
  ["wind-vision-full-report", "https://www.energy.gov/cmei/systems/wind-vision", "Linked primary report; distinguish modelled generation shares from identified saturation"],
  ["irs-45x", "https://www.irs.gov/credits-deductions/advanced-manufacturing-production-credit", "FSLR current-law credit cash route, eligible component boundaries; not issuer watts/BOM/receipt"],
  ["irs-45q", "https://www.irs.gov/credits-deductions/credit-for-carbon-oxide-sequestration", "XOM current-law funding scope, not executed fee, novation, billing or operating costs"],
];
const sha = value => createHash("sha256").update(value).digest("hex");
export async function request(id, url, purpose) {
  const requestedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(45000), redirect: "follow",
      headers: { "User-Agent": "RegionalDiffusionSourceResearch/1.0 (public research; no authentication)" } });
    const reader = response.body.getReader();
    const parts = [];
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
      if (bytes > 12_000_000) { await reader.cancel(); throw new Error("Response exceeds 12MB source bound"); }
      parts.push(Buffer.from(value));
    }
    const raw = Buffer.concat(parts);
    const html = raw.toString("utf8");
    const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
      ?? html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html;
    const text = article.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .map(m => { try { return { url: new URL(m[1], response.url).href,
        label: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140) }; } catch { return null; } })
      .filter(Boolean)
      .filter(link => /prepared|remarks|2026|2025|transcript|10-q|10-k|futures|vision|report|financial|presentation/i.test(link.label + " " + link.url));
    const snippets = [];
    const pattern = /\bsaturation\b|40%|45%|35%|\bgeneration\b|\beligible\b|\bwatts\b|bill of material|cash recei|\bfee\b|\bnovation\b|\bcommission|\breturn on\b|\bfunding\b|operating cost/gi;
    let match;
    while ((match = pattern.exec(text)) && snippets.length < 4) {
      const snippet = text.slice(Math.max(0, match.index - 50), match.index + 130);
      if (!snippets.some(s => s.includes(match[0]) && s === snippet)) snippets.push(snippet);
      pattern.lastIndex = match.index + 130;
    }
    return { id, url, finalUrl: response.url, purpose, requestedAt, receiptAt: new Date().toISOString(),
      status: response.status, contentType: response.headers.get("content-type"), bytes,
      rawSha256: sha(raw), textSha256: sha(text), publicationDate: null,
      publicationRule: "HTTP Date/retrieval/hash is not publication; inspect explicit publisher date before admitting facts",
      rights: "Public primary page, no open licence presumed; only minimal attributed excerpts/links/hash, not full page retained",
      snippets: response.ok ? snippets : [], links: response.ok ? links.slice(0, 60) : [],
      result: response.ok ? "Retrieved; source compatibility and financial scope require explicit adjudication" : "Denied/unavailable; no content admitted, no retry" };
  } catch (error) {
    return { id, url, purpose, requestedAt, error: String(error), status: null,
      publicationDate: null, rawSha256: null, result: "Explicit acquisition failure, no retry or alternate source" };
  }
}
if (process.argv[1]?.endsWith("regional-diffusion-primary-attempts.mjs")) {
  const receipts = [];
  const selected = process.argv.includes("--supplemental") ? supplementalPlan : plan;
  for (const args of selected) receipts.push(await request(...args));
  console.log(JSON.stringify({ maximumRequests: selected.length, actualRequests: receipts.length, receipts }, null, 2));
}
