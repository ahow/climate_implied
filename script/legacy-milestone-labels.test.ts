import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

test("legacy positive-emissions thresholds are not advertised as net zero or Paris-aligned", () => {
  const gauge = readFileSync("client/src/components/temperature-gauge.tsx", "utf8");
  const chart = readFileSync("client/src/components/emissions-chart.tsx", "utf8");
  const toggle = readFileSync("client/src/components/metric-toggle.tsx", "utf8");
  assert.doesNotMatch(gauge, />Projected Net-Zero Year<|>Net-Zero Year<|"Never"|1\.5°C aligned/);
  assert.doesNotMatch(chart, /Net-Zero Threshold/);
  assert.doesNotMatch(toggle, /label: "Net-Zero Year"/);
  assert.match(gauge, /Positive-emissions threshold, not net zero/);
  assert.match(chart, /not net zero/);
  assert.match(chart, /fixed-5gt-v1 comparator is a positive-emissions threshold/);
  assert.match(chart, /not net zero or a 5%-of-2024 threshold/);
  assert.match(chart, /unverified model assumption, not a source-evidenced inventory/);
});
