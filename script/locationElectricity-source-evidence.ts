import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import * as XLSX from "xlsx";

const hash = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const freezePath = "docs/locationElectricity-domain-freeze.json";
const freezeHash = "dfd45d53fb1ec53400d7e86b5b77201b9f997b02ef48c9f2d85c9c73e496c1a1";
if (hash(readFileSync(freezePath)) !== freezeHash) throw new Error("Pre-calculation domain freeze changed");
const archive = "generated-artifacts/locationElectricity";
mkdirSync(archive, { recursive: true });
const receiptPath = `${archive}/primary-price-receipt.json`;
const pricePath = `${archive}/ohio-eia-2024.xlsx`;
const priceUrl = "https://www.eia.gov/electricity/state/xls/SEP%20Tables%20for%20OH.xlsx";
if (process.argv.includes("--acquire")) {
  // Only this new dedicated archive is written. Old archives are never modified.
  try { readFileSync(receiptPath); throw new Error("Existing source receipt: reuse retained bytes, not overwrite"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  const startedAt = new Date().toISOString();
  const r = spawnSync("curl", ["--fail", "--location", "--max-time", "60",
    "--silent", "--show-error", "--output", pricePath, "--write-out", "%{http_code}", priceUrl],
  { encoding: "utf8" });
  if (r.status !== 0 || r.stdout.trim() !== "200")
    throw new Error(`Primary EIA retrieval failed: ${r.stdout} ${r.stderr}`);
  writeFileSync(receiptPath, JSON.stringify({ url: priceUrl, path: pricePath,
    sha256: hash(readFileSync(pricePath)), startedAt, observedAt: new Date().toISOString(),
    httpStatus: 200 }, null, 2) + "\n");
}
const receipt = JSON.parse(readFileSync(receiptPath, "utf8"));
if (receipt.url !== priceUrl || receipt.path !== pricePath ||
    hash(readFileSync(pricePath)) !== receipt.sha256) throw new Error("Primary price receipt hash mismatch");
const filingPath = "generated-artifacts/company-operating-corpus/issuer-cashflow-v1/FSLR-primary.html";
const filingReceipts = JSON.parse(readFileSync(
  "generated-artifacts/company-operating-corpus/issuer-cashflow-v1/primary-receipts.json", "utf8"));
const filingReceipt = filingReceipts.find((r: { symbol: string }) => r.symbol === "FSLR");
const filingBytes = readFileSync(filingPath);
if (hash(filingBytes) !== filingReceipt.sha256) throw new Error("Retained SEC filing hash mismatch");
const filingText = filingBytes.toString("utf8").replace(/<[^>]+>/g, " ")
  .replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ");
const siteNames = [
  "Perrysburg and Lake Township, Ohio, United States",
  "Kulim, Kedah, Malaysia",
  "Ho Chi Minh City, Vietnam",
  "Tamil Nadu, India",
  "Trinity, Alabama, United States",
  "Iberia Parish, Louisiana, United States",
];
const propertyStart = filingText.indexOf("Nature Location Held Corporate headquarters");
if (propertyStart < 0) throw new Error("SEC Item2 property table not found");
const properties = filingText.slice(propertyStart, propertyStart + 1800);
const construction = "Manufacturing plant currently under construction; operations are expected to commence in the second half of 2025.";
if (!properties.includes(construction)) throw new Error("Construction qualification absent");
const locations = siteNames.map((name, i) => {
  if (!properties.includes(name)) throw new Error(`Operating property not evidenced: ${name}`);
  return {
    companyId: "FSLR", location: name, periodEnd: "2024-12-31",
    operatingStatus: i === 5 ? "under-construction-not-operating-at-source-date" : "operating",
    locator: "FY2024 Form10-K Item2 Properties p45; Ohio combines manufacturing/R&D/offices",
    source: { path: filingPath, sha256: filingReceipt.sha256, url: filingReceipt.url,
      observedAt: filingReceipt.capturedAt, availableAt: filingReceipt.availableAt },
    purchasedElectricityMWh: null, supplier: null, tariffEligibility: null,
    customerRecoveryFraction: null, supplierPaymentFraction: null, customerCollectionFraction: null,
    issuerCashBridgeExecutable: false,
  };
});
const book = XLSX.read(readFileSync(pricePath), { type: "buffer" });
const sheet = book.Sheets["8. Sales"];
if (!sheet || sheet.A2.v !== "Ohio" || sheet.A28.v !== "Industrial" ||
    sheet.A25.v !== "Average price to ultimate customers (cents/kWh)")
  throw new Error("EIA workbook definition mismatch");
const prices = ["B", "C", "D", "E", "F"].map((column, i) => {
  const year = 2024 - i;
  if (String(sheet[`${column}3`].v).replace(/\s/g, "") !== `Year${year}`)
    throw new Error("EIA price delivery period mismatch");
  const value = sheet[`${column}28`].v;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Non-numeric primary price");
  return {
    jurisdiction: "US-OH", sector: "industrial", year, currency: "USD",
    reportedValue: value, reportedUnit: "US cents/kWh",
    nominalMajorCurrencyPerMWh: value * 10,
    conversion: "1 cent/kWh = 0.01 USD/kWh *1000 kWh/MWh =10 USD/MWh",
    kind: "regional-context-only", source: { ...receipt, locator: `8. Sales!${column}28; units A25; year ${column}3` },
    issuerTariff: false, applicableToNamedIssuerSite: false,
    use: "Context only. State industrial average cannot substitute for issuer electricity tariff or cash bill.",
  };
});
const report = {
  criterion: "S12-005", protocol: "location-electricity-cash-bridge-1",
  generatedAt: new Date().toISOString(), cutoff: receipt.observedAt,
  freeze: { path: freezePath, sha256: freezeHash, verifiedBeforeExtractionAndCalculation: true },
  sourceFacts: { locations, electricityPriceRecords: prices },
  assumptionValuesAssignedToIssuers: 0,
  counts: { evidencedPropertyRows: locations.length, operatingPropertyRows: 5,
    constructionPropertyRows: 1, regionalPriceRecords: prices.length,
    applicableIssuerTariffs: 0, siteConsumptionRecords: 0, customerRecoveryRecords: 0,
    sourceQualifiedIssuerCashBridgeExecutions: 0 },
  admissibility: "not-executable-issuer-bridge",
  exactGaps: [
    "No source-linked annual purchased MWh at each named operating site; GW module output/capacity and Scope2 tonnes are not purchased electricity.",
    "No issuer supplier/retailer, supply voltage, demand/time-of-use profile, tariff eligibility, hedging/PPA, fixed/demand charges or baseline/scenario electricity price bridge.",
    "EIA Ohio industrial averages are authentic contextual price records, not First Solar tariffs; foreign and Alabama prices are not supplied by this Ohio workbook.",
    "No issuer customer contract cost-recovery fraction, lag, collection or supplier-payment schedule. No pass-through defaults assigned.",
    "No same-period/currency FX support for foreign operations; no MYR/INR/VND to USD inference.",
    "Louisiana is under construction as of2024-12-31; expected2025 operation is not demonstrated current operation.",
    "Captured EIA workbook contains latest available historical revisions; no claim of availability at original2024 forecast origin.",
    "No source-qualified projection or current criterion self-approval. Parent must integrate optional component and verify the consuming cash ledger."
  ],
  integrationExports: [
    "server/calculation/locationElectricityCashBridge.ts:locationElectricityCashBridgeSchema",
    "server/calculation/locationElectricityCashBridge.ts:calculateLocationElectricityCashBridge"
  ],
  boundary: "Source facts only. No issuer assumptions, owner approval, valuation recommendation, public release, DDL, auth or billing changes.",
};
writeFileSync("docs/locationElectricity-source-evidence.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ counts: report.counts, evidenceSha256:
  hash(readFileSync("docs/locationElectricity-source-evidence.json")),
  filingSha256: filingReceipt.sha256, priceSha256: receipt.sha256, freezeHash }, null, 2));
