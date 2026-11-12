import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

test("S16-007 full public source and tests pass without Git history or private/generated evidence", () => {
  const root = mkdtempSync(join(tmpdir(), "methodology-public-source-"));
  try {
    for (const dir of ["client/src", "server", "shared"]) {
      mkdirSync(dirname(join(root, dir)), { recursive: true });
      cpSync(dir, join(root, dir), { recursive: true, filter: path =>
        !/(?:^|\/)(?:\.git|node_modules|__pycache__)(?:\/|$)/.test(path) });
    }
    mkdirSync(join(root, "script"), { recursive: true });
    for (const file of ["package.json", "package-lock.json", "tsconfig.json", "script/methodology-download.test.ts", "script/methodology-download-census.ts",
      "script/download-selection-race.test.ts", "script/producer-download.test.ts", "script/prospective-result-export.test.ts",
      "script/economic-download-contract-audit.ts", "script/export-contract.test.ts", "script/economic-bridge-api.test.ts"])
      cpSync(file, join(root, file));
    for (const file of ["script/derived-consumer.test.ts", "script/prospective-result-export-lifecycle.test.ts",
      "script/operator-prospective-result-export.ts"])
      cpSync(file, join(root, file));
    // Installed package dependencies only; no checkout or evidence dependency.
    symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
    const guard = join(root, "forbid-database.cjs");
    writeFileSync(guard, 'const {Pool}=require("pg"); for(const method of ["connect","query"]) Pool.prototype[method]=function(){throw new Error("Public-source export test attempted forbidden database call: "+method)};');
    assert.equal(existsSync(join(root, ".git")), false);
    for (const path of ["docs", "generated-artifacts", "attached_assets", ".local", "exports"])
      assert.equal(existsSync(join(root, path)), false, path);
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: "postgresql://source-only.invalid:1/no_database",
      GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_DIR: join(root, "no-git-history") };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath,
      ["--require", guard, resolve("node_modules/tsx/dist/cli.mjs"), "--test", "--test-reporter=tap",
        "script/methodology-download.test.ts", "script/download-selection-race.test.ts", "script/producer-download.test.ts",
        "script/prospective-result-export.test.ts", "script/derived-consumer.test.ts",
        "script/prospective-result-export-lifecycle.test.ts", "script/export-contract.test.ts", "script/economic-bridge-api.test.ts"],
      { cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 4_000_000,
        env });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /# tests 63\b/);
    assert.match(result.stdout, /# pass 63\b/);
    assert.match(result.stdout, /# fail 0\b/);
    assert.match(result.stdout, /# skipped 0\b/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
const selectedCustomReportTest = "all five custom retained report paths execute actual HTTP and custom JSON/XLSX projections; no private material in manifest";
function assertSelectedCustomReportExecuted(stdout: string) {
  assert.match(stdout, /^# pass 1$/m);
  assert.match(stdout, /^# fail 0$/m);
  assert.match(stdout, /^# cancelled 0$/m);
  assert.doesNotMatch(stdout, /^not ok /m);
  // Node20 reports name-filter exclusions as SKIP; Node24 omits them.
  // Ignore that bookkeeping, never a skipped/missing/duplicate selected test.
  const executed = stdout.split(/\r?\n/).filter(line =>
    /^ok \d+ - /.test(line) && !/\s+# SKIP(?:\s|$)/i.test(line))
    .map(line => line.replace(/^ok \d+ - /, ""));
  assert.deepEqual(executed, [selectedCustomReportTest]);
}
test("finite custom report HTTP/readback test runs from source only with database calls forbidden", () => {
  const filtered = Array.from({ length: 20 }, (_, index) =>
    `ok ${index + 1} - unselected ${index} # SKIP test name does not match pattern`).join("\n");
  const summary = "# pass 1\n# fail 0\n# cancelled 0\n";
  assertSelectedCustomReportExecuted(`${filtered}\nok 21 - ${selectedCustomReportTest}\n# tests 21\n${summary}# skipped 20\n`);
  assertSelectedCustomReportExecuted(`ok 1 - ${selectedCustomReportTest}\n# tests 1\n${summary}# skipped 0\n`);
  for (const invalid of [
    `ok 1 - ${selectedCustomReportTest} # SKIP\nok 2 - wrong actual test\n${summary}`,
    `ok 1 - ${selectedCustomReportTest}\nok 2 - ${selectedCustomReportTest}\n${summary}`,
    `ok 1 - ${selectedCustomReportTest}\n${summary.replace("# cancelled 0", "# cancelled 1")}`,
    `not ok 1 - ${selectedCustomReportTest}\n${summary}`,
  ]) assert.throws(() => assertSelectedCustomReportExecuted(invalid));
  const root = mkdtempSync(join(tmpdir(), "finite-custom-public-source-"));
  try {
    for (const dir of ["client/src", "server", "shared"]) {
      mkdirSync(dirname(join(root, dir)), { recursive: true });
      cpSync(dir, join(root, dir), { recursive: true });
    }
    for (const file of ["package.json", "package-lock.json", "tsconfig.json",
      "script/legacy-export-producer.test.ts", "script/track-b-admission.test.ts",
      "script/fixtures/isolatedRetainedReports.ts"]) {
      mkdirSync(dirname(join(root, file)), { recursive: true });
      cpSync(file, join(root, file));
    }
    symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
    const guard = join(root, "forbid-database.cjs");
    writeFileSync(guard, 'const {Pool}=require("pg"); for(const method of ["connect","query"]) Pool.prototype[method]=function(){throw new Error("Source-only test attempted forbidden database call: "+method)};');
    for (const path of [".git", "docs", "generated-artifacts", "attached_assets", ".local", "exports"])
      assert.equal(existsSync(join(root, path)), false, path);
    const env: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: "postgresql://source-only.invalid:1/no_database",
      GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_DIR: join(root, "no-git-history") };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, ["--require", guard, resolve("node_modules/tsx/dist/cli.mjs"),
      "--test", "--test-reporter=tap", "--test-name-pattern=all five custom retained report paths",
      "script/legacy-export-producer.test.ts"],
      { cwd: root, env, encoding: "utf8", timeout: 120_000, maxBuffer: 4_000_000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assertSelectedCustomReportExecuted(result.stdout);
    assert.equal(existsSync(join(root, "generated-artifacts")), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
