import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { driverEvidenceRegistry } from "../server/calculation/driverEvidence";
import { contentHash } from "../server/calculation/analysisManifest";

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".ts") ? [join(dir, e.name)] : []);
}
const consumers = files("server/calculation").filter(p => !/driverEvidence|historicalIndicators/.test(p));
const fields = ["definition", "publisher", "rawUnit", "transformedUnit", "geography", "category",
  "observationPeriod", "informationAvailableAt", "vintage", "updateCadence", "licence",
  "uncertainty", "overlapGroup", "regionalApplicability", "missingData"] as const;
const rows = driverEvidenceRegistry().map(row => ({
  ...row,
  missingMandatoryValues: fields.filter(f => row[f] == null || row[f] === ""),
  implementationReferences: consumers.flatMap(path => readFileSync(path, "utf8").split("\n")
    .flatMap((line, i) => new RegExp(`\\b${row.id}\\b`).test(line) ? [{ path, line: i + 1 }] : [])),
}));
if (rows.length !== 22 || new Set(rows.map(r => r.id)).size !== 22)
  throw new Error("Driver census does not reconcile");
const report = { rows, centralEligible: rows.filter(r => r.centralModelEligible).length,
  completeMetadata: rows.filter(r => r.missingMandatoryValues.length === 0).length,
  interpretation: "Code references are not evidence of a causal mechanism. Legacy comparators may use context indicators; none is promoted to calibrated central input." };
const hash = contentHash(report);
mkdirSync("generated-artifacts/driver-calibration", { recursive: true });
writeFileSync(`generated-artifacts/driver-calibration/driver-audit-${hash}.json`, JSON.stringify(report, null, 2));
writeFileSync("docs/Driver_Evidence_Audit.md", [
  "# Complete 22-driver evidence census", "",
  `Analytical hash: ${hash}. Code-derived audit; no data approval or scientific promotion.`,
  `Metadata-complete: ${report.completeMetadata}/22; central eligible: ${report.centralEligible}/22.`,
  "An explicit unknown is honest but does not satisfy source-vintage completeness.", "",
  "| Indicator | Role | Missing mandatory values | Implementation references |",
  "|---|---|---|---|",
  ...rows.map(r => `| ${r.id} | ${r.role} | ${r.missingMandatoryValues.join(", ") || "none"} | ${r.implementationReferences.map(x => `${x.path}:${x.line}`).join("; ")} |`),
  "", "## Calibration evidence",
  "- EV: frozen EV_Calibration_Protocol.md; five fits and one unavailable region; India alone passes diagnostic, no central promotion.",
  "- Renewables: Driver_Calibration_Protocol.md; solar/wind generation shares do not calibrate total renewable capacity coefficients.",
  "- Storage: Storage_Adoption_Protocol.md; EIA MW/MWh levels are not a share or a global battery-cost calibration.",
  "- Heat pumps: Heat_Pump_Diffusion_Results.md; window-sensitive levels, unavailable share denominator.",
  "- GDP/carbon intensity: existing Kaya decomposition is revised-history evidence, not independently dated vintages.",
  "- Policy, corporate, finance and survey coefficients lack identified incremental causal effects; remain context.",
  "- Emissions/CO2/budgets are outcome checks or accounting context, not extra abatement multipliers.",
  "", "## Outstanding acceptance",
  "All 22 entries are audited, not accepted as calibrated. Observation-specific dates, vintage and licence evidence must be supplied from reviewed source records. Unknowns are not filled from current fetch time. Legacy comparator references are retained; changing them requires baseline review. Parameter-distribution integration and source-compatible regional mechanisms remain open.", "",
].join("\n"));
console.log(JSON.stringify({ hash, indicators: rows.length, centralEligible: report.centralEligible, completeMetadata: report.completeMetadata }));
