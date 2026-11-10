import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { contentHash } from "../server/calculation/analysisManifest";
import { historicalBeta } from "../server/financialData/historicalBeta";
const dir = "generated-artifacts/company-worked-inputs";
const inputs = readdirSync(dir).filter(f => f.endsWith(".json")).sort().map(f => {
  const s = JSON.parse(readFileSync(`${dir}/${f}`, "utf8"));
  if (contentHash(s.payload) !== s.inputHash) throw new Error("Input hash mismatch");
  if (s.payload.profile.currency !== "USD") throw new Error("Non-USD candidate");
  return s;
});
if (inputs.length !== 27) throw new Error("Expected frozen 27 candidates");
const results = inputs.flatMap(s => Array.from({ length: 6 }, (_, i) => {
  const origin = `${2017 + i}-07-31`;
  return { symbol: s.payload.selection.symbol, origin,
    ...historicalBeta(s.payload.observations, inputs.filter(p => p !== s).map(p => p.payload.observations), origin) };
}));
const report = { protocolHash: contentHash(readFileSync("docs/Company_Beta_Sensitivity_Protocol.md", "utf8")),
  sourceHashes: inputs.map(s => s.inputHash), results,
  scope: "Discount-rate diagnostic only. Implied-growth comparison not yet executed. No D8 reselection.",
  approved: false };
mkdirSync("generated-artifacts/company-beta", { recursive: true });
const hash = contentHash(report);
writeFileSync(`generated-artifacts/company-beta/${hash}.json`, JSON.stringify(report, null, 2));
const available = results.filter(r => r.status === "available");
console.log(JSON.stringify({ hash, origins: results.length, available: available.length,
  unavailable: results.length - available.length,
  minimumRate: Math.min(...available.map(r => r.status === "available" ? r.costOfEquity : Infinity)),
  maximumRate: Math.max(...available.map(r => r.status === "available" ? r.costOfEquity : -Infinity)),
  promotion: false }));
