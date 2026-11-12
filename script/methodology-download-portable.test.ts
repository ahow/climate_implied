import test from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, existsSync } from "node:fs";
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
    for (const file of ["package.json", "tsconfig.json", "script/methodology-download.test.ts", "script/methodology-download-census.ts"])
      cpSync(file, join(root, file));
    // Installed package dependencies only; no checkout or evidence dependency.
    symlinkSync(resolve("node_modules"), join(root, "node_modules"), "dir");
    assert.equal(existsSync(join(root, ".git")), false);
    for (const path of ["docs", "generated-artifacts", "attached_assets", ".local", "exports"])
      assert.equal(existsSync(join(root, path)), false, path);
    const env = { ...process.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null", GIT_DIR: join(root, "no-git-history") };
    delete env.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath,
      [resolve("node_modules/tsx/dist/cli.mjs"), "--test", "--test-reporter=tap", "script/methodology-download.test.ts"],
      { cwd: root, encoding: "utf8", timeout: 120_000, maxBuffer: 4_000_000,
        env });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /# tests 6\b/);
    assert.match(result.stdout, /# pass 6\b/);
    assert.match(result.stdout, /# fail 0\b/);
    assert.match(result.stdout, /# skipped 0\b/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
