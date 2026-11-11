import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractNewNeeCashQuarter, reconcileNewNeeCashQuarter, inspectNewFslrRelease, reconcileNewCfCounterpartyCash, extractHistoricalXomMvcFees, reconcileHistoricalXomMvcFees } from "../server/calculation/issuerCashSourceQuarterFollowup";
import { embeddedSecJpegs, sourceExhibit } from "../server/calculation/issuerSourceExhibits";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private original source component only");
const dir = "generated-artifacts/company-operating-corpus/issuer-cash-source-followup-v1";
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
async function main() {
  const book = json(`${dir}/receipts.json`); assert.equal(book.attempts.length, 6);
  for (const r of book.attempts) { assert.equal(r.status, 200); assert.equal(hash(r.path), r.sha256); }
  const old = json("generated-artifacts/company-operating-corpus/nee-parent-crosswalk-v1/latest.json");
  assert.equal(hash(old.reportPath), "88075ddf9cac31651a71905897f2f0ac146bf9beead6cdfa73db5bd100487977");
  assert.equal(hash("docs/nee-parent-fslr-programme-evidence.json"), "452d12b3bcc9c35037949cd074bdb4138b380de626349afe843910ddd75d2d9e");
  const parent = json(old.reportPath).nee, get = (name: string) => read(book.attempts.find((r: any) => r.name === name).path);
  const quarter = extractNewNeeCashQuarter(get("nee-2025q3.html"), get("xplr-2025q3.html"));
  const fslr = inspectNewFslrRelease(get("fslr-20261029-full-submission.txt"));
  const oldQ3Book = json("generated-artifacts/company-operating-corpus/issuer-cash-collections-v1/receipts.json");
  const oldQ3 = oldQ3Book.attempts.find((r: any) => r.name === "enlink-2024q3.html");
  assert.equal(hash(oldQ3.path), oldQ3.sha256);
  const historicalMvc = extractHistoricalXomMvcFees(get("enlink-2024q2.html"), read(oldQ3.path));
  const cfSubmission = get("cf-20261104-full-submission.txt");
  assert.match(cfSubmission, /CENTRAL INDEX KEY:\s*0001324404/);
  const cfExhibit = sourceExhibit(cfSubmission, "EX-99.1"), images = embeddedSecJpegs(cfSubmission);
  assert.equal(images.length, 20); mkdirSync(`${dir}/cf-slides`, { recursive: true });
  for (const image of images) writeFileSync(`${dir}/cf-slides/${image.name}`, image.bytes);
  const image = images.find(i => i.name === "tm2628886d1_ex99-1img015.jpg")!;
  if (!image) throw new Error("Declared actual slide15 graphic required");
  const cf = { openingCashUsd: 1982e6, operatingCashUsd: 2544e6, jeraMitsuiBluePointCashContributionsUsd: 391e6,
    consolidatedCapexUsd: 776e6, cfFundedCapexUsd: 637e6, partnerFundedCapexUsd: 139e6,
    bluePointConsolidatedCapexUsd: 232e6, bluePointCfFundedCapexUsd: 93e6,
    chsDistributionsUsd: 447e6, shareholderReturnsUsd: 856e6, otherCashOutflowUsd: 18e6, closingCashUsd: 2820e6 };
  const annual = { categoryDistributionsUsd: parent.sourceCounterparty.categoryDistributionsUsd,
    xplrNetCscsInvestingCashUsd: parent.counterpartyCscsNetInvestingCashUsd,
    neeBroaderRelatedSweepFinancingCashUsd: parent.parentCscsNetFinancingCashUsd,
    neerServiceCostsIncurredUsd: parent.neeConsolidatedServiceCostsIncurred2025Usd,
    dueFromXplrClosingBookUsd: parent.dueFromXplrClosingBookUsd };
  const out = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(out);
  const freezePath = `${out}/frozen-before-calculation.json`;
  const freeze = { version: "issuer-cash-source-followup-1", frozenAt: new Date().toISOString(), quarter, annual, fslr, cf, historicalMvc,
    sourceReceipts: book.attempts, parentReport: { path: old.reportPath, sha256: hash(old.reportPath) },
    preserve: [{ path: "docs/nee-parent-fslr-programme-evidence.json", sha256: hash("docs/nee-parent-fslr-programme-evidence.json") },
      { path: oldQ3.path, sha256: oldQ3.sha256 }],
    cfManualPrimaryTranscription: { declaredExhibit: cfExhibit.name, slide: 15, unit: "USDmillions", period: "9M2026",
      imagePath: `${dir}/cf-slides/${image.name}`, imageSha256: createHash("sha256").update(image.bytes).digest("hex"),
      sourceMethod: "Actual embeddedUUJPEG visuallyread; notOCRsearch-only negative. Slide17independentlyconfirms776mconsolidatedcapex. Footnotes15give232mBluePointJVcapex/93mCFfunded and139mpartnerfunded.", neverXomFeeOrFunding: true },
    conditions: { noNewFutureEconomicAssumptions: true, noReceivableToCashInference: true,
      noGuidanceAsObservedEligibleWatts: true, cfCounterpartyNotXomCash: true, preserveOriginal32RowsAnd340Hashes: true },
    code: ["server/calculation/issuerSourceExhibits.ts", "server/calculation/issuerCashSourceQuarterFollowup.ts",
      "script/issuer-cash-source-followup.test.ts", "script/run-issuer-cash-source-followup.ts"].map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(freezePath, JSON.stringify(freeze, null, 2) + "\n", { flag: "wx" });
  writeFileSync(`${dir}/source-sealed.json`, JSON.stringify({ requests: 6, maximum: 6, receiptsSha256: hash(`${dir}/receipts.json`), sealed: true }) + "\n", { flag: "wx" });
  const nee = reconcileNewNeeCashQuarter(freeze.quarter, freeze.annual), cfCash = reconcileNewCfCounterpartyCash(freeze.cf),
    mvc = reconcileHistoricalXomMvcFees(freeze.historicalMvc);
  const reportPath = `${out}/report.json`;
  writeFileSync(reportPath, JSON.stringify({ version: freeze.version, freezeSha256: hash(freezePath), nee, fslr, cfCash, mvc,
    financialGridOrOldKernelExecutions: 0, originalValuationCashflowsChanged: false, qualifiedOriginalIssuers: 0 }, null, 2) + "\n", { flag: "wx" });
  const pointer = { freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) };
  writeFileSync(`${dir}/latest.json`, JSON.stringify(pointer, null, 2) + "\n");
  console.log(JSON.stringify({ ...pointer, nee, fslr, cfCash, mvc }));
}
main().catch(e => { console.error(String(e)); process.exitCode = 1; });
