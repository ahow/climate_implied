/** Read-only source/binding audit; emits public hashes/labels, never private rows. */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import warnings from "../docs/S16-013-warning-resolution-register.json";
import references from "../server/calculation/data/catReferences.json";
import { ALL_COMMITMENTS_LABEL, hasReviewedAllCommitmentsLabel } from "../shared/referenceScenarioLabels";
import { bindNestedOutput } from "../shared/outputFieldSemantics";

const sha = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
const read = (path: string) => readFileSync(path, "utf8");
async function main() {
  const testLog = read("generated-artifacts/warning-pathway-label-tests.tap");
  const counts = {
    tests: Number(testLog.match(/^# tests (\d+)$/m)?.[1]),
    pass: Number(testLog.match(/^# pass (\d+)$/m)?.[1]),
    fail: Number(testLog.match(/^# fail (\d+)$/m)?.[1]),
  };
  assert.deepEqual(counts, { tests: 6, pass: 6, fail: 0 });
  assert.equal(read("generated-artifacts/warning-pathway-label-types.log").trim(), "", "typecheck must be clean before a success receipt");
  const original = execFileSync("git", ["grep", "-l", "-i", "-E", warnings.scanPattern,
    warnings.originalSourceRevision, "--", "client/src"], { encoding: "utf8" })
    .trim().split("\n").map(line => line.slice(line.indexOf(":") + 1)).sort();
  assert.deepEqual(original, warnings.originalHosts.map(host => host.path).sort());
  const hosts = warnings.originalHosts.map(host => ({
    path: host.path,
    originalSha256: sha(execFileSync("git", ["show", `${warnings.originalSourceRevision}:${host.path}`])),
    currentSha256: sha(read(host.path)), disposition: host.disposition,
    resolution: "resolution" in host ? host.resolution : null,
  }));
  const response = await fetch("http://127.0.0.1:5000/api/reference-scenarios");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, references, "actual API serves the reviewed reference, not an NDC replacement");
  assert.ok(hasReviewedAllCommitmentsLabel(body.scenarios[1]));
  const bindings = bindNestedOutput("publishedReference", body);
  const workplanPath = "attached_assets/Climate_Dashboard_—_Developer_Work_Plan_(1)_1794135026111.docx";
  const sourcePaths = [
    "docs/Developer_Workplan_Amendments.md", "docs/S16-013-warning-resolution-register.json",
    "shared/referenceScenarioLabels.ts", "client/src/components/published-scenario-references.tsx",
    "server/calculation/nativePathwayContract.ts", "server/calculation/data/catReferences.json",
    "server/calculation/historicalMetrics.ts", "script/warning-and-pathway-label-contracts.test.ts",
    "script/reference_gas_infill.py", "script/fair_native_bridge.py", "script/audit-warning-pathway-labels.ts",
  ];
  console.log(JSON.stringify({
    criteria: { "S16-013": warnings.requirement, "S06-009": "No NDC-only pathway is labelled “all commitments”." },
    writtenContract: { path: workplanPath, sha256: sha(readFileSync(workplanPath)),
      bindingAmendments: "docs/Developer_Workplan_Amendments.md",
      decisionD1: "National targets plus long-term net-zero targets; corporate targets excluded" },
    originalSourceRevision: warnings.originalSourceRevision, originalWarningHosts: hosts,
    removedWarningBindings: warnings.removedWarnings.length, linkedResolutionRecords: warnings.resolutions.length,
    scanCommand: `git grep -l -i -E '${warnings.scanPattern}' ${warnings.originalSourceRevision} -- client/src`,
    api: { path: "/api/reference-scenarios", httpStatus: response.status,
      version: body.version, sourceWorkbookSha256: body.source.sha256,
      bodySha256: sha(JSON.stringify(body)), semanticsBoundLeaves: bindings.length,
      labels: body.scenarios.map((scenario: any) => ({
        id: scenario.id, label: scenario.label, originalPublishedName: scenario.publishedName,
      })), allCommitmentsLabel: ALL_COMMITMENTS_LABEL },
    actualLabelAndExportPaths: [
      { path: "server/routes.ts: GET /api/reference-scenarios", state: "reviewed CAT full-commitments definition; raw JSON export retains name/definition/source/licence" },
      { path: "client/src/components/published-scenario-references.tsx", state: "card/table label shared; NDC-only, missing and contradictory identities withheld" },
      { path: "client/src/pages/methodology.tsx", state: "CAT optimistic net-zero-pledge case is conditional; NGFS NDCs explicitly excludes long-term net-zero" },
      { path: "server/calculation/nativePathwayContract.ts: validateNativePair", state: "NDC-only commitments refused; successful diagnostic remains accounting-valid-not-scientifically-promoted" },
      { path: "script/fair_native_bridge.py", state: "NDC-only commitments refusal preserved; protected engine not executed" },
      { path: "script/reference_gas_infill.py", state: "exports Nationally Determined Contributions (NDCs) under original name and allCommitmentsAvailable=false; no full-commitments relabel" },
    ],
    focusedVerification: { command: "npx tsx --test script/warning-and-pathway-label-contracts.test.ts",
      ...counts,
      exactCases: ["reviewed CAT API/UI/JSON binding and genuine-zero SSR", "eight invalid/missing NDC/net-zero-label SSR variants",
        "retained pre-fix validator admits NDC-only poison; corrected actual SSR withholds",
        "native calculation and serialized response refusal/unpromoted distinction",
        "12 actual historical hosts + three linked removals + independent summary-preview qualification",
        "actual fixed5Gt no-crossing/final-year calculator + preserved physical/valuation warning SSR"] },
    verificationArtifacts: {
      tests: { path: "generated-artifacts/warning-pathway-label-tests.tap",
        sha256: sha(read("generated-artifacts/warning-pathway-label-tests.tap")) },
      typecheck: { command: "npx tsc --noEmit --pretty false", exitCode: 0,
        path: "generated-artifacts/warning-pathway-label-types.log",
        sha256: sha(read("generated-artifacts/warning-pathway-label-types.log")) },
      preview: { path: "generated-artifacts/warning-pathway-label-preview.jpg",
        sha256: sha(readFileSync("generated-artifacts/warning-pathway-label-preview.jpg")),
        scope: "Existing desktop initial preview; no interactive or unchanged all-route harness rerun" },
      earlierTypecheckFailure: { path: "/tmp/s16-s06-warning-label-types.log",
        disposition: "Three Stage10-owned Set-iteration errors were reported without editing that worker's files. Final typecheck is now clean." },
    },
    residuals: [
      ...warnings.residuals,
      "Original per-run runtime warning payloads are not reconstructed from current data.",
      "Complete native all-commitments production input/readiness is not established; that is not an additional acceptance condition for this negative labelling criterion.",
      "No protected climate engine, broad unchanged UI harness, production deployment or callback executed.",
    ],
    sourceSha256: Object.fromEntries(sourcePaths.map(path => [path, sha(read(path))])),
  }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
