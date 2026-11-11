import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractNeeWaterfallFacts, neeHistoricalWaterfall, neeWaterfallExperiment, buildNeeWaterfall,
  type NeeWaterfallOptions } from "../server/calculation/neeProjectCashWaterfall";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production")
  throw new Error("Private primary NEE calculation requires --private-primary outside production");
const root = "generated-artifacts/company-operating-corpus";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const prior = read(`${root}/issuer-original-v3/latest.json`), oldFreeze = read(prior.freezePath), oldReport = read(prior.reportPath);
const source = oldFreeze.prepared.find((p: any) => p.symbol === "NEE");
if (sha(source.source.path) !== source.source.sha256) throw new Error("Authenticated FY2024 NEE source changed");
const facts = extractNeeWaterfallFacts(readFileSync(source.source.path, "utf8"));
const preserve = [
  { path: prior.freezePath, sha256: sha(prior.freezePath) }, { path: prior.reportPath, sha256: sha(prior.reportPath) },
  ...oldFreeze.code, ...oldFreeze.preserve,
  ...oldReport.cases.map((c: any) => ({ path: c.path, sha256: c.sha256 })),
];
// Read/hash old studies ONLY. Never call any previous experiment kernel.
for (const directory of ["issuer-operating-driver-v4", "fslr-paid-spare-capacity-v1", "xom-climate-liability-v1"]) {
  const l = read(`${root}/${directory}/latest.json`), f = read(l.freezePath), r = read(l.reportPath);
  preserve.push({ path: l.freezePath, sha256: sha(l.freezePath) }, { path: l.reportPath, sha256: sha(l.reportPath) },
    ...(f.code ?? f.sourceCode ?? []), ...r.cases.filter((c: any) => c.path).map((c: any) => ({ path: c.path, sha256: c.sha256 })));
}
for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error(`Protected prior source/study changed: ${p.path}`);
const baselines = oldReport.cases.filter((c: any) => c.symbol === "NEE").map((c: any) => {
  const b = read(c.path).built, e = b.engineInput, input = source.input;
  const otherWc = input.inventory + input.otherCurrentAssets + input.minimumCash -
    input.operatingPayables - input.customerAdvances;
  return { id: c.id, path: c.path, sha256: c.sha256, terminalGrowth: e.terminalGrowth,
    original: { referenceDate: e.referenceDate, baseFcfe: e.baseFcfe, costOfEquity: e.discountRate,
      opening2026Debt: b.funding[0].closingDebt,
      opening2026WorkingFunding: e.years[0].openingReceivables +
        otherWc * b.funding[0].cashReserve / input.minimumCash,
      stub: e.stub }, expectedOpening2026Ppe: b.funding[0].closingPpe,
    expectedOpening2026Debt: b.funding[0].closingDebt };
});
if (baselines.length !== 6 || source.market.currency !== "USD" ||
    source.market.priceDate !== source.market.sharesDate || source.market.referenceDate !== source.market.priceDate)
  throw new Error("Original NEE identity/date/baselines mismatch");
const options: { operatingMode: NeeWaterfallOptions["operatingMode"]; policyMode: NeeWaterfallOptions["policyMode"] }[] = [];
for (const operatingMode of ["opening-capital-yield", "budget-completion-delay"] as const)
  for (const policyMode of ["retained-cohort-runoff", "zero-future-policy-cash"] as const)
    options.push({ operatingMode, policyMode });
const frozenAt = new Date().toISOString(), dir = `${root}/nee-project-cash-waterfall-v1/${frozenAt.replaceAll(":", "-").replaceAll(".", "-")}`;
mkdirSync(dir, { recursive: true });
const frozen = { ...neeWaterfallExperiment, frozenAt, facts, input: source.input, baselines, options,
  primary: source.source, market: source.market, preserve, sourceRequests: 0, providerRequests: 0,
  revisedHistoryReference: true, originalStub2025Unchanged: true,
  rationaleAddendum: "Freeze new cash-return/maintenance/reserve model before scoring. Preserve original 2025 cash stub and debt. NEW capital-equivalent book includes source cash fuel less nuclear-and-other amortization (old fixed-only proxy did not). This noncash opening-book correction and forecast working-funding catch-up are exposed; any additional borrowing/reserve cash occurs in 2026, never retroactively changing stub. Unknown gross-other cash is not zero fact. No NCI book redemption or HLBV income added again.",
  code: ["server/calculation/neeProjectCashWaterfall.ts", "script/run-nee-project-cash-waterfall.ts",
    "script/nee-project-cash-waterfall.test.ts", "script/validate-nee-project-cash-waterfall-private.ts"]
    .map(path => ({ path, sha256: sha(path) })), outcomesNotCalculatedBeforeFreeze: true };
const freezePath = `${dir}/frozen-before-calculation.json`;
writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
const historical = neeHistoricalWaterfall(facts);
for (const [name, value] of Object.entries(historical)) if (name.endsWith("Residual") && value !== 0)
  throw new Error(`Actual historical cash bridge ${name} failed`);
const cases = [];
for (const base of baselines) for (const option of options) {
  const result = buildNeeWaterfall(facts, source.input, { ...option, terminalGrowth: base.terminalGrowth }, base.original);
  const b = result.opening2025Bridge;
  if (Math.abs(b.closingPpe[0] + b.closingPpe[1] - base.expectedOpening2026Ppe -
      b.fuelAmortizationBookCorrectionToOldFixedOnlyProxy) > .001 ||
      Math.abs(b.closingDebt - base.expectedOpening2026Debt) > .001)
    throw new Error("New opening bridge does not retain frozen original stub book/debt");
  const id = `${base.id}-${option.operatingMode}-${option.policyMode}-cash-v1`, path = `${dir}/${id}.json`;
  writeFileSync(path, JSON.stringify({ id, result }, null, 2) + "\n", { flag: "wx" });
  cases.push({ id, baselineId: base.id, ...option, terminalGrowth: base.terminalGrowth, path, sha256: sha(path),
    status: result.status, terminalFcfe: result.terminalFcfe, forwardWholeEquity: result.forwardWholeEquity,
    signedPlanPv: result.formalSignedPlanPv, commonCalls: result.futureCommonCalls,
    extraCashAboveApprovedBudgets: result.extraCashAboveApprovedBudgets,
    terminalExtraGrossClaimHeadroom2024Usd: result.terminalExtraGrossClaimHeadroom2024Usd,
    fundedPlanExtraGrossClaimHeadroom2024Usd: result.fundedPlanExtraGrossClaimHeadroom2024Usd,
    actualFcfe5YearGrowth: result.actualFcfe5YearGrowth,
    valueToRetainedEquityReference: result.forwardWholeEquity === null ? null :
      result.forwardWholeEquity / (source.market.price * source.market.shares) });
}
for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error("Protected study changed during NEE calculation");
const report = { version: frozen.version, frozenAt, calculatedAt: new Date().toISOString(), freezePath,
  freezeHash: sha(freezePath), historical, cases, caseCount: cases.length, futureCashRows: cases.length * 16,
  terminalRows: cases.length, qualifiedOriginalIssuers: 0, qualifiedOriginalPairs: 0,
  conditionalPositiveFloorValues: cases.filter(c => c.forwardWholeEquity !== null).length,
  positiveTerminalCases: cases.filter(c => c.terminalFcfe > 0).length, reverseScoringPerformed: false,
  identifiedCompleteGrossNciWaterfall: false, oldKernelsRerun: false, sourceRequests: 0, providerRequests: 0 };
const reportPath = `${dir}/report.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${root}/nee-project-cash-waterfall-v1/latest.json`, JSON.stringify({ reportPath, freezePath }, null, 2) + "\n");
console.log(JSON.stringify({ reportPath, freezePath, freezeHash: sha(freezePath), reportHash: sha(reportPath),
  cases: cases.length, futureCashRows: report.futureCashRows, conditionalPositiveFloorValues: report.conditionalPositiveFloorValues,
  historical,
  terminalRange: [Math.min(...cases.map(c => c.terminalFcfe)), Math.max(...cases.map(c => c.terminalFcfe))],
  signedValueRange: [Math.min(...cases.map(c => c.signedPlanPv)), Math.max(...cases.map(c => c.signedPlanPv))],
  qualifiedOriginalIssuers: 0 }, null, 2));
