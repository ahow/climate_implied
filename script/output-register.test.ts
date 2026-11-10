import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { outputRegister } from "./output-register";

test("API, consumer and spreadsheet census is current", () => {
  const report = outputRegister();
  assert.equal(readFileSync("docs/System_Output_Register.md", "utf8"), report,
    "Run npx tsx script/output-register.ts and review changed consumers");
  for (const required of ["/api/projection", "/api/cv/backtest", "/api/reference-scenarios",
    "/api/analysis/results/:id", "temperature-distribution", "news-sentiment.tsx"]) {
    assert.ok(report.includes(required), required);
  }
  assert.ok(!report.includes("| MISSING |"), "Every export needs explicit rows, filename and evidence class");
  assert.ok(report.includes("## Qualified JSON exports"));
  assert.ok(report.includes("company-coverage-${query.data.observationDate}.json"));
  assert.ok(report.includes("Central download-data-button writer"));
});
