import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { extractXomOperatingMarginEnvelope, makeFslrVolumeDriver, operatingDriverExperiment,
  reverseOperatingDriver, type OperatingDriverCase, type OperatingDriverSpec } from "../server/calculation/issuerOperatingDriverReverse";

if (process.env.NODE_ENV === "production" || !process.argv.includes("--private-primary"))
  throw new Error("Explicit --private-primary required; not code-only CI or production");
const root = "generated-artifacts/company-operating-corpus";
const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const oldLatest = read(`${root}/issuer-original-v3/latest.json`), oldReport = read(oldLatest.reportPath), oldFreeze = read(oldLatest.freezePath);
if (sha(oldLatest.freezePath) !== oldReport.freezeHash || oldReport.canonicalSamePathPairs + oldReport.signedCertifiedSamePathPairs !== 9)
  throw new Error("Immutable v3 experiment identity/9-pair invariant changed");
const preserve = [{ path: oldLatest.reportPath, sha256: sha(oldLatest.reportPath) },
  { path: oldLatest.freezePath, sha256: sha(oldLatest.freezePath) }, ...oldFreeze.preserve,
  ...oldFreeze.code, ...oldReport.cases.map((c: any) => ({ path: c.path, sha256: c.sha256 }))];
for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error("Immutable v3/prior source bytes changed");
const xom = oldFreeze.prepared.find((p: any) => p.symbol === "XOM");
if (sha(xom.source.path) !== xom.source.sha256) throw new Error("Primary bytes changed");
const marginEnvelope = extractXomOperatingMarginEnvelope(readFileSync(xom.source.path, "utf8"), xom.input.reconciliation.identity);
const fslr = oldFreeze.prepared.find((p: any) => p.symbol === "FSLR");
const fslrText = readFileSync(fslr.source.path, "utf8").replace(/<[^>]+>/g, " ").replace(/&#160;|&nbsp;/g, " ").replace(/\s+/g, " ");
for (const text of ["approximately 21 GW", "approximately 4 GW", "second half of 2025"])
  if (!fslrText.includes(text)) throw new Error(`Primary forward nameplate source missing: ${text}`);
const prepared = oldReport.cases.map((old: any) => {
  const source = oldFreeze.prepared.find((p: any) => p.symbol === old.symbol);
  const artifact = read(old.path), baseline = artifact.built;
  let driver: OperatingDriverSpec;
  if (old.symbol === "FSLR") driver = makeFslrVolumeDriver();
  else if (old.symbol === "XOM") {
    const margin = source.input.reconciliation.normalized.operatingProfit / source.input.reconciliation.normalized.revenue;
    driver = { kind: "operating-cost-spread-change",
      lower: (marginEnvelope.minimum - margin) / 9.5 * (1 - 1e-10),
      upper: (marginEnvelope.maximum - margin) / 9.5 * (1 - 1e-10),
      minimumMargin: marginEnvelope.minimum, maximumMargin: marginEnvelope.maximum,
      boundBasis: "Exact primary FY2022-2024 operating-only EBIT margins; scenario envelope, not future observation; 9.5 cumulative faded annual increments; physical activity unchanged" };
  } else driver = { kind: "unsupported",
    reason: "NEE EPS-to-EBIT forward proxy does not identify a consolidated operating driver with source-bounded capacity/cost/price and cash allocation. FPL regulatory ROE cannot be applied to NEE/NEER." };
  const curve: OperatingDriverCase = { symbol: old.symbol, input: source.input, baseline, driver };
  if (source.market.priceDate !== source.market.sharesDate || source.market.currency !== "USD")
    throw new Error("Immutable actual equity date/currency reference mismatch");
  return { id: old.id.replace("original-v3", "operating-v4"), oldArtifact: { path: old.path, sha256: old.sha256 },
    curve, market: source.market, equityReference: source.market.price * source.market.shares };
});
const frozenAt = new Date().toISOString(), outputRoot = `${root}/issuer-operating-driver-v4`;
const dir = `${outputRoot}/${frozenAt.replaceAll(":", "-").replaceAll(".", "-")}`;
mkdirSync(dir, { recursive: true });
const freeze = { version: operatingDriverExperiment.version, frozenAt, prepared, marginEnvelope, preserve,
  experiment: operatingDriverExperiment, newNetworkRequests: 0, newProviderRequests: 0,
  sourceCode: ["server/calculation/issuerOperatingDriverReverse.ts", "script/run-issuer-operating-driver-reverse.ts",
    "script/validate-issuer-operating-driver-private.ts", "script/issuer-operating-driver-reverse.test.ts"]
    .map(path => ({ path, sha256: sha(path) })),
  source45xEligibilityVerified: false, lawAndFeocStatus: "Post-2025 amendments and FEOC unresolved; inherited source-law scenario only",
  scoringNotPerformedBeforeFreeze: true };
const freezePath = `${dir}/frozen-before-scoring.json`;
writeFileSync(freezePath, JSON.stringify(freeze, null, 2) + "\n", { flag: "wx" });
const cases = prepared.map((p: any) => {
  try {
    const result = reverseOperatingDriver(p.curve, p.equityReference);
    const path = `${dir}/${p.id}.json`;
    writeFileSync(path, JSON.stringify({ id: p.id, result }, null, 2) + "\n", { flag: "wx" });
    return { id: p.id, symbol: p.curve.symbol, terminalGrowth: p.curve.baseline.engineInput.terminalGrowth,
      path, sha256: sha(path), status: result.status,
      operatingPerturbation: "impliedOperatingPerturbation" in result ? result.impliedOperatingPerturbation : null,
      fcfeGrowth: "impliedFcfeGrowth" in result ? result.impliedFcfeGrowth : null,
      baselineGrowth: "baselineGrowth" in result ? result.baselineGrowth : null,
      proof: "proof" in result ? result.proof : null };
  } catch (error) {
    return { id: p.id, symbol: p.curve.symbol, error: error instanceof Error ? error.message : "Driver rebuild failed" };
  }
});
for (const p of preserve) if (sha(p.path) !== p.sha256) throw new Error("Immutable v3/prior result changed");
const report = { version: freeze.version, frozenAt, scoredAt: new Date().toISOString(), freezePath, freezeHash: sha(freezePath),
  cases, operatingDriverTargetMatches: cases.filter((c: any) => c.status === "conditional-operating-driver-target-match").length,
  originalQualifiedIssuers: 0, originalQualifiedPairs: 0, preservedV3Pairs: 9, oldExperimentsReexecuted: false,
  newNetworkRequests: 0, newProviderRequests: 0, statutory45xEligibilityVerified: false,
  marginSourceClaimBindings: marginEnvelope.claims.length, productionEligible: false };
const reportPath = `${dir}/report.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
writeFileSync(`${outputRoot}/latest.json`, JSON.stringify({ reportPath, freezePath }, null, 2) + "\n");
console.log(JSON.stringify({ reportPath, freezePath, cases: cases.length,
  targetMatches: report.operatingDriverTargetMatches, originalQualifiedIssuers: 0,
  results: cases.map((c: any) => ({ id: c.id, status: c.status, operatingPerturbation: c.operatingPerturbation,
    fcfeGrowth: c.fcfeGrowth, error: c.error })) }));
