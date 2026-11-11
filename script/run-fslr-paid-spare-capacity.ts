import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractPaidCapacitySources, paidCapacityBound, paidCapacityExperiment, buildPaidCapacityCase,
  type PaidCapacityOptions } from "../server/calculation/fslrPaidSpareCapacityCase";
if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production")
  throw new Error("Explicit private-primary original FSLR experiment required");
const root = "generated-artifacts/company-operating-corpus";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
const old = read(`${root}/issuer-original-v3/latest.json`), oldReport = read(old.reportPath), oldFreeze = read(old.freezePath);
const source = oldFreeze.prepared.find((p: any) => p.symbol === "FSLR");
if (sha(source.source.path) !== source.source.sha256 || sha(source.supplemental.path) !== source.supplemental.sha256)
  throw new Error("Retained authenticated primary/guidance bytes changed");
const facts = extractPaidCapacitySources(readFileSync(source.source.path, "utf8"));
const v4 = read(`${root}/issuer-operating-driver-v4/latest.json`), v4Freeze = read(v4.freezePath);
const xom = read(`${root}/xom-climate-liability-v1/latest.json`), xomFreeze = read(xom.freezePath);
const preserve = [{ path: old.reportPath, sha256: sha(old.reportPath) }, { path: old.freezePath, sha256: sha(old.freezePath) },
  ...oldFreeze.code, ...oldFreeze.preserve, ...oldReport.cases.map((c: any) => ({ path: c.path, sha256: c.sha256 })),
  { path: v4.reportPath, sha256: sha(v4.reportPath) }, { path: v4.freezePath, sha256: sha(v4.freezePath) }, ...v4Freeze.sourceCode,
  { path: xom.reportPath, sha256: sha(xom.reportPath) }, { path: xom.freezePath, sha256: sha(xom.freezePath) }, ...xomFreeze.code];
for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error("Protected original/v3/v4/XOM study changed");
const baselines = oldReport.cases.filter((p: any) => p.symbol === "FSLR").map((p: any) => ({
  id: p.id, storedPath: p.path, sha256: p.sha256, built: read(p.path).built,
}));
const options: (PaidCapacityOptions & { id: string })[] = [];
for (const availableWatts of [facts.existingNameplateWatts, facts.existingNameplateWatts + facts.plannedAdditionalWatts])
  for (const cashCostMode of ["all-cash-cost-variable", "additional-da-wear-reserve"] as const)
    for (const creditMode of ["inherited-source-law", "all-post-stub-credit-value-zero"] as const)
      options.push({ id: `cap${availableWatts / 1e9}-${cashCostMode}-${creditMode}`, availableWatts,
        unitGrowthPerturbation: paidCapacityBound(facts.guidedSoldWatts2025, availableWatts), cashCostMode, creditMode });
if (options.some(o => o.unitGrowthPerturbation > .02923517698995651))
  throw new Error("New physical bounds widen original v4 bound");
if (source.market.currency !== "USD" || source.market.referenceDate !== source.market.priceDate ||
  source.market.priceDate !== source.market.sharesDate) throw new Error("Retained actual equity reference mismatch");
const frozenAt = new Date().toISOString(), dir = `${root}/fslr-paid-spare-capacity-v1/${frozenAt.replaceAll(":", "-").replaceAll(".", "-")}`;
mkdirSync(dir, { recursive: true });
const frozen = { ...paidCapacityExperiment, frozenAt, facts, input: source.input, baselines, options,
  sources: [source.source, source.supplemental], market: source.market, preserve,
  oldV3Assumptions: oldFreeze.assumptions,
  rationale: [...paidCapacityExperiment.rationale,
    "Requested original nominal 2.5-4% scenarios and pre-terminal nominal index are assumed for ASP, cash costs and paid-asset replacement; NOT observed pricing power, contract escalation, source guidance or guaranteed inflation pass-through.",
    "Noncurrent FY2024 inventory previously outside current-WC proxy is now explicitly funded: actual opening reserve carried into first new year, then catch up to retained revenue index and fund subsequent nominal changes; no 2025 observation/retroactive stub change claimed.",
    "Incremental finished-goods-value liquidity is held as CASH, not extra physical modules, so production=sales and source nameplate bound do not conceal inventory production beyond capacity. Additional raw/WIP reserve and other-asset-equivalent buffers are conditional working-funding policies, not future reported balance-sheet facts.",
    "No future collection of forecast opening credit receivable in all-zero-credit member. Its frozen quarter-year equivalent is explicitly unreleased, not an observed writeoff, entitlement denial or missing terminal windfall.",
    "Revised-history reference is unchanged actual common shares/price at retained 2025 date; FY2024 filing/guidance were published later. No historical knowledge backdating or future observed market share assumption.",
  ],
  code: ["server/calculation/fslrPaidSpareCapacityCase.ts", "script/run-fslr-paid-spare-capacity.ts",
    "script/fslr-paid-spare-capacity.test.ts", "script/validate-fslr-paid-spare-capacity-private.ts"]
    .map(path => ({ path, sha256: sha(path) })),
  sourceRequests: 0, providerRequests: 0, outcomesNotCalculatedBeforeFreeze: true };
const freezePath = `${dir}/frozen-before-calculation.json`;
writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
const cases = [];
for (const base of baselines) for (const option of options) {
  const result = buildPaidCapacityCase(source.input, facts, base.built, option);
  const id = `${base.id}-${option.id}-paid-v1`, path = `${dir}/${id}.json`;
  writeFileSync(path, JSON.stringify({ id, result }, null, 2) + "\n", { flag: "wx" });
  cases.push({ id, baselineId: base.id, optionId: option.id, terminalGrowth: base.built.engineInput.terminalGrowth,
    path, sha256: sha(path), status: result.status, forwardWholeEquity: result.forwardWholeEquity,
    formalSignedCashSum: result.formalSignedCashSum, terminalFcfe: result.rows[15].fcfe,
    postCreditYearsWithNegativeCash: result.rows.filter(r => r.year >= 2034 && r.fcfe <= 0).map(r => r.year),
    commonFundingRequired: result.totalPositiveCommonFunding, actualFcfeGrowth: result.actualFcfeGrowth,
    valueToRetainedEquityReference: result.forwardWholeEquity === null ? null :
      result.forwardWholeEquity / (source.market.price * source.market.shares) });
}
for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error("Protected study changed during new calculation");
const report = { version: frozen.version, frozenAt, calculatedAt: new Date().toISOString(), freezePath, freezeHash: sha(freezePath),
  cases, fullNewCases: cases.length, cashRows: cases.length * 16, terminalRows: cases.length,
  conditionalPositiveFundedValues: cases.filter(c => c.forwardWholeEquity !== null).length,
  terminalNonpositiveCases: cases.filter(c => c.terminalFcfe <= 0).length,
  noNewCreditCashPositiveValues: cases.filter(c => c.optionId.includes("all-post-stub") && c.forwardWholeEquity !== null).length,
  qualifiedOriginalIssuers: 0, qualifiedOriginalPairs: 0, reverseScoringPerformed: false,
  originalV4BoundsWidened: false, oldCasesReexecuted: false, policyEligibilityVerified: false,
  sourceRequests: 0, providerRequests: 0 };
const reportPath = `${dir}/report.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${root}/fslr-paid-spare-capacity-v1/latest.json`, JSON.stringify({ reportPath, freezePath }, null, 2) + "\n");
console.log(JSON.stringify({ reportPath, freezePath, cases: cases.length,
  positiveFundedValues: report.conditionalPositiveFundedValues, terminalNonpositive: report.terminalNonpositiveCases,
  noFutureCreditPositiveValues: report.noNewCreditCashPositiveValues, qualifiedOriginalIssuers: 0,
  statuses: cases.reduce((a: Record<string, number>, c) => { a[c.status] = (a[c.status] ?? 0) + 1; return a; }, {}) }));
