import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractCfCurrentEconomics, reconcileCfCurrentEconomics, extractEnlinkClosingContinuity } from "../server/calculation/cfEnlinkCurrentEconomics";
import { attachmentPlain } from "../server/calculation/issuerAttachmentGrantInputs";
import { sourceExhibit } from "../server/calculation/issuerSourceExhibits";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production") throw new Error("Private source component only");
const root = "generated-artifacts/company-operating-corpus", dir = `${root}/cf-enlink-current-cash-v1`;
const read = (p: string) => readFileSync(p, "utf8"), json = (p: string) => JSON.parse(read(p));
const hash = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
try {
  const book = json(`${dir}/receipts.json`); assert.equal(book.attempts.length, 4);
  for (const p of book.attempts) { assert.equal(p.status, 200); assert.equal(hash(p.path), p.sha256); }
  const get = (name: string) => read(book.attempts.find((r: any) => r.name === name).path);
  const cfSource = extractCfCurrentEconomics(get("cf-earnings-20261104-full.txt"));
  const legal = extractEnlinkClosingContinuity(get("enlink-closing-20250131-full.txt"));
  const searches = ["enlink-earnings-20241106-full.txt", "oneok-earnings-20261027-full.txt"].map(name => {
    const exhibit = sourceExhibit(get(name), "EX-99.1"), t = attachmentPlain(exhibit.body);
    return { name, exhibit: exhibit.name, namedXomOrPecanMatches: (t.match(/Exxon\s*Mobil|Pecan\s*Island/gi) ?? []).length,
      genericFinancialArrangementMatches: (t.match(/financial arrangement/gi) ?? []).length,
      namedExecutedCcsCashSettlementLocated: false };
  });
  const prior = json(`${root}/issuer-cash-source-followup-v1/latest.json`);
  assert.equal(hash(prior.freezePath), "d909c66d7148d3efe721413f77d34838773b909db6e6b8a291247e4aa7a18e27");
  assert.equal(hash(prior.reportPath), "3d544e2f1c45e87f91c07ed8278f7c8d3b7c6ceff01b6a08c71592a220f664f2");
  const out = `${dir}/${new Date().toISOString().replace(/[:.]/g, "-")}`; mkdirSync(out);
  const freezePath = `${out}/frozen-before-calculation.json`;
  const frozen = { version: "cf-enlink-current-cash-1", frozenAt: new Date().toISOString(), cfSource, legal, searches,
    primary: book.attempts, noNewFutureEconomicAssumptions: true, noCreditRecognitionAsCash: true, noMergerDebtAsCcsSettlement: true,
    preserve: [{ path: prior.freezePath, sha256: hash(prior.freezePath) }, { path: prior.reportPath, sha256: hash(prior.reportPath) },
      { path: "docs/issuer-cash-source-followup-evidence.json", sha256: hash("docs/issuer-cash-source-followup-evidence.json") }],
    code: ["server/calculation/cfEnlinkCurrentEconomics.ts", "script/cf-enlink-current-cash.test.ts",
      "script/run-cf-enlink-current-cash.ts"].map(path => ({ path, sha256: hash(path) })) };
  writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
  writeFileSync(`${dir}/source-sealed.json`, JSON.stringify({ requests: 4, maximum: 4, receiptsSha256: hash(`${dir}/receipts.json`), sealed: true }) + "\n", { flag: "wx" });
  const cf = reconcileCfCurrentEconomics(frozen.cfSource), reportPath = `${out}/report.json`;
  writeFileSync(reportPath, JSON.stringify({ version: frozen.version, freezeSha256: hash(freezePath), cf, legal, searches,
    original32RowsChanged: false, financialGridOrOldKernelExecutions: 0, qualifiedOriginalIssuers: 0 }, null, 2) + "\n", { flag: "wx" });
  const pointer = { freezePath, freezeSha256: hash(freezePath), reportPath, reportSha256: hash(reportPath) };
  writeFileSync(`${dir}/latest.json`, JSON.stringify(pointer, null, 2) + "\n"); console.log(JSON.stringify({ ...pointer, cf, legal, searches }));
} catch (e) { console.error(String(e)); process.exitCode = 1; }
