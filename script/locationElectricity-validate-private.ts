/** Mandatory private gate: missing SEC/EIA/freeze/evidence bytes fail, never skip.
 * Public source-only tests intentionally do not import this file. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { buildPublicLocationElectricityReport } from "../server/calculation/locationElectricityPublicReport";

const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const report = buildPublicLocationElectricityReport();
const evidencePath = "docs/locationElectricity-source-evidence.json";
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const pricePath = "generated-artifacts/locationElectricity/ohio-eia-2024.xlsx";
const filingPath = "generated-artifacts/company-operating-corpus/issuer-cashflow-v1/FSLR-primary.html";
const priceReceiptPath = "generated-artifacts/locationElectricity/primary-price-receipt.json";
const priceReceipt = JSON.parse(readFileSync(priceReceiptPath, "utf8"));
const filingReceiptPath = "generated-artifacts/company-operating-corpus/issuer-cashflow-v1/primary-receipts.json";
const filingReceipt = JSON.parse(readFileSync(filingReceiptPath, "utf8"))
  .find((r: { symbol: string }) => r.symbol === "FSLR");
assert.equal(hash("docs/locationElectricity-domain-freeze.json"), report.freeze.sha256);
assert.equal(evidence.freeze.sha256, report.freeze.sha256);
assert.deepEqual(evidence.counts, report.counts);
assert.equal(evidence.cutoff, report.cutoff);
assert.equal(hash(pricePath), priceReceipt.sha256);
assert.equal(hash(filingPath), filingReceipt.sha256);
const filing = readFileSync(filingPath, "utf8").replace(/<[^>]+>/g, " ")
  .replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ");
const propertyStart = filing.indexOf("Nature Location Held Corporate headquarters");
assert.ok(propertyStart >= 0);
const properties = filing.slice(propertyStart, propertyStart + 1800);
assert.ok(properties.includes("Manufacturing plant currently under construction; operations are expected to commence in the second half of 2025."));
for (const [i, site] of report.sourceFacts.operatingLocations.entries()) {
  assert.ok(properties.includes(site.location), `Missing authentic SEC property ${site.location}`);
  assert.equal(site.source.sha256, filingReceipt.sha256);
  assert.equal(site.source.url, filingReceipt.url);
  assert.equal(site.source.observedAt, filingReceipt.capturedAt);
  assert.equal(site.source.availableAt, filingReceipt.availableAt);
  assert.equal(site.location, evidence.sourceFacts.locations[i].location);
  assert.equal(site.operatingStatus, evidence.sourceFacts.locations[i].operatingStatus);
  assert.equal(site.purchasedElectricityMWh, null);
  assert.equal(site.tariffEligibility, null);
}
const worksheet = XLSX.read(readFileSync(pricePath), { type: "buffer" }).Sheets["8. Sales"];
assert.equal(worksheet.A2.v, "Ohio");
assert.equal(worksheet.A28.v, "Industrial");
assert.equal(worksheet.A25.v, "Average price to ultimate customers (cents/kWh)");
for (const [i, price] of report.sourceFacts.contextualElectricityPrices.entries()) {
  const col = "BCDEF"[i];
  assert.equal(String(worksheet[`${col}3`].v).replace(/\s/g, ""), `Year${price.year}`);
  assert.equal(price.reportedValue, worksheet[`${col}28`].v);
  assert.equal(price.nominalMajorCurrencyPerMWh, price.reportedValue * 10);
  assert.equal(price.reportedValue, evidence.sourceFacts.electricityPriceRecords[i].reportedValue);
  assert.equal(price.source.sha256, priceReceipt.sha256);
  assert.equal(price.source.url, priceReceipt.url);
  assert.equal(price.source.observedAt, priceReceipt.observedAt);
  assert.equal(price.source.availableAt, null);
  assert.equal(price.applicableToNamedIssuerSite, false);
  assert.equal(price.issuerTariff, false);
}
assert.equal(report.actualIssuerResult, null);
assert.equal(report.sourceQualifiedIssuerExecution, false);
assert.equal(report.sourceApproval, false);
const receipt = {
  command: "npx tsx script/locationElectricity-validate-private.ts",
  executedAt: new Date().toISOString(), status: "pass",
  counts: report.counts, assertions: "mandatory SEC/EIA bytes, receipt hashes/timing, exact public property/price transcription, units/year, freeze, explicit tariff refusal/null issuer result",
  hashes: { sec: hash(filingPath), eia: hash(pricePath), evidence: hash(evidencePath),
    eiaReceipt: hash(priceReceiptPath), secReceipts: hash(filingReceiptPath), freeze: report.freeze.sha256 },
  boundary: "Source transcription verification only; zero source-qualified issuer cash bridge executions and no owner/scientific approval.",
};
mkdirSync("generated-artifacts/locationElectricity", { recursive: true });
writeFileSync("generated-artifacts/locationElectricity/private-source-validation.json", JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
