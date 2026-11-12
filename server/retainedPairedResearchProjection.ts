import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { contentHash } from "./calculation/analysisManifest";
import { corpusSchema, specificationKey } from "./calculation/pairedResearchCorpus";
import { runPairedResearchPipeline, type PairedResearchProtocol } from "./calculation/pairedResearchPipeline";
import {
  retainedPairedReportSchema, type RetainedPairedSection,
} from "../client/src/components/retained-paired-research-contract";

// Fixed source domain, never a request-supplied path. Hashes are code identity,
// not a claim that dependencies or historical runtime have been authenticated.
export const pairedProjectionModules = [
  "server/calculation/pairedResearchPipeline.ts", "server/calculation/pairedResearchCorpus.ts",
  "server/calculation/pairedCompanyGap.ts", "server/calculation/researchFamily.ts",
  "server/calculation/pairedResearchSleeves.ts", "server/calculation/pairedResearchEvents.ts",
  "server/calculation/pairedResearchLongOnly.ts", "server/calculation/pairedResearchFrequency.ts",
  "server/calculation/trackBAdmission.ts", "server/climateValuation/walkForward.ts",
  "server/retainedPairedResearchProjection.ts",
] as const;
const unavailable = (reason: string): RetainedPairedSection => ({ status: "unavailable", reason });
const qualification = "Descriptive retained pipeline output only; no authenticated historical efficacy, scientific acceptance or investment evidence.";
function metrics(label: string, values: Array<[string, number, string]>, notes: string[] = [qualification]): RetainedPairedSection {
  return values.length ? { status: "available", label,
    metrics: values.map(([label, value, unit]) => ({ label, value, unit, qualification })), notes }
    : unavailable(`${label}: no retained numerical output`);
}
function inference(label: string, input: unknown): RetainedPairedSection {
  const value = input as { unavailable?: string; estimate?: number; improvement95?: number[]; oneSidedP?: number } | undefined;
  if (value?.unavailable) return unavailable(value.unavailable);
  if (!value || typeof value.estimate !== "number" || !value.improvement95 || typeof value.oneSidedP !== "number")
    return unavailable(`${label}: no retained inference`);
  return metrics(label, [
    ["estimate", value.estimate, "dimensionless"], ["lower 95% block interval", value.improvement95[0], "dimensionless"],
    ["upper 95% block interval", value.improvement95[1], "dimensionless"], ["one-sided p", value.oneSidedP, "probability"],
  ]);
}

/** Offline producer. Always executes the actual frozen paired pipeline. Neither
 * caller-provided result objects nor review/approval inputs are accepted. */
export async function buildRetainedPairedResearch(protocolInput: unknown, protocolHash: string, corpusInput: unknown) {
  const pipeline = runPairedResearchPipeline(protocolInput, protocolHash, corpusInput);
  const p = protocolInput as PairedResearchProtocol, c = corpusSchema.parse(corpusInput);
  const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
  const codeEntries = await Promise.all(pairedProjectionModules.map(async module => ({
    module, hash: createHash("sha256").update(await readFile(resolve(sourceRoot, module))).digest("hex"),
  })));
  const report = retainedPairedReportSchema.parse({
    contract: "retained-paired-research-report-1", producer: "paired-research-pipeline",
    classification: c.mode === "engineering-fixture" ? "engineering-fixture" : "retained-research",
    protocolHash, pipelineResultHash: contentHash(pipeline), corpusHash: pipeline.corpusHash,
    disclosure: pipeline.disclosure,
    protocol: Object.fromEntries([
      "evidenceMode", "frozenAt", "evaluationStart", "evaluationEnd", "expectedOrigins", "primaryEndpoints",
      "embargoDays", "blockLength", "repetitions", "seed", "currency", "geography", "weighting", "costBps",
    ].map(key => [key, p[key as keyof PairedResearchProtocol]])),
    originDomain: pipeline.trackBAdmission.periods.map(period => ({
      specification: period.specification, origin: period.origin,
      informationCutoff: period.informationCutoff, executionAt: period.executionAt, endAt: period.endAt,
      missingReasons: period.reasons.map(reason => `${reason.code}: ${reason.detail}`),
    })),
    sourceContext: {
      qualification: "Retained corpus hash/vintage metadata only, not source authentication; no payloads, provider URLs or issuer-level records are public.",
      sources: c.artifacts.map(({ hash, availableAt, capturedAt, vintage }) => ({ hash, availableAt, capturedAt, vintage })),
      missingReasons: ["Caller-supplied source and vintage claims are not independently authenticated.",
        ...(c.artifacts.length ? [] : ["No retained source artifacts"])],
    },
    codeContext: {
      qualification: "SHA256 of the fixed producer module bytes at offline projection time, not an authenticated historical runtime or complete dependency attestation.",
      entries: codeEntries, missingReasons: ["Historical runtime and transitive dependency verification not retained."],
    },
    tracks: {
      A: !c.periods.length ? unavailable("No retained origin periods; Track A calculation unavailable")
        : c.mode === "revised-history" || c.mode === "engineering-fixture"
        ? metrics(c.mode === "engineering-fixture"
          ? "Engineering-only revised-history calculation; not historical Track A evidence"
          : pipeline.tracks.A, [["retained specification count", pipeline.specifications.length, "count"]])
        : unavailable(pipeline.tracks.A),
      B: unavailable([pipeline.tracks.B, ...Array.from(new Set(pipeline.trackBAdmission.periods.flatMap(period =>
        period.reasons.map(reason => `${reason.code}: ${reason.detail}`))))].join("; ")),
      prospective: unavailable(pipeline.tracks.prospective),
    },
    specifications: pipeline.specifications.map(s => {
      const primary = s.trajectories[0];
      const longOnly = s.longOnly as { unavailable?: string; result?: { series: unknown[]; annualizedTE: number; lastTilt: number } };
      const factorValues = Object.entries(s.attribution).flatMap(([name, value]) => {
        const v = value as { estimate?: number };
        return typeof v.estimate === "number" ? [[`${name} alpha estimate`, v.estimate, "return fraction"] as [string, number, string]] : [];
      });
      const completeVariants = s.trajectories.filter(t => !t.error && t.accounting.length > 0);
      const robustnessValues: Array<[string, number, string]> = completeVariants.map(t => [
        `${t.label}: compounded net return`, t.accounting.reduce((nav, row) => nav * (1 + row.netReturn), 1) - 1, "return fraction",
      ]);
      for (const [name, value] of Object.entries(s.ablations)) {
        const v = value as { mse: number; controlsOnlyMse: number };
        robustnessValues.push([`${name} MSE`, v.mse, "squared return"], [`${name} controls-only MSE`, v.controlsOnlyMse, "squared return"]);
      }
      return {
        model: s.model, peer: s.peer, target: s.target, originCount: s.originCount,
        trainingDates: s.trainingDates, evaluationDates: s.evaluationDates, missing: s.missing,
        endpoints: Object.fromEntries(p.primaryEndpoints.map(endpoint => [endpoint, inference(endpoint, s.endpoints[endpoint])])),
        longOnly: longOnly.unavailable ? unavailable(longOnly.unavailable) : longOnly.result?.series.length
          ? metrics("Existing long-only tilt kernel, not long-short evidence", [
            ["observations", longOnly.result.series.length, "count"], ["annualized tracking error", longOnly.result.annualizedTE, "return fraction"],
            ["last tilt", longOnly.result.lastTilt, "dimensionless"],
          ]) : unavailable("No retained long-only kernel output"),
        longShort: !primary || primary.error || !primary.accounting.length
          ? unavailable(primary?.error ?? "No complete retained long-short accounting")
          : metrics("Separate explicit long-short cash ledger", [
            ["observations", primary.accounting.length, "count"],
            ["compounded net return", primary.accounting.reduce((nav, row) => nav * (1 + row.netReturn), 1) - 1, "return fraction"],
            ["trading cost sum", primary.accounting.reduce((sum, row) => sum + row.tradingCost, 0), "per-period start NAV units"],
          ], [qualification, primary.accounting.some(row => row.hypothetical)
            ? "Borrow history absent: hypothetical accounting only." : "Retained explicit borrow inputs; not independently authenticated."]),
        factorAdjusted: factorValues.length ? metrics("Separate dated factor attribution", factorValues)
          : unavailable((s.endpoints["after-cost-long-short"] as { unavailable?: string })?.unavailable ?? "No retained dated factor attribution"),
        robustness: metrics(`Separate frozen sensitivities and ablations: ${specificationKey(s)}`, robustnessValues,
          [qualification, ...s.trajectories.filter(t => t.error).map(t => `${t.label}: ${t.error}`)]),
      };
    }),
    limitations: pipeline.limitations, efficacy: pipeline.efficacy,
    scientificAcceptance: false, investmentEvidence: false, authenticityVerified: false,
  });
  return { pipeline, report };
}
