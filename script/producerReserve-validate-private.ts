import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { producerReserveSource as source, producerReserveFacts as facts } from "../server/calculation/producerReserveEvidence";

const root = "generated-artifacts/company-operating-corpus/primary-filings";
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const pdf = readFileSync(`${root}/XOM-2024.pdf`), text = readFileSync(`${root}/XOM-2024.txt`, "utf8");
let checks = 0;
function check(ok: boolean, message: string) { checks++; if (!ok) throw new Error(message); }
check(sha(pdf) === source.pdfSha256, "Private primary PDF bytes differ");
check(sha(text) === source.textSha256, "Private extracted text differs");
const retained = JSON.parse(readFileSync(`${root}/readiness-report.json`, "utf8")).cases.find((c: any) => c.facts.symbol === "XOM");
check(retained.facts.cik === "0000034088" && retained.facts.documentDate === source.documentDate &&
  retained.facts.observedAt === source.retainedAt && retained.facts.sourceUrl === source.url,
  "Entity/date/retention lineage mismatch");
function between(start: string, end: string) {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  check(a >= 0 && b > a, `Missing scoped section ${start}`);
  return text.slice(a, b);
}
function last(section: string, label: string, expected: number) {
  const rows = section.split("\n").filter(line => line.trimStart().startsWith(label));
  check(rows.length === 1, `Ambiguous/missing scoped row ${label}`);
  const tokens = rows[0].trim().split(/\s+/);
  const raw = tokens[tokens.length - 1];
  const parsed = raw === "—" ? 0 : Number(raw.replace(/,/g, "").replace("(", "-").replace(")", ""));
  check(parsed === expected, `Wrong value ${label}: ${parsed}, expected ${expected}`);
}
const reserves = between("Natural Gas and Oil-Equivalent Proved Reserves (continued)",
  "Proportional interest in proved reserves");
for (const [label, expected] of [
  ["January 1, 2024", facts.reserves.opening], ["Revisions", facts.reserves.revisions],
  ["Improved recovery", facts.reserves.improvedRecovery], ["Purchases", facts.reserves.purchases],
  ["Sales", facts.reserves.sales], ["Extensions/discoveries", facts.reserves.extensionsDiscoveries],
  ["Production", facts.reserves.production], ["December 31, 2024", facts.reserves.closing],
] as [string, number][]) last(reserves, label, expected);
const standardized = between("As of December 31, 2024\nConsolidated Subsidiaries\n  Future cash inflows", "Equity Companies\n  Future cash inflows");
for (const [label, expected] of [
  ["Future cash inflows", facts.standardized.revenue], ["Future production costs", facts.standardized.productionCosts],
  ["Future development costs", facts.standardized.development], ["Future income tax expenses", facts.standardized.incomeTaxes],
  ["Future net cash flows", facts.standardized.netCash], ["Effect of discounting", facts.standardized.discountEffect],
  ["Discounted future net cash flows", facts.standardized.pv10],
] as [string, number][]) last(standardized, label, expected);
const operations = between(" 2024\n Consolidated Subsidiaries\n  Sales to third parties", " Equity Companies\n  Sales to third parties");
for (const [label, key] of [
  ["Sales to third parties", "thirdParty"], ["Transfers", "transfers"], ["Revenue", "revenue"],
  ["Production costs excluding taxes", "productionCosts"], ["Exploration expenses", "exploration"],
  ["Depreciation and depletion", "depreciationDepletion"], ["Taxes other than income", "productionTaxes"],
  ["Related income tax", "incomeTaxes"], ["subsidiaries", "earnings"],
] as [string, keyof typeof facts.operations][]) last(operations, label, facts.operations[key]);
const costs = between("Property acquisition costs – Proved                        39,271", "Equity Companies\nProperty acquisition costs");
last(costs, "Property acquisition costs", facts.costsIncurred.provedAcquisitions);
last(costs, "– Unproved", facts.costsIncurred.unprovedAcquisitions);
last(costs, "Exploration costs", facts.costsIncurred.exploration);
last(costs, "Development costs", facts.costsIncurred.development);
last(costs, "Total costs incurred", facts.costsIncurred.total);
const production = between("3. Oil and Gas Production, Production Prices and Production Costs", "B. Production Prices and Production Costs");
check(/Total Consolidated Subsidiaries\s+1,858\s+423/.test(production), "Consolidated crude/NGL production mismatch");
check(/Canada\/Other Americas\s+374\s+355\s+327/.test(production), "Bitumen production mismatch");
check(/Canada\/Other Americas\s+62\s+67\s+63/.test(production), "Synthetic production mismatch");
check(/Total Consolidated Subsidiaries\s+5,438\s+4,902\s+5,268/.test(production), "Consolidated gas mismatch");
const prices = between("2024\nConsolidated Subsidiaries\nAverage production prices", "Equity Companies\nAverage production prices");
for (const [label, value] of [["Crude oil, per barrel", 76.57], ["NGL, per barrel", 24.32],
  ["Natural gas, per thousand cubic feet", 3.13], ["Bitumen, per barrel", 54.02], ["Synthetic oil, per barrel", 74.16]] as [string, number][])
  last(prices, label, value);
check(text.includes("Natural gas is converted to an oil-equivalent basis at six billion cubic feet per one million barrels."), "Reserve gas conversion missing");
check(text.includes("due\nto volumes consumed or flared."), "Production/reserve gas denominator caveat missing");
check(text.includes("standardized measure includes costs for future dismantlement, abandonment, and rehabilitation obligations."), "Abandonment cost inclusion missing");
check(text.includes("does not provide a reliable estimate of the Corporation’s expected future cash flows"), "Issuer standardized measure caution missing");
const receipt = { checkedAt: new Date().toISOString(), checks, passed: checks, failed: 0,
  privatePdfSha256: sha(pdf), privateTextSha256: sha(text),
  status: "transcription-and-byte-integrity-only",
  independentAuthenticityApproved: false, ownerApproved: false, scienceAccepted: false,
  remainingRequirements: ["Authenticate issuer original/public mirror and authorization independently",
    "Independently verify cash timing, fiscal assumptions, freeze sequence and uniqueness proof; no market/whole-equity acceptance"] };
mkdirSync("generated-artifacts/producer-reserve", { recursive: true });
writeFileSync("generated-artifacts/producer-reserve/private-source-validation.json", JSON.stringify(receipt, null, 2));
console.log(JSON.stringify(receipt, null, 2));
