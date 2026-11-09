import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { z } from "zod";
import { contentHash } from "../server/calculation/analysisManifest";
import { cashFlowValue, reverseCashFlowGrowth } from "../server/calculation/cashFlowValuation";

const statement = z.object({
  fiscalYear: z.union([z.string(), z.number()]), period: z.literal("FY"),
  date: z.string().date(), reportedCurrency: z.literal("USD"),
  operatingCashFlow: z.number().finite(), capitalExpenditure: z.number().finite().max(0),
  netDebtIssuance: z.number().finite(),
});
const files = process.argv.slice(2);
if (!files.length) throw new Error("Supply retained company-worked-input files");
const seen = new Set<string>(), cases = [];
for (const file of files) {
  const source = JSON.parse(await readFile(file, "utf8")), p = source.payload;
  if (contentHash(p) !== source.inputHash) throw new Error("Source hash mismatch");
  if (!p.company.isin || p.company.isin !== p.profile.isin ||
    p.selection.symbol !== p.profile.symbol || seen.has(p.selection.symbol))
    throw new Error("Missing, inconsistent or duplicate company identity");
  seen.add(p.selection.symbol);
  const profile = z.object({ marketCap: z.number().finite().positive(), currency: z.literal("USD") }).parse(p.profile);
  const candidates = p.statements["cash-flow-statement"].filter((r: any) => String(r.fiscalYear) === "2024" && r.period === "FY");
  if (candidates.length !== 1) throw new Error("Exactly one FY2024 statement required");
  const cf = statement.parse(candidates[0]);
  const rows = [];
  for (const borrowing of ["reported", "no-net-borrowing"]) {
    const baseCashFlow = cf.operatingCashFlow + cf.capitalExpenditure +
      (borrowing === "reported" ? cf.netDebtIssuance : 0);
    for (const discountRate of [.06, .08, .10]) for (const terminalGrowth of [.01, .02, .03]) {
      const input = { baseCashFlow, marketCap: profile.marketCap, discountRate, terminalGrowth,
        basis: "FCFE", discountBasis: "cost-of-equity", businessType: "non-financial",
        cashFlowCurrency: "USD", valuationCurrency: "USD", minimumGrowth: -.5, maximumGrowth: .5 };
      const result = reverseCashFlowGrowth(input);
      let independentForwardError: number | null = null;
      if (result.status === "conditional-solution") {
        const forward = cashFlowValue({ ...input, stageOneGrowth: result.growth });
        if (forward.status !== "conditional-value") throw new Error("Forward repricing unavailable");
        independentForwardError = Math.abs(forward.equityValue / profile.marketCap - 1);
        if (!Number.isFinite(independentForwardError) || independentForwardError >= 1e-8)
          throw new Error("Repricing tolerance exceeded");
      }
      rows.push({ borrowing, discountRate, terminalGrowth, baseCashFlow, result, independentForwardError });
    }
  }
  cases.push({ symbol: p.selection.symbol, sourceHash: source.inputHash, statementDate: cf.date,
    valuationDate: null, marketCap: profile.marketCap, currency: "USD", rows });
}
const report = { protocolHash: createHash("sha256").update(await readFile(
  "docs/Company_Valuation_Sensitivity_Protocol.md")).digest("hex"), cases,
  claim: "Mixed-date conditional valuation controls; not forecasts or a D8 comparison",
  identityApproved: false, investmentEvidence: false, productionEligible: false };
const folder = "generated-artifacts/valuation-sensitivity";
await mkdir(folder, { recursive: true });
const path = `${folder}/${contentHash(report)}.json`, text = JSON.stringify(report, null, 2) + "\n";
try { await writeFile(path, text, { flag: "wx" }); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(path, "utf8") !== text) throw error;
}
console.log(JSON.stringify({ path, cases: cases.map(c => ({ symbol: c.symbol,
  solutions: c.rows.filter(r => r.result.status === "conditional-solution").length,
  rejected: c.rows.filter(r => r.result.status !== "conditional-solution").length,
  maxRepricingError: Math.max(...c.rows.map(r => r.independentForwardError ?? 0)),
  ranges: ["reported", "no-net-borrowing"].map(borrowing => {
    const growth = c.rows.filter(r => r.borrowing === borrowing).flatMap(r =>
      r.result.status === "conditional-solution" ? [r.result.growth] : []);
    return { borrowing, min: growth.length ? Math.min(...growth) : null, max: growth.length ? Math.max(...growth) : null };
  }) })) }, null, 2));
