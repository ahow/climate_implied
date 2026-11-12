import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { registerWarmingValidationReferenceRoutes } from "../server/warmingValidationReferenceApi";
import { registerCarbonPassThroughRoutes } from "../server/carbonPassThroughApi";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { staticReferenceContracts, staticReferenceDocument, staticReferenceIdentity, verifyStaticReferenceIdentity,
  type StaticReferenceArchiveReader, type StaticReferenceKey } from "../server/staticReferenceLineage";
import { readCalculationSourceArtifact } from "../server/snapshots/materialInputs";
import { contentHash } from "../server/calculation/analysisManifest";
import { WARMING_VALIDATION_REFERENCE } from "../shared/warmingValidationReference";
import { warmingReferenceExportDocument } from "../shared/warmingValidationReferenceSemantics";
import { getCarbonPassThroughReview } from "../server/calculation/carbonPassThroughAdmission";
import { boundedResultGraphReader, RESULT_GRAPH_LIMITS } from "../server/snapshots/resultVerificationGraph";

const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const source = () => readCalculationSourceArtifact();
const file = (path: string) => readFileSync(path, "utf8");
async function mounted(run: (base: string) => Promise<void>, archive?: StaticReferenceArchiveReader) {
  const app = express();
  app.use(downloadManifestMiddleware());
  registerWarmingValidationReferenceRoutes(app, archive);
  registerCarbonPassThroughRoutes(app, archive);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try { await run(`http://127.0.0.1:${(server.address() as any).port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}
for (const key of Object.keys(staticReferenceContracts) as StaticReferenceKey[]) {
  const contract = staticReferenceContracts[key];
  test(`${key}: actual HTTP default bytes and embedded JSON read back exact public reference plus code artifact, no invented model/material/run`, async () => {
    await mounted(async base => {
      const legacy = await fetch(base + contract.route), body = await legacy.text();
      assert.equal(legacy.status, 200);
      assert.equal(body, JSON.stringify(staticReferenceDocument(key)), "Existing default body bytes remain exact");
      const header = JSON.parse(Buffer.from(legacy.headers.get("X-Download-Manifest")!, "base64url").toString("utf8"));
      const response = await fetch(base + contract.route + "?downloadMetadata=manifest-v1");
      assert.equal(response.status, 200);
      assert.ok(response.headers.get("Content-Disposition")?.includes(".json"));
      const document = await response.json();
      assert.deepEqual(document.data, JSON.parse(body));
      assert.equal(document.manifest.dataIdentity.hash, sha(body));
      assert.equal(document.manifest.producerIdentity, null, "Static reference is not a retained executed producer");
      const identity = document.manifest.referenceArtifactIdentity;
      assert.deepEqual(identity, header.referenceArtifactIdentity);
      assert.equal(identity.key, key);
      assert.equal(identity.claim, contract.claim);
      assert.equal(identity.id, contentHash(Object.fromEntries(Object.entries(identity).filter(([name]) => name !== "id"))));
      assert.deepEqual(identity.model, { applicability: "not-applicable-static-reference", version: null, runId: null });
      assert.deepEqual(identity.materialInputs, { applicability: "not-applicable-no-calculation", id: null });
      assert.deepEqual(identity.orderedInputSnapshotHashes, []);
      assert.equal(identity.scientificAcceptance, false); assert.equal(identity.sourceApproval, false);
      assert.equal(identity.codeArtifact.id, source().id);
      assert.equal(identity.codeArtifact.contract, "calculation-source-1");
      for (const record of identity.codeArtifact.files) assert.equal(record.sha256, sha(file(record.path)));
      assert.equal(identity.dataIdentity.hash, contentHash(document.data));
      assert.equal(identity.sourceDeclarations.length, 2);
      assert.match(identity.sourceBoundary, /no re-download/);
      assert.match(document.manifest.selectionBoundary, /explicitly not applicable/);
      assert.doesNotMatch(JSON.stringify(identity), /"files":\{/);
      await verifyStaticReferenceIdentity(identity, document.data);
      if (key === "warming-validation") {
        assert.deepEqual(document.data, warmingReferenceExportDocument());
        assert.equal(document.data.reference.headline2025.valueC, 1.37);
        assert.equal(document.data.reference.decade.meanC, 1.24);
        assert.equal(document.data.reference.calculationInput, false);
        assert.equal(document.data.reference.modelAcceptance, false);
        assert.equal(identity.referenceArtifact.id, contentHash(WARMING_VALIDATION_REFERENCE));
      } else {
        const review = getCarbonPassThroughReview();
        assert.deepEqual(document.data, review);
        assert.equal(document.data.qualifiedIssuerCases, 0); assert.equal(document.data.issuerStudiesRun, 0);
        assert.equal(document.data.productionEligible, false);
        assert.equal(identity.referenceArtifact.id, contentHash({
          contract: review.contract, sources: review.sources, evidence: review.evidence,
          registerHash: review.registerHash, status: review.status,
        }));
      }
    });
  });
  test(`${key}: missing/corrupt/stale code or reference sources refuse attachment and emit explicit error, not fallback`, async () => {
    for (const fault of ["missing-source", "corrupt-archive", "missing-file", "stale-file", "stale-release-file", "wrong-version"] as const) {
      const archive: StaticReferenceArchiveReader = {
        source: () => {
          if (fault === "missing-source") throw new Error("Engineering missing source fixture");
          const copy = source(), payload = copy.payload as any;
          if (fault === "corrupt-archive") copy.id = "0".repeat(64);
          if (fault === "missing-file") {
            delete payload.files[contract.files[0]]; copy.id = contentHash(payload);
          }
          if (fault === "stale-release-file") {
            payload.files[contract.files[0]] += "\n// isolated stale artifact fixture";
            copy.id = contentHash(payload);
          }
          if (fault === "wrong-version") { payload.version = "unknown-source-version"; copy.id = contentHash(payload); }
          return copy;
        },
        file: path => path === contract.files[0] && fault === "stale-file" ? file(path) + "\nchanged" : file(path),
      };
      await mounted(async base => {
        const response = await fetch(base + contract.route + "?downloadMetadata=manifest-v1");
        assert.equal(response.status, 503, fault);
        assert.equal(response.headers.get("Content-Disposition"), null, fault);
        assert.equal(response.headers.get("X-Download-Manifest"), null, fault);
        assert.equal(response.headers.get("X-Producer-Identity"), null, fault);
        assert.match((await response.json()).error, /missing, stale or corrupt/);
      }, archive);
    }
  });
  test(`${key}: stale document or forged code/reference/model lineage cannot pass readback by self-rehashing`, async () => {
    const document = staticReferenceDocument(key), identity = await staticReferenceIdentity(key, document);
    for (const changed of [
      { ...document, extra: "not the static release" },
      { ...document, reference: { changed: true } },
    ]) await assert.rejects(() => staticReferenceIdentity(key, changed), /document changed or stale/);
    for (const mutation of [
      (value: any) => { value.codeArtifact.id = "f".repeat(64); },
      (value: any) => { value.referenceArtifact.id = "f".repeat(64); },
      (value: any) => { value.model.version = "invented-run"; },
      (value: any) => { value.sourceDeclarations.reverse(); },
    ]) {
      const forged: any = structuredClone(identity); mutation(forged);
      const { id: omitted, ...artifact } = forged; forged.id = contentHash(artifact);
      await assert.rejects(() => verifyStaticReferenceIdentity(forged, document), /identity conflicts/);
    }
  });
  test(`${key}: query/UI source pins cannot supply artifact identity, and unexpected metadata versions refuse`, async () => {
    await mounted(async base => {
      for (const query of ["snapshotId=" + "a".repeat(64), "expectedSourceHash=" + "a".repeat(64),
        "downloadMetadata=manifest-v2", "downloadMetadata=manifest-v1&downloadMetadata=manifest-v1"]) {
        const response = await fetch(base + contract.route + "?" + query);
        assert.equal(response.status, 400);
        assert.equal(response.headers.get("Content-Disposition"), null);
        assert.equal(response.headers.get("X-Download-Manifest"), null);
      }
    });
  });
}
test("static public reference GETs perform no persistence, provider retrieval or private input operations", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    await mounted(async base => {
      for (const contract of Object.values(staticReferenceContracts)) {
        const response = await fetch(base + contract.route + "?downloadMetadata=manifest-v1");
        assert.equal(response.status, 200); assert.ok((await response.json()).manifest.referenceArtifactIdentity);
      }
    });
    const implementation = file("server/staticReferenceLineage.ts");
    assert.doesNotMatch(implementation, /\b(?:captureCalculationSource|saveAnalysisResult|captureMaterialInputs|loadAnalysisResult|loadMaterialArchive)\s*\(/);
    assert.doesNotMatch(implementation, /\b(?:fetch|executeSql)\s*\(/);
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
test("static reference identities do not mutate source values, run issuer studies or introduce warming offsets", async () => {
  const before = JSON.stringify(WARMING_VALIDATION_REFERENCE);
  await staticReferenceIdentity("warming-validation", warmingReferenceExportDocument());
  assert.equal(JSON.stringify(WARMING_VALIDATION_REFERENCE), before);
  assert.equal(Object.isFrozen(WARMING_VALIDATION_REFERENCE.headline2025), true);
  const review = getCarbonPassThroughReview();
  await staticReferenceIdentity("carbon-pass-through-evidence", review);
  assert.deepEqual(getCarbonPassThroughReview(), review);
});
const nodeId = (n: number) => n.toString(16).padStart(64, "0");
test("readonly verification graph memoizes a shared historical DAG once per node, without dropping any dependency", async () => {
  const graph = new Map<string, string[]>(), reads = new Map<string, number>();
  for (let i = 1; i <= 20; i++) graph.set(nodeId(i), i > 2 ? [nodeId(i - 1), nodeId(i - 2)] : []);
  const load = boundedResultGraphReader(async (id, parent) => {
    reads.set(id, (reads.get(id) ?? 0) + 1);
    for (const dependency of graph.get(id)!) await parent(dependency);
    return { id, verified: true };
  });
  assert.equal((await load(nodeId(20))).id, nodeId(20));
  assert.equal(reads.size, 20);
  assert.deepEqual(Array.from(reads.values()), Array(20).fill(1));
});
test("readonly verification graph cycle refuses explicitly before recursion can hang", async () => {
  const load = boundedResultGraphReader(async (id, parent): Promise<string> => {
    await parent(id === nodeId(1) ? nodeId(2) : nodeId(1)); return id;
  });
  await assert.rejects(() => load(nodeId(1)), /dependency cycle/);
});
test("readonly verification graph depth boundary verifies all parents or refuses the whole result", async () => {
  const read = async (id: string, parent: (id: string) => Promise<string>): Promise<string> => {
    const n = parseInt(id, 16); if (n > 1) await parent(nodeId(n - 1)); return id;
  };
  assert.equal(await boundedResultGraphReader(read)(nodeId(RESULT_GRAPH_LIMITS.maxDepth)), nodeId(RESULT_GRAPH_LIMITS.maxDepth));
  await assert.rejects(() => boundedResultGraphReader(read)(nodeId(RESULT_GRAPH_LIMITS.maxDepth + 1)), /budget exceeded/);
});
test("readonly verification graph node budget refuses rather than skipping a wide page dependency", async () => {
  const read = (count: number) => async (id: string, parent: (id: string) => Promise<string>): Promise<string> => {
    if (id === nodeId(1)) for (let i = 2; i <= count; i++) await parent(nodeId(i));
    return id;
  };
  assert.equal(await boundedResultGraphReader(read(RESULT_GRAPH_LIMITS.maxNodes))(nodeId(1)), nodeId(1));
  await assert.rejects(() => boundedResultGraphReader(read(RESULT_GRAPH_LIMITS.maxNodes + 1))(nodeId(1)), /budget exceeded/);
});
test("readonly verification graph is request-local; a missing shared parent on the next request is not cached away", async () => {
  let exists = true;
  const read = async (id: string, parent: (id: string) => Promise<string>): Promise<string> => {
    if (id === nodeId(1)) await parent(nodeId(2));
    else if (!exists) throw new Error("Missing retained source result");
    return id;
  };
  await boundedResultGraphReader(read)(nodeId(1));
  exists = false;
  await assert.rejects(() => boundedResultGraphReader(read)(nodeId(1)), /Missing retained source result/);
});
