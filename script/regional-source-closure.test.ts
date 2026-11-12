import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { contentHash, createManifest } from "../server/calculation/analysisManifest";
import { calculationSourceArtifact } from "../server/snapshots/calculationSourceArtifact";
import { verifyLegacyExportMaterial } from "../server/snapshots/legacyExportProducer";
import { CALCULATION_VERSION } from "../shared/calculationContract";

const helper = "shared/regionalCounterfactual.ts";

test("actual regional calculator/export dependency graphs and source identity include the shared helper", async () => {
  for (const entry of ["server/calculation/regionalProjections.ts", "shared/legacyExportConsumer.ts"]) {
    const built = await build({ entryPoints: [entry], bundle: true, packages: "external",
      platform: "node", format: "cjs", write: false, metafile: true, logLevel: "silent" });
    assert.ok(built.metafile.inputs[helper], `${entry} must retain its runtime helper dependency`);
    assert.ok(built.metafile.inputs["shared/quantityDescriptors.ts"]);
  }
  const source = calculationSourceArtifact();
  const payload = structuredClone(source.payload) as { files: Record<string, string> };
  assert.equal(payload.files[helper], readFileSync(helper, "utf8"));
  assert.equal(contentHash(source.payload), source.id);
  const manifest = (codeVersion: string) => createManifest({ codeVersion, modelVersion: CALCULATION_VERSION,
    snapshotHashes: ["1".repeat(64)], scenario: "legacy-export:/api/projection/regions", settings: {} });
  payload.files[helper] += "\n// Isolated identity probe; never written to source or a store.\n";
  const changedId = contentHash(payload);
  assert.notEqual(changedId, source.id);
  assert.notEqual(manifest(changedId).id, manifest(source.id).id,
    "Full producer identity changes even when the numerical model version is unchanged");
});

test("retained regional material refuses absent/corrupt helper and rehashed unsupported code without current-code replay", async () => {
  const source = calculationSourceArtifact();
  for (const fault of ["missing", "corrupt", "rehashed-missing", "rehashed-corrupt"] as const) {
    const archive = structuredClone(source.payload) as { files: Record<string, string> };
    if (fault.includes("missing")) delete archive.files[helper];
    else archive.files[helper] += "\n// Isolated corrupt archive probe.\n";
    const sourceArchive = fault.startsWith("rehashed") ? contentHash(archive) : source.id;
    const inputId = "1".repeat(64);
    const material = { version: "legacy-export-material-1", inputId, sourceArchive,
      path: "/api/projection/regions", model: CALCULATION_VERSION };
    const materialId = contentHash(material);
    const manifest = createManifest({ codeVersion: sourceArchive, modelVersion: CALCULATION_VERSION,
      snapshotHashes: [inputId], scenario: "legacy-export:/api/projection/regions",
      settings: { materialInputsId: materialId } });
    const reads: string[] = [];
    const load = async (id: string, kind: "material-inputs" | "calculation-source") => {
      reads.push(id);
      if (id === materialId && kind === "material-inputs") return structuredClone(material);
      if (id === sourceArchive && kind === "calculation-source") return structuredClone(archive);
      throw new Error("Retained inputs must not be read after invalid code");
    };
    await assert.rejects(() => verifyLegacyExportMaterial(materialId, manifest, [], load),
      fault.startsWith("rehashed") ? /unsupported release/ : /code archive corrupt/, fault);
    assert.ok(!reads.includes(inputId), `${fault}: reject before any full producer replay`);
  }
});
