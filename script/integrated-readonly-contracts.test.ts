import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { integratedReadOnlySurfaceContracts } from "./integrated-readonly-contracts";
import { headlineDrilldownUrl } from "../shared/headlineDrilldown";
import { retainedPairedPinSchema } from "../client/src/components/retained-paired-research-contract";

test("source-located additional API/schema census is exhaustive for the actual wired new routes and export modes", () => {
  const inventory = integratedReadOnlySurfaceContracts();
  assert.deepEqual(inventory.headline.apiPaths,
    ["contributions", "sensitivities"].flatMap(mode => [`/api/headline-drilldown/${mode}`,
      `/api/headline-drilldown/${mode}/export.json`, `/api/headline-drilldown/${mode}/export.xlsx`]));
  assert.deepEqual(inventory.headline.sheetNames, ["Drilldown", "Headline contract"]);
  assert.deepEqual(inventory.retainedPaired.apiPaths,
    ["/api/research/paired-research/catalog", "/api/research/paired-research"]);
  assert.deepEqual(inventory.retainedPaired.catalogFields.filter(field => field.path.startsWith("reports[]."))
    .map(field => field.path.slice("reports[].".length)), Object.keys(retainedPairedPinSchema.shape));
  assert.ok(inventory.retainedPaired.reportFields.some(field =>
    field.path === "originDomain[].informationCutoff" && field.schema.includes("null")));
  for (const status of ["available", "unavailable"]) {
    assert.ok(inventory.retainedPaired.reportFields.some(field =>
      field.path.includes("tracks.B") && field.path.includes(`[${status}]`)));
  }
  for (const field of ["parent", "selection", "derivation", "rows", "scientificAcceptance"])
    assert.ok(inventory.headline.interface.some(entry => entry.path === field));
  for (const field of ["revertedDriverNativeMt", "valueNativeMt", "valueGtCO2e", "memberId"])
    assert.ok(inventory.headline.row.some(entry => entry.path === field));
  for (const [path, digest] of Object.entries(inventory.sourceSha256))
    assert.equal(createHash("sha256").update(readFileSync(path)).digest("hex"), digest, path);
  const selection = { parent: "a".repeat(64), year: 2050 };
  for (const mode of ["contributions", "sensitivities"] as const)
    for (const format of [undefined, "json", "xlsx"] as const)
      assert.ok(headlineDrilldownUrl(mode, selection, format).startsWith(
        `/api/headline-drilldown/${mode}${format ? `/export.${format}` : ""}?parent=${selection.parent}&year=2050`));
  assert.match(inventory.boundary, /not original frozen cohort closure/);
});
