import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractXomClimateEvidence, buildXomPermitClimateCash, integrateXomClimateCash,
  type ClimateForwardAssumptions } from "../server/calculation/xomClimateLiabilityCase";

if (!process.argv.includes("--private-primary") || process.env.NODE_ENV === "production")
  throw new Error("Explicit private-primary original XOM experiment only");
const root = "generated-artifacts/company-operating-corpus";
const sourceDir = `${root}/xom-climate-liability-v1/sources`;
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
async function main() {
  const receipts = read(`${sourceDir}/receipts.json`);
  if (receipts.captures.length + receipts.priorDiscovery.length > 24) throw new Error("Public source attempt budget exceeded");
  const sourceFiles = ["operators-2024.xlsx", "compliance-2026.xlsx", "xom-ex21-identified.html"].map(name => {
    const r = receipts.captures.find((r: any) => r.name === name);
    if (!r || r.status !== 200 || sha(r.path) !== r.sha256) throw new Error(`Authenticated primary bytes absent: ${name}`);
    return r;
  });
  if (sourceFiles[2].url !== "https://www.sec.gov/Archives/edgar/data/34088/000003408825000010/xomexhibit21123124.htm")
    throw new Error("FY2024 subsidiary accession linkage changed");
  const evidence = await extractXomClimateEvidence(readFileSync(sourceFiles[0].path),
    readFileSync(sourceFiles[1].path), readFileSync(sourceFiles[2].path, "utf8"));
  const v3 = read(`${root}/issuer-original-v3/latest.json`), v3report = read(v3.reportPath), v3freeze = read(v3.freezePath);
  const v4 = read(`${root}/issuer-operating-driver-v4/latest.json`), v4freeze = read(v4.freezePath);
  const preserve = [{ path: v3.reportPath, sha256: sha(v3.reportPath) }, { path: v3.freezePath, sha256: sha(v3.freezePath) },
    ...v3freeze.code, ...v3freeze.preserve, ...v3report.cases.map((c: any) => ({ path: c.path, sha256: c.sha256 })),
    { path: v4.reportPath, sha256: sha(v4.reportPath) }, { path: v4.freezePath, sha256: sha(v4.freezePath) }, ...v4freeze.sourceCode];
  for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error("Immutable v3/v4 or prior original source changed");
  const common: ClimateForwardAssumptions = {
    disclosure: "conditional-forward-stress-not-observed", priceIncrementGbpPerUka: 25,
    forwardUsdPerGbp: 1.25, allocationFractionOf2024Delivered: 1,
    openingUncommittedBankUnits: Object.fromEntries(evidence.permits.map(p => [p.permitId, 0])),
    allowancesPerReportedTco2e: 1, passThroughFraction: 0, passThroughLagYears: 0,
    marginalCashTaxReliefFraction: 0, commonCashBurdenFraction: 1,
    cashTiming: "Purchases in emissions year; units earmarked for later surrender; surplus bank excludes earmarked obligation",
  };
  const scenarios = [
    { id: "unit-gbp-increment-normalization", assumptions: { ...common, priceIncrementGbpPerUka: 1, forwardUsdPerGbp: 1 } },
    { id: "gbp25-increment-no-pass", assumptions: common },
    { id: "gbp25-increment-half-pass-lag1", assumptions: { ...common, passThroughFraction: .5, passThroughLagYears: 1 as const } },
    { id: "gbp25-increment-zero-future-free", assumptions: { ...common, allocationFractionOf2024Delivered: 0 } },
  ];
  const baselines = v3report.cases.filter((c: any) => c.symbol === "XOM").map((c: any) => {
    const stored = read(c.path);
    return { id: c.id, source: { path: c.path, sha256: c.sha256 }, built: stored.built };
  });
  const frozenAt = new Date().toISOString();
  const dir = `${root}/xom-climate-liability-v1/${frozenAt.replaceAll(":", "-").replaceAll(".", "-")}`;
  mkdirSync(dir, { recursive: true });
  const frozen = { version: "xom-permit-geography-incremental-carbon-cash-1", frozenAt,
    evidence, sourceFiles, receiptsPath: `${sourceDir}/receipts.json`, receiptsHash: sha(`${sourceDir}/receipts.json`),
    preserve, baselines, scenarios, sourceAttemptCount: receipts.priorDiscovery.length + receipts.captures.length,
    informationContext: "revised-history; FY2024 selected exposures in registry reports published 2026; not knowable at retained 2025 price cutoff",
    code: ["server/calculation/xomClimateLiabilityCase.ts", "script/capture-xom-climate-liability-sources.ts",
      "script/run-xom-climate-liability-case.ts", "script/xom-climate-liability-case.test.ts",
      "script/validate-xom-climate-liability-private.ts"].map(path => ({ path, sha256: sha(path) })),
    conditionalRationale: [
      "These are standardized carbon PRICE-INCREMENT stresses, not observed UKA prices, auction forecasts or absolute historical costs. Unknown existing embedded carbon expense is not deducted twice.",
      "Unit normalization GBP1 and USD/GBP1 is a coefficient, NOT an observed FX quote. GBP25 and fixed future USD/GBP1.25 are labelled conditional stress coordinates, NOT market estimates; FX sensitivity remains linear and source-price/FX facts are explicitly absent.",
      "Future annual covered tCO2e held at actual FY2024 permit totals; no growth, free abatement, global/HQ allocation, Scope2/3 or native-CO2 conversion assumed.",
      "One UKA per reported tCO2e is an explicit forward unit convention; statutory denomination/covered-gas annex was not independently captured within this bounded source attempt.",
      "Future free allocation held at actual 2024 delivered units, or zero as adverse sensitivity; neither is a verified future award or legal phaseout.",
      "No observed allowance bank or facility price/purchases disclosed in captured sheets; opening uncommitted bank ZERO is a conservative future funding assumption, NOT a 2024 observed balance. Cumulative surrenders are not misread as bank/purchases.",
      "No pass-through and no marginal cash tax shield are conservative; half pass with one-year collection lag is labelled sensitivity, not measured supplier/customer contract economics.",
      "Full common cash burden is prospective conservative attribution to the 100%-voting parent; not an observed equity-emissions allocation, nonvoting-claim fact or NCI waterfall.",
      "Existing complete fixed capital, replacement, nuclear/CCS exclusions, financing, NCI cash reserve, cash reserve, original stub, shares, price cutoff and 2.5/3.25/4% terminal remain unchanged. NO reverse scoring or root search.",
    ],
    qualifiedOriginalIssuers: 0, currentLegalCertification: false, rawPrivateExport: false };
  const freezePath = `${dir}/frozen-before-calculation.json`;
  writeFileSync(freezePath, JSON.stringify(frozen, null, 2) + "\n", { flag: "wx" });
  const cases: any[] = [];
  for (const baseline of baselines) for (const scenario of scenarios) {
    const rows = [...baseline.built.ledger.years, ...baseline.built.ledger.continuationYears, baseline.built.ledger.terminalYear];
    const index = rows.map((r: any) => ({ year: r.year, nominalPriceIndex: r.revenue / rows[0].revenue }));
    const climate = buildXomPermitClimateCash(evidence, index, scenario.assumptions);
    const integrated = integrateXomClimateCash(baseline.built, climate);
    const id = `${baseline.id}-${scenario.id}-climate-v1`, path = `${dir}/${id}.json`;
    writeFileSync(path, JSON.stringify({ id, climate, integrated }, null, 2) + "\n", { flag: "wx" });
    cases.push({ id, baselineId: baseline.id, scenario: scenario.id, path, sha256: sha(path),
      terminalGrowth: baseline.built.engineInput.terminalGrowth, forwardWholeEquity: integrated.forwardWholeEquity,
      status: integrated.status, firstYearIncrementalCashUsd: climate.rows[0].incrementalOperatingCashUsd,
      firstYearGrossIncrementalCostGbp: climate.rows[0].incrementalGrossCostGbp,
      terminalIncrementalCashUsd: climate.rows[15].incrementalOperatingCashUsd });
  }
  for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error("Immutable original/v3/v4 bytes changed");
  const report = { version: frozen.version, frozenAt, calculatedAt: new Date().toISOString(),
    freezePath, freezeHash: sha(freezePath), cases, integratedCases: cases.length,
    verifiedPermitCount: evidence.permits.length,
    sourceReportedCoveredTco2e2024: evidence.permits.reduce((s, p) => s + p.recordedCoveredEmissions, 0),
    deliveredAllocationUka2024: evidence.permits.reduce((s, p) => s + p.allocationDelivered, 0),
    nativeCo2TonnesClaimed: false, corporateScope1OrEquityEmissionsClaimed: false,
    sourceAttemptCount: frozen.sourceAttemptCount, reverseScoringPerformed: false,
    oldCasesRerun: false, qualifiedOriginalIssuers: 0, qualifiedOriginalPairs: 0, primaryLawCertification: false };
  const reportPath = `${dir}/report.json`;
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  writeFileSync(`${root}/xom-climate-liability-v1/latest.json`, JSON.stringify({ reportPath, freezePath }, null, 2) + "\n");
  console.log(JSON.stringify({ reportPath, freezePath, integratedCases: cases.length, permits: evidence.permits.length,
    reportedCoveredTco2e: report.sourceReportedCoveredTco2e2024, deliveredUka: report.deliveredAllocationUka2024,
    firstYearConditionalCosts: cases.slice(0, 4).map(c => ({ scenario: c.scenario, gbp: c.firstYearGrossIncrementalCostGbp,
      usdCash: c.firstYearIncrementalCashUsd })), oldCasesRerun: false, qualifiedOriginalIssuers: 0 }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
