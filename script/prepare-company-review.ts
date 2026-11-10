/** Private review pack only: no identity or fiscal-rule decisions. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { contentHash } from "../server/calculation/analysisManifest";
const root = "generated-artifacts/company-worked-inputs";
const cases = readdirSync(root).filter(f => f.endsWith(".json")).sort().map(f => {
  const raw = JSON.parse(readFileSync(`${root}/${f}`, "utf8"));
  const p = raw.payload;
  if (contentHash(p) !== raw.inputHash) throw new Error(`Input hash mismatch: ${f}`);
  const statements = p.statements["cash-flow-statement"];
  const periods = statements.map((s: any) => ({
    fiscalDate: s.date, filingDate: s.filingDate, currency: s.reportedCurrency,
    exactPlusOneYearPresent: statements.some((n: any) =>
      n.date === `${Number(s.date.slice(0, 4)) + 1}${s.date.slice(4)}`),
    exactPlusFourYearsPresent: statements.some((n: any) =>
      n.date === `${Number(s.date.slice(0, 4)) + 4}${s.date.slice(4)}`),
  }));
  return { symbol: p.selection.symbol, workbook: p.company,
    provider: { isin: p.profile.isin, symbol: p.profile.symbol, name: p.profile.companyName,
      exchange: p.profile.exchange ?? p.profile.exchangeShortName ?? null, currency: p.profile.currency },
    sourceFile: `${root}/${f}`, sourceHash: raw.inputHash,
    fetchedAt: raw.fetchedAt, identityStatus: raw.identityStatus,
    approvedForCalculations: raw.approvedForCalculations, periods,
    reviewDecision: null,
    requiredChecks: ["Issuer vs listing/share-class/ADR evidence", "Quote and accounting currencies",
      "Consolidated profit and market-cap boundary", "Publication-date evidence vs provider proxy",
      "52/53-week fiscal chronology: exact-date exclusions retained; no rule replacement authorised"],
  };
});
if (cases.length !== 27 || new Set(cases.map(c => c.symbol)).size !== 27)
  throw new Error("Expected exactly 27 retained issuer candidates");
mkdirSync("generated-artifacts/company-review", { recursive: true });
const hash = contentHash(cases);
writeFileSync(`generated-artifacts/company-review/review-${hash}.json`, JSON.stringify(cases, null, 2));
console.log(JSON.stringify({ cases: cases.length, hash, approvalsMade: 0,
  periodChecks: cases.reduce((n, c) => n + c.periods.length, 0),
  note: "Missing exact endpoints flag review, not proof of 52/53-week accounting" }));
