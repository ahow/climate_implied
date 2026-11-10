import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { contentHash } from "../server/calculation/analysisManifest";
import { freezeFslrFullCashflowAssumptions, calculateFslrFrozenFullCashflow } from "../server/calculation/fslrFullCashflowCase";

if (process.env.NODE_ENV === "production") throw new Error("Private development calculation only");
const root = "generated-artifacts/company-operating-corpus";
const text = readFileSync(`${root}/FSLR-2025-results.md`, "utf8");
const earlier = JSON.parse(readFileSync(`${root}/FSLR-five-year-conditional-results.json`, "utf8"));
const sourceHash = contentHash(text);
if (earlier.provenance.sourceHash !== sourceHash) throw new Error("Retained primary source changed");
const locators = [
  ["Volume Sold", "17.0GW", "18.2GW"], ["Net Sales", "$4.9B", "$5.2B"],
  ["Gross Margin", "$2.4B", "$2.6B"], ["Operating Expenses", "$610M", "$635M"],
  ["Capital Expenditures", "$0.8B", "$1.0B"],
  ["Accounts receivable trade, net", "1,294,040", "1,261,049"],
  ["Inventories", "736,734", "1,084,384"], ["Inventories", "237,462", "275,372"],
  ["Net sales", "5,219,376", "4,206,289"], ["Property, plant and equipment, net", "5,675,794"],
  ["Income before taxes", "1,580,913"], ["Income tax expense", "52,684"],
  ["Current portion of debt", "215,979"], ["Long-term debt", "282,593"],
  ["Depreciation, amortization and accretion", "529,216"], ["Interest expense, net", "44,131"],
  ["Interest income", "81,762"], ["Foreign currency loss, net", "38,569"], ["Other expense, net", "15,013"],
  ["Net cash provided by operating activities", "2,057,105"],
  ["Purchases of property, plant and equipment", "869,875"],
  ["Proceeds from borrowings", "370,470"], ["Repayment of debt", "473,363"],
].map(tokens => {
  const line = text.split("\n").findIndex(l => tokens.every(t => l.includes(t)));
  if (line < 0) throw new Error(`Primary row not found: ${tokens.join(" / ")}`);
  return { tokens, line: line + 1 };
});
if (!text.includes("$2.10 billion to $2.19 billion")) throw new Error("Missing 45X guidance");
const policyRoot = `${root}/fslr-full-cashflow/policy-source`;
mkdirSync(policyRoot, { recursive: true });
const policyUrl = "https://www.govinfo.gov/content/pkg/FR-2024-10-28/pdf/2024-24840.pdf";
const policyPdf = `${policyRoot}/2024-24840.pdf`, policyTxt = `${policyRoot}/2024-24840.txt`;
execFileSync("curl", ["--fail", "--location", "--silent", "--show-error", "--max-time", "60", policyUrl, "-o", policyPdf]);
const policyCapturedAt = new Date().toISOString();
execFileSync("pdftotext", ["-layout", policyPdf, policyTxt]);
const policyText = readFileSync(policyTxt, "utf8");
for (const token of ["75 percent for eligible components", "50 percent for eligible components", "sold during calendar year 2030", "sold during calendar year 2031"])
  if (!policyText.includes(token)) throw new Error(`Missing primary phase-down row: ${token}`);
const policySourceHash = createHash("sha256").update(readFileSync(policyPdf)).digest("hex");
const frozenAt = new Date().toISOString();
const run = `${root}/fslr-full-cashflow/${frozenAt.replace(/[:.]/g, "-")}`;
mkdirSync(run, { recursive: true });
const frozen = freezeFslrFullCashflowAssumptions({
  sourceHash, sourceCapturedAt: earlier.provenance.observedAt,
  policySourceHash, policyCapturedAt, frozenAt,
  firstYear: Number(frozenAt.slice(0, 4)) + 1,
});
const freezePath = `${run}/assumptions-frozen-before-calculation.json`;
writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
const freezeBytes = readFileSync(freezePath);
const freezeReceipt = { path: freezePath, sha256: createHash("sha256").update(freezeBytes).digest("hex"),
  analyticalHash: contentHash(frozen), frozenAt, persistedBeforeCalculation: true,
  codeSources: ["server/calculation/companyFullCashflowCase.ts", "server/calculation/fslrFullCashflowCase.ts",
    "server/calculation/issuerConditionalFiveYear.ts"].map(path => ({
      path, sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
    })) };
writeFileSync(`${run}/freeze-receipt-before-calculation.json`, JSON.stringify(freezeReceipt, null, 2) + "\n", { flag: "wx" });
// Only now calculate, using the persisted snapshot rather than mutable options.
const result = calculateFslrFrozenFullCashflow(JSON.parse(freezeBytes.toString("utf8")));
const report = { ...result, freezeReceipt, calculatedAt: new Date().toISOString(),
  policySource: { url: policyUrl, pdf: policyPdf, text: policyTxt,
    sha256: policySourceHash, capturedAt: policyCapturedAt,
    locator: "26 CFR 1.45X-1(c)(1), phase-down percentages and calendar years",
    sourceStatus: "Primary final regulation, not independently updated legal opinion; solar eligibility/2025 amendments caveats remain explicit." },
  source: { path: `${root}/FSLR-2025-results.md`, sourceHash,
    url: earlier.source.url, publishedDate: "2026-02-24",
    originalCaptureAt: earlier.provenance.observedAt, reinspectedAt: frozenAt, locators },
  unchanged: ["Original FSLR experiment", "Original three-case criteria", "Gordon primary", "Completed beta", "Failed common-eight D8"] };
const reportPath = `${run}/report.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${run}/execution-receipt.json`, JSON.stringify({
  command: "npx tsx script/run-fslr-full-cashflow-case.ts", frozenAt,
  calculatedAt: report.calculatedAt, reportPath, freezeReceipt,
  cases: result.cashSchedulesExecuted, annualRows: result.annualRowsExecuted, exitCode: 0,
  correction: "v3 added primary statutory phase-down; v4 explicitly freezes all ten sensitivity parameter records and code receipts before calculation. Prior versions retained, not overwritten.",
}, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${root}/fslr-full-cashflow/latest.json`, JSON.stringify({ reportPath, freezePath }, null, 2) + "\n");
console.log(JSON.stringify({ reportPath, freezeReceipt, cashSchedules: result.cashSchedulesExecuted,
  annualRows: result.annualRowsExecuted, baseAndStress: result.cases.slice(0, 2).map(c => ({
    id: c.id, annualFcfe: c.ledger.years.map(y => y.fcfe),
    cumulativeFiveYearFcfe: c.cumulativeFiveYearFcfe, terminalStatus: c.ledger.terminalModelStatus })),
  actualWholeEquityPairs: 0, completeCases: "0/3" }));
