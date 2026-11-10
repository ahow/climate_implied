/** Applies frozen rates; no return scoring or model selection. */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { contentHash } from "../server/calculation/analysisManifest";
import { buildAsOfRows } from "../server/financialData/asOfValuation";
import { SeededRandom } from "../server/calculation/random";
const rateHash = "cb928aace43911cad97897d1cbcc5a10e4e7d5b65a1327829f78ad305539d1a4";
const frozen = JSON.parse(readFileSync(`generated-artifacts/company-beta/${rateHash}.json`, "utf8"));
assert.equal(contentHash(frozen), rateHash);
assert.equal(frozen.protocolHash, contentHash(readFileSync("docs/Company_Beta_Sensitivity_Protocol.md", "utf8")));
const paired: any[] = [], exclusions: unknown[] = [];
const sources = new Set(frozen.sourceHashes);
for (const file of readdirSync("generated-artifacts/company-worked-inputs").filter(f => f.endsWith(".json")).sort()) {
  const s = JSON.parse(readFileSync(`generated-artifacts/company-worked-inputs/${file}`, "utf8"));
  assert.equal(contentHash(s.payload), s.inputHash);
  assert.ok(sources.delete(s.inputHash), "Unexpected or duplicated source");
  const p = s.payload;
  const input = { companyId: p.selection.symbol, profileCurrency: p.profile.currency,
    cashFlows: p.statements["cash-flow-statement"], incomes: p.statements["income-statement"],
    observations: p.observations };
  const rates = Object.fromEntries(frozen.results.filter((r: any) => r.symbol === input.companyId && r.status === "available")
    .map((r: any) => [r.origin, r.costOfEquity]));
  const base = buildAsOfRows(input), variant = buildAsOfRows({ ...input, costOfEquityByOrigin: rates });
  exclusions.push({ company: input.companyId, common: base.exclusions, beta: variant.exclusions });
  for (const a of base.rows) {
    const b = variant.rows.find(r => r.origin === a.origin);
    if (!b) continue;
    for (const key of ["actualCashFlowGrowth", "outcomeAvailableAt", "baseFiscalDate", "baseFilingDate", "validationReturn"])
      assert.deepEqual(b[key], a[key], `Changed outcome/lag ${key}`);
    if (["actualCashFlowGrowth", "gordonCashFlowGrowth", "dcfCashFlowGrowth", "validationReturn"]
      .some(k => a[k] === null || b[k] === null)) continue;
    // Original evaluation cutoff remains fixed; do not gain later outcomes.
    if (String(a.outcomeAvailableAt) > "2026-11-09") continue;
    paired.push({ company: input.companyId, origin: a.origin, original: a, beta: b });
  }
}
assert.equal(sources.size, 0);
const mean = (xs: number[]) => xs.reduce((a, b) => a+b, 0)/xs.length;
const origins = [...new Set(paired.map(r => r.origin))].sort();
const diagnostics = origins.map(origin => {
  const rows = paired.filter(r => r.origin === origin);
  return { origin, count: rows.length, ...Object.fromEntries(["gordon", "dcf"].map(model => {
    const key = `${model}CashFlowGrowth`;
    return [model, { impliedMeanAbsoluteDifference: mean(rows.map(r => Math.abs(r.beta[key]-r.original[key]))),
      commonMAE: mean(rows.map(r => Math.abs(r.original[key]-r.original.actualCashFlowGrowth))),
      betaMAE: mean(rows.map(r => Math.abs(r.beta[key]-r.beta.actualCashFlowGrowth))) }];
  })) };
});
const rng = new SeededRandom(20261110);
const draws = Array.from({ length: 2000 }, () => {
  const selected: number[] = [];
  while (selected.length < origins.length) {
    const start = Math.floor(rng.next()*origins.length);
    for (let k=0; k<3 && selected.length<origins.length; k++) selected.push((start+k)%origins.length);
  }
  return selected;
});
const summaries = Object.fromEntries(["gordon", "dcf"].map(model => {
  const delta = diagnostics.map((d: any) => d[model].commonMAE-d[model].betaMAE);
  const boot = draws.map(s => mean(s.map(i => delta[i]))).sort((a,b)=>a-b);
  const quantile = (p: number) => { const x=(boot.length-1)*p, i=Math.floor(x); return boot[i]+(boot[Math.ceil(x)]-boot[i])*(x-i); };
  return [model, { impliedMeanAbsoluteDifference: mean(paired.map(r => Math.abs(r.beta[`${model}CashFlowGrowth`]-r.original[`${model}CashFlowGrowth`]))),
    outcomeMAEImprovement: mean(delta), interval95: [quantile(.025),quantile(.975)] }];
}));
const report = { frozenRates: rateHash, summaries, diagnostics, paired, exclusions,
  interpretation: "Common-8% versus beta sensitivity on unchanged completed outcomes; no return scoring or D8 reselection",
  promotion: false };
const output = `generated-artifacts/company-beta/growth-${contentHash(report)}.json`;
writeFileSync(output, JSON.stringify(report,null,2), { flag:"wx" });
console.log(JSON.stringify({ output, pairs: paired.length, counts: diagnostics.map(d=>d.count), summaries, promotion:false }));
