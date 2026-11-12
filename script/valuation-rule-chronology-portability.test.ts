import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

test("S11-041 public chronology tests actually execute in a source-only sandbox without Git or private/generated artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "chronology-public-"));
  try {
    mkdirSync(join(root, "script"));
    mkdirSync(join(root, "docs"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}\n');
    const source = "script/valuation-rule-chronology-evidence.test.ts";
    const record = "docs/valuation-rule-chronology-evidence.json";
    copyFileSync(resolve(source), join(root, source));
    copyFileSync(resolve(record), join(root, record));
    for (const forbidden of [".git", "generated-artifacts", "private", "attached_assets", ".local", "exports",
      "script/validate-valuation-rule-chronology-private.ts"])
      assert.equal(existsSync(join(root, forbidden)), false, forbidden);
    const require = createRequire(import.meta.url);
    const env = { ...process.env, GIT_DIR: join(root, "no-git-history") };
    // Inherited node:test context can suppress a nested runner's TAP entirely.
    // Remove only that runner context; require actual executed/pass/fail counts.
    delete env.NODE_TEST_CONTEXT;
    const run = () => spawnSync(process.execPath, [require.resolve("tsx/cli"), "--test", "--test-reporter=tap", source],
      { cwd: root, env, encoding: "utf8", timeout: 30000 });
    const result = run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const line of ["# tests 3", "# pass 3", "# fail 0", "# skipped 0"])
      assert.ok(result.stdout.includes(line), result.stdout);
    assert.match(result.stdout, /public hash and declared lineage contracts/);
    assert.match(result.stdout, /retains adverse FIRST ANY observation/);
    assert.match(result.stdout, /later paired success cannot repair/);
    // Negative control: an allegedly verified record must fail, not silently skip.
    const altered = JSON.parse(readFileSync(join(root, record), "utf8"));
    altered.conclusion = "verified";
    writeFileSync(join(root, record), JSON.stringify(altered));
    const negative = run();
    assert.notEqual(negative.status, 0, negative.stdout + negative.stderr);
    assert.match(negative.stdout, /not ok .*retains adverse FIRST ANY observation/);
    assert.match(negative.stdout, /# skipped 0/);
    for (const forbidden of [".git", "generated-artifacts", "private", "attached_assets", ".local", "exports"])
      assert.equal(existsSync(join(root, forbidden)), false, forbidden);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
