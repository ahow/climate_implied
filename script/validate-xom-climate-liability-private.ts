import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { extractXomClimateEvidence, buildXomPermitClimateCash, integrateXomClimateCash } from "../server/calculation/xomClimateLiabilityCase";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production")
  throw new Error("Mandatory private actual-source validator; not code-only CI");
const root = "generated-artifacts/company-operating-corpus/xom-climate-liability-v1";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
async function main() {
  const latest = read(`${root}/latest.json`), report = read(latest.reportPath), frozen = read(latest.freezePath);
  assert.equal(sha(latest.freezePath), report.freezeHash);
  assert.ok(Date.parse(frozen.frozenAt) <= Date.parse(report.calculatedAt));
  for (const file of [...frozen.code, ...frozen.preserve, ...frozen.sourceFiles])
    assert.equal(sha(file.path), file.sha256);
  assert.equal(sha(frozen.receiptsPath), frozen.receiptsHash);
  assert.equal(frozen.sourceAttemptCount, 24);
  const facts = await extractXomClimateEvidence(readFileSync(frozen.sourceFiles[0].path),
    readFileSync(frozen.sourceFiles[1].path), readFileSync(frozen.sourceFiles[2].path, "utf8"));
  assert.deepEqual(facts, frozen.evidence);
  assert.equal(facts.permits.length, 2);
  assert.equal(facts.permits.reduce((s, p) => s + p.recordedCoveredEmissions, 0), 3070057);
  assert.equal(facts.permits.reduce((s, p) => s + p.allocationDelivered, 0), 1509112);
  let cashRows = 0, permitRows = 0;
  for (const c of report.cases) {
    assert.equal(sha(c.path), c.sha256);
    const saved = read(c.path), base = frozen.baselines.find((b: any) => b.id === c.baselineId).built;
    const scenario = frozen.scenarios.find((s: any) => s.id === c.scenario);
    const source = [...base.ledger.years, ...base.ledger.continuationYears, base.ledger.terminalYear];
    const index = source.map((r: any) => ({ year: r.year, nominalPriceIndex: r.revenue / source[0].revenue }));
    const climate = buildXomPermitClimateCash(facts, index, scenario.assumptions);
    const integrated = integrateXomClimateCash(base, climate);
    assert.deepEqual(climate, saved.climate); assert.deepEqual(integrated, saved.integrated);
    let oldRecovery = 0;
    const x = base.engineInput;
    const time = (d: string) => (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${x.referenceDate}T00:00:00Z`)) / (86400000 * 365.25);
    let pv = x.stub.cashFlows.reduce((s: number, r: any) => s + r.fcfe / (1 + x.discountRate) ** time(r.date), 0);
    integrated.rows.forEach((row: any, i: number) => {
      const a = scenario.assumptions, r = climate.rows[i];
      let deficit = 0;
      for (const p of facts.permits) {
        // All frozen ACTUAL experiments explicitly use future zero uncommitted
        // banks, so independent shortage has this direct form. Not observed bank.
        deficit += p.recordedCoveredEmissions - p.allocationDelivered * a.allocationFractionOf2024Delivered;
        const flow = r.permits.find((f: any) => f.permitId === p.permitId);
        assert.ok(flow);
        assert.ok(Math.abs(flow.openingUncommittedBankUnits + flow.freeAllocationUnits + flow.purchasedUnits -
          flow.earmarkedSurrenderUnits - flow.closingUncommittedBankUnits) < 1e-8);
        assert.equal(p.nativeCo2Tonnes, null); assert.equal(p.corporateGhgScope, null);
        assert.equal(p.globalCoverageShare, null); permitRows++;
      }
      const cost = deficit * a.priceIncrementGbpPerUka * index[i].nominalPriceIndex * a.forwardUsdPerGbp;
      const recovery = a.passThroughLagYears === 0 ? cost * a.passThroughFraction : oldRecovery;
      const independentCash = source[i].fcfe - cost + recovery;
      assert.ok(Math.abs(independentCash - row.fcfe) < .02);
      assert.ok(Math.abs(row.closingReceivables - row.openingReceivables - row.receivablesIncrease) < .02);
      assert.ok(Math.abs(row.operatingProfitBeforeClimate - row.climateOperatingCost + row.recognizedPolicyCredit - row.operatingProfit) < .02);
      assert.ok(Math.abs(row.nonClimateRevenue + row.climateRevenue - row.revenue) < .02);
      for (const key of ["capitalSpend", "debtProceeds", "debtRepayments", "interestPaid", "cashTax", "nonCommonCashClaims"])
        assert.equal(row[key], source[i][key]);
      oldRecovery = cost * a.passThroughFraction;
      pv += i < 15 ? independentCash / (1 + x.discountRate) ** time(row.cashFlowDate) :
        independentCash / (x.discountRate - x.terminalGrowth) / (1 + x.discountRate) ** time(source[14].cashFlowDate);
      cashRows++;
    });
    assert.ok(Math.abs(pv - integrated.formalSignedCashSum) < .02);
    assert.equal(integrated.qualifiedOriginalIssuers, 0);
    assert.equal(integrated.reverseScoringPerformed, false);
  }
  assert.equal(report.integratedCases, 24); assert.equal(cashRows, 384); assert.equal(permitRows, 768);
  assert.equal(report.qualifiedOriginalIssuers, 0); assert.equal(report.oldCasesRerun, false);
  console.log(JSON.stringify({ status: "passed", exactLegalOperators: 1, exactPermitJoins: 2, actualCases: 24,
    independentlyReconciledCashRows: cashRows, allowanceUnitRows: permitRows, originalQualifiedIssuers: 0,
    originalQualifiedPairs: 0, oldCasesRerun: false, newReverseScoring: false, observedBankOrPriceOrFxInvented: false }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
