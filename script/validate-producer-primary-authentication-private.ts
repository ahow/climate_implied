import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { producerPrimaryAuthentication as auth, isExactProducerPrimaryAuthentication } from "../server/calculation/producerPrimaryAuthentication";
import { producerReserveFacts as facts, producerReserveSource as source } from "../server/calculation/producerReserveEvidence";

if (process.env.NODE_ENV === "production" || !process.argv.includes("--private-primary"))
  throw new Error("Explicit --private-primary required; actual retained sources mandatory; no production/CI fixture fallback");
const root = "generated-artifacts/producer-primary-authentication";
const corpus = "generated-artifacts/company-operating-corpus";
const sha = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const read = (path: string) => readFileSync(path);
const json = (path: string) => JSON.parse(read(path).toString("utf8"));
const receiptBytes = read(`${root}/receipt.json`);
assert.equal(sha(receiptBytes), "d371e8b77246d6d2c18eef5008514f75060f49845a3782dc0895d473c88c76c8");
const receipt = JSON.parse(receiptBytes.toString("utf8"));
const doc = json("docs/producer-primary-authentication-evidence.json");
assert.equal(doc.reviewReceipt.path, `${root}/receipt.json`);
assert.equal(doc.reviewReceipt.sha256, sha(receiptBytes));
assert.ok(isExactProducerPrimaryAuthentication(auth));
assert.ok(isExactProducerPrimaryAuthentication(JSON.parse(JSON.stringify(auth))));
assert.equal(isExactProducerPrimaryAuthentication({ ...auth, privatePath: root }), false);
assert.equal(isExactProducerPrimaryAuthentication({ ...auth, comparedRows: 39 }), false);

// All paths are fixed here, never taken from an untrusted supplied receipt.
const submissionsPath = `${corpus}/next-company-evidence/XOM-submissions-response.txt`;
const submissionsBytes = read(submissionsPath);
assert.equal(sha(submissionsBytes), auth.hashes.secSubmissionsSha256);
const submissions = JSON.parse(submissionsBytes.toString("utf8"));
const publicationReceipt = json(`${corpus}/next-company-evidence/publication-attempts.json`)
  .find((r: any) => r.symbol === "XOM");
assert.deepEqual(publicationReceipt, receipt.priorPublicationReceipt);
assert.equal(publicationReceipt.path, submissionsPath);
assert.equal(publicationReceipt.httpStatus, 200);
assert.equal(publicationReceipt.sha256, sha(submissionsBytes));
assert.equal(submissions.cik, auth.cik);
const recent = submissions.filings.recent;
const index = recent.accessionNumber.indexOf(auth.accessionNumber);
assert.ok(index >= 0);
const filing = Object.fromEntries(["accessionNumber", "filingDate", "reportDate", "acceptanceDateTime",
  "form", "primaryDocument"].map(k => [k, recent[k][index]]));
assert.deepEqual(filing, receipt.filing);
assert.equal(filing.reportDate, auth.fiscalEnd);
assert.equal(filing.filingDate, auth.filingDate);
assert.equal(filing.form, auth.form);
assert.equal(filing.primaryDocument, "xom-20241231.htm");
assert.equal(Date.parse(String(filing.acceptanceDateTime)), Date.parse(auth.publishedAt));
assert.equal(auth.officialUrl, `https://www.sec.gov/Archives/edgar/data/${Number(auth.cik)}/${auth.accessionNumber.replaceAll("-", "")}/${filing.primaryDocument}`);
const freshPath = `${root}/direct-sec-response.html`;
const fresh = read(freshPath);
assert.equal(sha(fresh), auth.hashes.officialHtmlSha256);
assert.equal(fresh.length, 5981380);
const acquisition = json(`${root}/acquisition.json`);
assert.deepEqual(acquisition, receipt.acquisition);
assert.equal(acquisition.path, freshPath);
assert.equal(acquisition.httpStatus, auth.officialHttpStatus);
assert.equal(acquisition.sha256, sha(fresh));
assert.equal(acquisition.url, auth.officialUrl);
const priorPath = `${corpus}/issuer-cashflow-v1/XOM-primary.html`;
const prior = read(priorPath);
assert.equal(sha(prior), auth.hashes.priorOfficialHtmlSha256);
const priorReceipt = json(`${corpus}/issuer-cashflow-v1/primary-receipts.json`).find((r: any) => r.symbol === "XOM");
assert.deepEqual(priorReceipt, receipt.priorPrimaryReceipt);
assert.equal(priorReceipt.path, priorPath);
assert.equal(priorReceipt.httpStatus, 200);
assert.equal(priorReceipt.url, auth.officialUrl);
const withoutScripts = (s: string) => s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "");
const normalized = withoutScripts(fresh.toString("utf8"));
assert.equal(normalized, withoutScripts(prior.toString("utf8")));
assert.equal(sha(normalized), auth.hashes.officialHtmlWithoutScriptNoscriptSha256);
assert.equal(Buffer.byteLength(normalized), 5980900);
assert.equal(receipt.retainedAndCurrentSecMarkupComparison.sha256AfterRemoval, sha(normalized));

const pdf = read(`${corpus}/primary-filings/XOM-2024.pdf`);
const pdfTextBytes = read(`${corpus}/primary-filings/XOM-2024.txt`);
assert.equal(sha(pdf), source.pdfSha256);
assert.equal(sha(pdf), receipt.mirrorPdfSha256);
assert.equal(sha(pdfTextBytes), source.textSha256);
assert.equal(sha(pdfTextBytes), receipt.mirrorTextSha256);
const compact = (s: string) => s.replace(/\s+/g, " ").trim();
const textOf = (s: string) => compact(s.replace(/<\/(?:tr|div|table|td|th)>/gi, " ")
  .replace(/<[^>]*>/g, "")
  .replace(/&#x([0-9a-f]+);/gi, (_, v) => String.fromCodePoint(parseInt(v, 16)))
  .replace(/&#(\d+);/g, (_, v) => String.fromCodePoint(+v))
  .replace(/&amp;/g, "&").replace(/&nbsp;/g, " "));
const htmlText = textOf(fresh.toString("utf8")), pdfText = compact(pdfTextBytes.toString("utf8"));
const scoped = (text: string, start: string, end: string) => {
  const a = text.indexOf(start), b = text.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Missing/invalid scope ${start}`);
  return text.slice(a, b);
};
type Row = { table: string; label: string; comparedNumericCells: number; numericCellsSha256: string;
  producerValue?: number; producerValues?: number[]; matched: boolean };
const rows = receipt.rows as Row[];
assert.equal(rows.length, 38);
assert.equal(new Set(rows.map(r => `${r.table}/${r.label}`)).size, 38);
const specs: [string, string, string, readonly number[]][] = [
  ["reserves-p130", "Natural Gas and Oil-Equivalent Proved Reserves (continued)", "Attributable to noncontrolling interests", Object.values(facts.reserves)],
  ["standardized-p133", "As of December 31, 2024 Consolidated Subsidiaries Future cash inflows", "Equity Companies", Object.values(facts.standardized)],
  ["operations-p121", "2024 Consolidated Subsidiaries Sales to third parties", "Equity Companies", Object.values(facts.operations)],
  ["costs-incurred-p124", "Property acquisition costs – Proved 39,271", "Equity Companies", Object.values(facts.costsIncurred)],
  ["prices-p12", "2024 Consolidated Subsidiaries Average production prices", "Average production costs, per oil-equivalent barrel", [76.57, 24.32, 3.13, 54.02, 74.16]],
];
let checkedRows = 0, checkedCells = 0, checkedFacts = 0;
const numberOf = (s: string) => s === "—" ? 0 : Number(s.replaceAll(",", "").replace("(", "-").replace(")", ""));
function checkCells(row: Row, actual: string[], mirrored: string[], expected: readonly number[], production = false) {
  assert.equal(row.matched, true);
  assert.deepEqual(actual, mirrored, `Source cells differ: ${row.table}/${row.label}`);
  assert.equal(actual.length, row.comparedNumericCells);
  assert.equal(sha(JSON.stringify(actual)), row.numericCellsSha256);
  const selected = production ? actual.slice(0, expected.length).map(numberOf) : [numberOf(actual.at(-1)!)];
  assert.deepEqual(selected, [...expected]);
  assert.deepEqual(production ? row.producerValues : [row.producerValue], selected);
  checkedRows++; checkedCells += actual.length; checkedFacts += selected.length;
}
for (const [table, start, end, expected] of specs) {
  const selectedRows = rows.filter(r => r.table === table);
  assert.equal(selectedRows.length, expected.length);
  const a = scoped(htmlText, start, end), b = scoped(pdfText, start, end);
  selectedRows.forEach((row, i) => {
    const cells = (s: string) => {
      const from = s.indexOf(row.label);
      assert.ok(from >= 0);
      assert.equal(s.indexOf(row.label, from + row.label.length), -1);
      const to = i + 1 < selectedRows.length ? s.indexOf(selectedRows[i + 1].label, from + row.label.length) : s.length;
      assert.ok(to > from);
      return s.slice(from + row.label.length, to).match(/\(?-?\d[\d,]*(?:\.\d+)?\)?|—/g) ?? [];
    };
    checkCells(row, cells(a), cells(b), [expected[i]]);
  });
}
const productionA = scoped(htmlText, "A. Oil and Gas Production", "B. Production Prices and Production Costs");
const productionB = scoped(pdfText, "A. Oil and Gas Production", "B. Production Prices and Production Costs");
const productionSpecs: [string, RegExp, number[]][] = [
  ["crude-and-ngl", /Total Consolidated Subsidiaries ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+) ([\d,]+)/, [facts.commodity[0].dailyVolume, facts.commodity[1].dailyVolume]],
  ["bitumen", /Bitumen production Consolidated Subsidiaries Canada\/Other Americas ([\d,]+) ([\d,]+) ([\d,]+)/, [facts.commodity[2].dailyVolume]],
  ["synthetic", /Synthetic oil production Consolidated Subsidiaries Canada\/Other Americas ([\d,]+) ([\d,]+) ([\d,]+)/, [facts.commodity[3].dailyVolume]],
  ["gas", /Total Consolidated Subsidiaries ([\d,]+) ([\d,]+) ([\d,]+) Equity Companies United States 18/, [facts.commodity[4].dailyVolume]],
];
for (const [label, pattern, expected] of productionSpecs) {
  const row = rows.find(r => r.table === "production-p11" && r.label === label);
  assert.ok(row);
  const a = productionA.match(pattern), b = productionB.match(pattern);
  assert.ok(a && b);
  checkCells(row, a.slice(1), b.slice(1), expected, true);
}
for (const [key, value] of Object.entries({ comparedRows: checkedRows, comparedNumericCells: checkedCells,
  producerNumericFactsCompared: checkedFacts })) assert.equal(receipt[key], value);
assert.equal(checkedRows, auth.comparedRows);
assert.equal(checkedCells, auth.comparedNumericCells);
assert.equal(checkedFacts, auth.producerNumericFactsMatched);
assert.equal(receipt.allComparisonsPassed, true);
assert.equal(receipt.pdfByteIdenticalToOfficialPdfEstablished, false);
assert.equal(receipt.ownerApproved, false);
assert.equal(receipt.wholeEquityAccepted, false);
assert.equal(doc.actualTableComparisons.totalComparedRows, checkedRows);
assert.equal(doc.actualTableComparisons.totalComparedNumericCells, checkedCells);
assert.equal(doc.actualTableComparisons.totalProducerNumericFactsMatched, checkedFacts);
console.log(JSON.stringify({ status: "passed", privateActualSourceValidation: true,
  comparedRows: checkedRows, comparedNumericCells: checkedCells, producerNumericFactsMatched: checkedFacts,
  sourceHashesVerified: true, secAcceptanceVerified: true, newNetworkRequests: 0,
  originalFreezeUnchanged: true, ownerApproved: false, wholeEquityAccepted: false }));
