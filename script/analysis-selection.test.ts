import test from "node:test";
import assert from "node:assert/strict";
import { parseSelection, selectedRequest, analysisFetch, selectionKey } from "../client/src/lib/analysis-selection";
import { validateCvQuery } from "../server/climateValuation/queryValidation";
const selection = { workbook: "a".repeat(64), indicators: "b".repeat(64) };
test("overlay identities and cutoff travel only on company requests", () => {
  const chosen = { ...selection, overlays: ["c".repeat(64)], asOf: "2020-02-01" };
  assert.equal(new URL(selectedRequest("/api/cv/summary", chosen).url, "https://test.invalid")
    .searchParams.get("overlaySnapshotIds"), chosen.overlays[0]);
  assert.ok(!selectedRequest("/api/projection", chosen).url.includes("overlay"));
  assert.throws(() => parseSelection({ ...chosen, asOf: "2020-02-31" }));
  assert.throws(() => parseSelection({ ...chosen, overlays: [chosen.overlays[0], chosen.overlays[0]] }));
  assert.throws(() => selectedRequest("/api/cv/summary?asOf=2021-01-01", chosen));
});
test("historical selections reach analytical URLs without current upload dependencies", () => {
  for (const path of ["/api/cv/carbon-price?uploadId=123&method=absolute", "/api/cv/backtest", "/api/cv/summary"]) {
    const result = selectedRequest(path, selection), url = new URL(result.url, "https://test.invalid");
    assert.equal(url.searchParams.get("snapshotId"), selection.workbook);
    assert.equal(url.searchParams.get("indicatorSnapshotId"), selection.indicators);
    assert.equal(url.searchParams.has("uploadId"), false);
  }
  assert.equal(selectedRequest("/api/news/climate", selection).url, "/api/news/climate");
  assert.equal(selectedRequest("/api/analysis/results/a", selection).indicators, false);
  assert.equal(selectedRequest("/api/projection", selection).workbook, false);
  assert.throws(() => selectedRequest("/api/projection/regions", selection), /unavailable/);
  assert.throws(() => selectedRequest("/api/cv/summary?snapshotId=" + "c".repeat(64), selection), /conflicts/);
  assert.throws(() => parseSelection({ workbook: selection.workbook, indicators: "" }));
  assert.doesNotThrow(() => validateCvQuery("/carbon-price", { method: "absolute", snapshotId: selection.workbook }));
  assert.throws(() => validateCvQuery("/carbon-price", { method: "absolute" }));
  assert.throws(() => validateCvQuery("/carbon-price", { method: "absolute", snapshotId: "invalid" }));
});
test("historical response identity mismatches fail without returning data", async () => {
  const priorWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalFetch = globalThis.fetch;
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    sessionStorage: { getItem: (key: string) => key === selectionKey ? JSON.stringify(selection) : null },
  } });
  try {
    globalThis.fetch = async () => new Response("{}", { status: 200 });
    await assert.rejects(analysisFetch("/api/cv/summary"), /does not confirm/);
    globalThis.fetch = async () => new Response("{}", { headers: {
      "X-Analysis-Snapshot": selection.workbook, "X-Indicator-Data-State": "archived-approved-indicators",
    } });
    assert.equal((await analysisFetch("/api/cv/summary")).status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    if (priorWindow) Object.defineProperty(globalThis, "window", priorWindow);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
