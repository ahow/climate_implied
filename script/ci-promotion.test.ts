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
