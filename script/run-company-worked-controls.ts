/** Sourced cash-flow controls, NOT calibrated climate projections or promotion. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { reconcileCompanyBaseline } from "../server/financialData/companyBaseline";
import { projectCompanyMembers } from "../server/calculation/companyProjection";
import { contentHash } from "../server/calculation/analysisManifest";

async function main() {
  if (!process.argv[2]) throw new Error("Supply retained company-worked-input files");
  let failed = false;
  for (const file of process.argv.slice(2)) {
    try {
      const source = JSON.parse(await readFile(file, "utf8"));
      if (contentHash(source.payload) !== source.inputHash) throw new Error("Source hash mismatch");
      const p = source.payload;
      if (p.company.isin !== p.profile.isin || p.selection.symbol !== p.profile.symbol)
        throw new Error("Source identity mismatch");
      // Frozen control date common to the three cases; never cherry-pick a positive later period.
      const select = (endpoint: string) => {
        const rows = p.statements[endpoint].filter((r: any) => r.date === "2024-12-31" && r.period === "FY");
        if (rows.length !== 1) throw new Error("Unique 2024 fiscal statement required");
        return rows[0];
      };
      const baseline = reconcileCompanyBaseline(select("income-statement"), select("cash-flow-statement"));
      if (!baseline.positiveFcfe || !baseline.taxRateUsable) throw new Error("Unusable starting FCFE or effective tax");
      const evidence = [`retained-source:${source.inputHash}`, "Unapproved fixed-input accounting control, not a forecast"];
      const year = {
        exposures: [{ region: "US", sector: p.selection.sector, activityGrowth: 0 }],
        marketShareMultiplier: 1, operatingMargin: baseline.operatingMargin,
        taxRate: baseline.effectiveTaxRate, interest: baseline.interest, depreciation: baseline.depreciation,
        capex: baseline.capex, increaseWorkingCapital: baseline.increaseWorkingCapital,
        nonOperatingIncome: baseline.nonOperatingIncome,
        incomeAttributionAdjustment: baseline.incomeAttributionAdjustment, otherCashAdjustments: baseline.otherCashAdjustments,
        scope1IntensityMultiplier: 1, scope2IntensityMultiplier: 1, scope3IntensityMultiplier: 1,
        scope1LiableFraction: 0, scope2LiableFraction: 0, effectiveCarbonPrice: 0, passThrough: 0,
      };
      // Zero physical quantities are explicit isolation controls, NOT substitutions
      // for missing source emissions or claims that these companies emit nothing.
      const input = {
        companyId: String(p.company.id), manifestId: source.inputHash, currency: baseline.currency,
        businessType: "non-financial", baseYear: 2024, baseRevenue: baseline.baseRevenue, baseFcfe: baseline.baseFcfe,
        baseEmissionsTonnes: { scope1: 0, scope2: 0, scope3: 0 },
        marginBounds: { minimum: baseline.operatingMargin, maximum: baseline.operatingMargin, evidence },
        mapping: { basis: "headquarters-fallback", evidence,
          shares: [{ region: "US", sector: p.selection.sector, weight: 1 }] },
        members: [
          { id: "constant-accounting-control", netBorrowing: baseline.netBorrowing },
          { id: "no-new-net-borrowing-control", netBorrowing: 0 },
        ].map(m => ({ id: m.id, years: Array.from({ length: 5 }, (_, i) =>
          ({ ...year, year: 2025 + i, netBorrowing: m.netBorrowing })) })),
      };
      const projection = projectCompanyMembers(input);
      if (projection.status !== "conditional-projection") throw new Error("Control refused");
      const constant = projection.members.find(m => m.id === "constant-accounting-control")!;
      const tolerance = Math.max(1, Math.abs(baseline.baseFcfe)) * 1e-10;
      if (constant.years.some(y => Math.abs(y.fcfe - baseline.baseFcfe) > tolerance))
        throw new Error("Constant control does not reproduce source FCFE");
      const summary = {
        symbol: baseline.symbol, sourceHash: source.inputHash, baselineFcfe: baseline.baseFcfe,
        operatingCashFlow: baseline.operatingCashFlow, capex: baseline.capex, netBorrowing: baseline.netBorrowing,
        statementNetIncomeDifference: baseline.statementNetIncomeDifference,
        otherCashAdjustments: baseline.otherCashAdjustments,
        controls: projection.members.map(m => ({ id: m.id, finalFcfe: m.years[4].fcfe, fiveYearGrowth: m.growth })),
        claim: "Financial accounting controls only; physical emissions and policy effects intentionally disabled",
        productionEligible: false, workedClimateProjectionComplete: false,
      };
      const folder = "generated-artifacts/company-worked-results";
      await mkdir(folder, { recursive: true });
      const result = { baseline, input, projection, summary };
      const output = `${folder}/${contentHash(result)}.json`;
      try { await writeFile(output, JSON.stringify(result), { flag: "wx" }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
      console.log(JSON.stringify({ ...summary, output }));
    } catch {
      failed = true;
      console.error(JSON.stringify({ file, status: "unavailable", reason: "Source or accounting control failed validation" }));
    }
  }
  process.exitCode = failed ? 1 : 0;
}
main().catch(() => { console.error("Worked controls failed"); process.exitCode = 1; });
