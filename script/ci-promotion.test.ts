import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("deployment branch advances only after complete CI validation", () => {
  const ci = readFileSync(".github/workflows/validation.yml", "utf8");
  assert.match(ci, /promote:[\s\S]*needs: validate/);
  assert.match(ci, /github\.event_name == 'push'/);
  assert.match(ci, /refs\/heads\/main/);
  assert.match(ci, /contents: write/);
  assert.match(ci, /git push origin.*refs\/heads\/production-validated/);
  assert.match(ci, /uv run python -m unittest/);
  assert.match(ci, /npm run check/);
  assert.match(ci, /npm run build/);
  assert.doesNotMatch(ci, /--force/);
});
test("negative control exercises the same validate dependency without broken source", () => {
  const ci = readFileSync(".github/workflows/validation.yml", "utf8");
  assert.match(ci, /workflow_dispatch:[\s\S]*negative_control:[\s\S]*type: boolean/);
  assert.match(ci, /name: Deliberate negative validation control[\s\S]*inputs\.negative_control\s+run: exit 1/);
  const promotion = ci.slice(ci.indexOf("  promote:"));
  assert.match(promotion, /needs: validate/);
  assert.match(promotion, /github\.event_name == 'workflow_dispatch' && inputs\.negative_control/);
  assert.doesNotMatch(promotion, /always\(\)|continue-on-error/);
});
