import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractSuccessorReportingNotice, extractSuccessorSubsidiaryInventory, inspectFirstPostMergerQuarter } from "../server/calculation/enlinkOperatingSuccessorEvidence";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private source adapter execution only");
const dir = "generated-artifacts/company-operating-corpus/enlink-operating-successor-v1";
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p)), hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
if (existsSync(`${dir}/source-sealed.json`)) throw new Error("Frozen source unit already executed; use separate private validator, no rerun");
const book = json(`${dir}/receipts.json`);
assert.equal(book.attempts.length, 4); assert.equal(new Set(book.attempts.map((p: any) => p.url)).size, 4);
for (const p of book.attempts) { assert.equal(p.status, 200); assert.equal(hash(p.path), p.sha256); }
const previous = json("generated-artifacts/company-operating-corpus/cf-enlink-current-cash-v1/latest.json");
assert.equal(hash(previous.freezePath), previous.freezeSha256); assert.equal(hash(previous.reportPath), previous.reportSha256);
const code = ["server/calculation/enlinkOperatingSuccessorEvidence.ts", "script/capture-enlink-operating-successor.ts", "script/enlink-operating-successor.test.ts", "script/run-enlink-operating-successor.ts"].map(path => ({ path, sha256: hash(path) }));
const preserve = [previous.freezePath, previous.reportPath, "docs/cf-enlink-current-cash-evidence.json", "shared/companyConditionalData.ts", "script/company-conditional-api.test.ts"].map(path => ({ path, sha256: hash(path) }));
const version = "enlink-operating-successor-1", out = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-")}`;
mkdirSync(out); const freezePath = `${out}/frozen-before-adapter.json`, reportPath = `${out}/report.json`;
writeFileSync(freezePath, JSON.stringify({ version, code, preserve, primary: book.attempts,
  protocol: "Human source reconnaissance preceded adapterfreeze. No economic scoring. Extract dated group entities/Form15/reporting status; inspect ONLYnewfirstpostmergerquarter EX10/contract/settlement text. Corporate succession/listing/guarantees never certify operatingparty/novation/cash. Unexpected namedCCS terms refuse for manual review. Fourrequeststop; no grids or oldkernel execution.",
  futureEconomicAssumptions: [], originalCaseQualification: 0 }, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${dir}/source-sealed.json`, JSON.stringify({ version, requests: 4, receiptsSha256: hash(`${dir}/receipts.json`), freezeSha256: hash(freezePath) }, null, 2) + "\n", { flag: "wx" });
const source = (name: string) => read(book.attempts.find((p: any) => p.name === name).path);
const meta = JSON.parse(source("emlp-submissions.json")); assert.equal(meta.cik, "0001179060"); assert.equal(meta.name, "EnLink Midstream Partners, LP");
const annualOrInterimSince2021 = meta.filings.recent.form.filter((form: string, i: number) => ["10-K", "10-Q"].includes(form) && meta.filings.recent.filingDate[i] >= "2021-01-01").length;
const report = { version, group: extractSuccessorSubsidiaryInventory(source("oneok-fy2025-ex21.html")),
  notice: extractSuccessorReportingNotice(source("emlp-reporting-suspension-20250210.html")),
  quarter: inspectFirstPostMergerQuarter(source("oneok-first-postmerger-2025q1.html")),
  discovery: { entity: meta.name, cik: meta.cik, annualOrInterimSince2021InCurrentRecentIndex: annualOrInterimSince2021,
    historicalArchiveCoverage: meta.filings.files, currentContractStatusCertified: false },
  cashBridge: { newlyQualified: false, billingUsd: null, paymentUsd: null, fundingUsd: null, opexUsd: null, replacementCapexUsd: null,
    actualAppliedCashChangeUsd: 0, qualifiedOriginalIssuers: 0, economicCalculationsExecuted: 0, oldKernelsOrGridsRerun: 0,
    why: "Newsource closes groupentity/reportingscope, not actualoperatingCCScontract/payment economics. Stopboundedsearch rather than monetizing guarantees, recognition or unallocatedtail." } };
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${dir}/latest.json`, JSON.stringify({ freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) }, null, 2) + "\n");
console.log(JSON.stringify({ version, ...JSON.parse(read(`${dir}/latest.json`)), group: report.group, notice: report.notice, cashBridge: report.cashBridge }));
