import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as XLSX from "xlsx";
import { calculateThresholdDiagnostic, selectedTrajectoryThresholdContext, type ThresholdContext } from "../server/calculation/thresholdDiagnostic";
import { historicalTrajectoryMetrics } from "../server/calculation/historicalMetrics";
import { thresholdDiagnosticDisplay, THRESHOLD_DIAGNOSTIC_LABEL } from "../shared/thresholdDiagnostic";
import { thresholdExportRow } from "../client/src/lib/threshold-export";
import { selectedRequest } from "../client/src/lib/analysis-selection";

// Engineering fixtures only, not observational baselines or scientific validation.
const basis = { selectionId: "selected-A", trajectoryId: "path-A", memberId: "p50",
  gasBasis: "aggregate-GHG-GtCO2e-legacy", unit: "GtCO2e" };
const context: ThresholdContext = { basis,
  baseline2024: { ...basis, year: 2024, value: 100, evidenceId: "engineering-fixture-A-2024" } };
const trajectory = (last = 5) => Array.from({ length: 11 }, (_, i) =>
  ({ year: 2024 + i, p50: i === 10 ? last : 100 - 9 * i }));

test("selected evidenced 2024 baseline, not fixed 5 Gt or starting-year borrowing, determines threshold", () => {
  const rows = trajectory(4);
  const a = calculateThresholdDiagnostic(rows, context);
  assert.equal(a.thresholdValue, 5);
  assert.equal(a.year, 2034);
  assert.equal(a.status, "reached");
  const doubled = rows.map(r => ({ ...r, p50: r.p50 * 2 }));
  const b = calculateThresholdDiagnostic(doubled, { ...context,
    baseline2024: { ...context.baseline2024!, value: 200 } });
  assert.equal(b.thresholdValue, 10);
  assert.equal(b.year, a.year);
  const legacy = historicalTrajectoryMetrics(doubled, { ...context,
    baseline2024: { ...context.baseline2024!, value: 200 } });
  assert.equal(legacy.netZeroYear, null);
  assert.equal(legacy.legacyFixed5Gt.version, "fixed-5gt-v1");
  assert.equal(legacy.thresholdDiagnostic.year, 2034);
  // An evidenced same-basis 2024 point can support a later-starting path;
  // its starting value must never replace that 2024 baseline.
  assert.equal(calculateThresholdDiagnostic(rows.slice(2), context).thresholdValue, 5);
});

test("exact <= boundary and final year count; above-threshold endpoint is right-censored without extrapolation", () => {
  const exact = calculateThresholdDiagnostic(trajectory(5), context);
  assert.equal(exact.year, 2034);
  assert.equal(exact.horizonYear, 2034);
  assert.equal(calculateThresholdDiagnostic(trajectory(5 + Number.EPSILON * 8), context).year, null);
  const censored = calculateThresholdDiagnostic(trajectory(5.01), context);
  assert.equal(censored.status, "right-censored");
  assert.equal(thresholdDiagnosticDisplay(censored), "Not reached by 2034");
  assert.equal(censored.thresholdValue, 5);
  const rebound = trajectory(50);
  rebound[8].p50 = 5;
  assert.equal(calculateThresholdDiagnostic(rebound, context).year, 2032,
    "requested first reach is not silently replaced by a durable-crossing rule");
  const to2100 = Array.from({ length: 77 }, (_, i) => ({ year: 2024 + i, p50: i === 0 ? 100 : 6 }));
  assert.equal(calculateThresholdDiagnostic(to2100, context).status, "right-censored");
  assert.equal(thresholdDiagnosticDisplay(calculateThresholdDiagnostic(to2100, context)), "Not reached by 2100");
  to2100[76].p50 = 5;
  assert.equal(calculateThresholdDiagnostic(to2100, context).year, 2100);
});

test("missing, invalid, inconsistent or borrowed baseline withholds; all same-basis identities are checked", () => {
  const missing = calculateThresholdDiagnostic(trajectory());
  assert.equal(missing.status, "withheld");
  assert.equal(missing.year, null);
  assert.equal(missing.thresholdValue, null);
  assert.equal(thresholdDiagnosticDisplay(missing), "Withheld — 2024 baseline unavailable");
  for (const key of ["selectionId", "trajectoryId", "memberId", "gasBasis", "unit"] as const) {
    const mismatch = { ...context, baseline2024: { ...context.baseline2024!, [key]: "another-basis" } };
    assert.equal(calculateThresholdDiagnostic(trajectory(), mismatch).status, "withheld", key);
  }
  for (const value of [0, -1, NaN, Infinity, 99]) {
    assert.equal(calculateThresholdDiagnostic(trajectory(), { ...context,
      baseline2024: { ...context.baseline2024!, value } }).status, "withheld");
  }
  assert.equal(calculateThresholdDiagnostic(trajectory(), { ...context,
    baseline2024: { ...context.baseline2024!, evidenceId: "" } }).status, "withheld");
  assert.throws(() => calculateThresholdDiagnostic([]), /consecutive/);
  assert.throws(() => calculateThresholdDiagnostic([{ year: 2024, p50: NaN }]), /finite/);
  assert.throws(() => calculateThresholdDiagnostic([{ year: 2024, p50: 1 }, { year: 2026, p50: 1 }]), /consecutive/);
});

test("a generated/default2024 trajectory or self-hash never authenticates baseline input provenance", () => {
  const rows = trajectory();
  const outputOnly = selectedTrajectoryThresholdContext(rows, "selected-model-inputs", "model-path");
  assert.equal(outputOnly.baseline2024, null);
  assert.equal(calculateThresholdDiagnostic(rows, outputOnly).status, "withheld");
  assert.equal(calculateThresholdDiagnostic(rows, {
    basis: outputOnly.basis, baseline2024: { ...outputOnly.basis, year: 2024, value: 100,
      evidenceId: `selected-model-trajectory-sha256:${"a".repeat(64)}` },
  }).status, "withheld", "Previously self-authenticated v1 output-hash contexts cannot reactivate the new diagnostic");
  const explicitInput = { ...outputOnly.basis, year: 2024 as const, value: 100,
    evidenceId: "engineering-explicit-captured-model-initial-condition-input-not-an-observation" };
  const captured = selectedTrajectoryThresholdContext(rows, "selected-model-inputs", "model-path", explicitInput);
  const diagnostic = calculateThresholdDiagnostic(rows, captured);
  assert.equal(diagnostic.status, "reached");
  assert.equal(diagnostic.thresholdValue, 5);
  assert.equal(diagnostic.baselineEvidenceId, explicitInput.evidenceId);
});

test("selection requests carry immutable indicator identity; diagnostic is a pure selected-input function", () => {
  const selection = { workbook: "a".repeat(64), indicators: "b".repeat(64) };
  const req = selectedRequest("/api/projection", selection);
  assert.equal(new URL(req.url, "http://test.invalid").searchParams.get("indicatorSnapshotId"), selection.indicators);
  const before = JSON.stringify({ rows: trajectory(), context });
  const diagnostic = calculateThresholdDiagnostic(trajectory(), context);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(diagnostic))), JSON.stringify(diagnostic));
  assert.equal(JSON.stringify({ rows: trajectory(), context }), before);
  const implementation = readFileSync("server/calculation/thresholdDiagnostic.ts", "utf8");
  assert.doesNotMatch(implementation, /getCurrentIndicators|getAllHistorical|fetch\(|storage\.|Date\.now/);
});

test("XLSX keeps year and threshold numeric, withheld/censored cells blank and statuses distinct", () => {
  const diagnostics = [
    calculateThresholdDiagnostic(trajectory(5), context),
    calculateThresholdDiagnostic(trajectory(5.01), context),
    calculateThresholdDiagnostic(trajectory(5)),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diagnostics.map(d => thresholdExportRow(d))), "Diagnostic");
  const restored = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(restored.Sheets.Diagnostic, { defval: null });
  assert.equal(rows[0][THRESHOLD_DIAGNOSTIC_LABEL], 2034);
  assert.equal(rows[0]["Threshold value"], 5);
  assert.equal(rows[0]["Selected 2024 baseline"], 100);
  assert.equal(rows[0]["Baseline evidence"], context.baseline2024!.evidenceId);
  assert.equal(rows[1][THRESHOLD_DIAGNOSTIC_LABEL], null);
  assert.equal(rows[1].Status, "right-censored");
  assert.equal(rows[2][THRESHOLD_DIAGNOSTIC_LABEL], null);
  assert.equal(rows[2]["Threshold value"], null);
  assert.equal(rows[2].Status, "withheld");
  assert.equal(rows[0].Version, "selected-2024-five-percent-v2");
});

test("rendered gauge uses exact diagnostic label and no time-based verdict or implicit legacy fallback", async () => {
  // Existing TSX files use the Vite JSX runtime in the app; expose React for Node SSR.
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
  const { TemperatureGauge } = await import("../client/src/components/temperature-gauge");
  const props = { temperature: 2.4, p10: 2, p90: 3, reductionRate: 2, netZeroYear: 2050,
    metricView: "netZero" as const };
  const missing = renderToStaticMarkup(React.createElement(TemperatureGauge, props));
  assert.match(missing, /Year emissions reach 5% of 2024/);
  assert.match(missing, /Withheld/);
  assert.doesNotMatch(missing, /On Track|On track|Delayed|Never|2100\+/);
  const reached = renderToStaticMarkup(React.createElement(TemperatureGauge, { ...props,
    thresholdDiagnostic: calculateThresholdDiagnostic(trajectory(), context) }));
  assert.match(reached, /2034/);
  assert.match(reached, /fixed-5gt-v1/);
  assert.match(reached, /engineering-fixture-A-2024/);
  assert.doesNotMatch(reached, /On Track|On track|Delayed/);
});
