import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { insertCvTimeSeriesSchema } from "../shared/schema";

test("developer handover and success criteria have resolving local document links", () => {
  for (const path of ["README.md", "docs/Application_Logic_and_Implementation.md", "docs/Implementation_Success_Criteria.md"]) {
    const content = readFileSync(path, "utf8");
    for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^(https?:|mailto:)/.test(target)) continue;
      assert.ok(existsSync(resolve(dirname(path), target)), `${path}: ${target}`);
    }
  }
});
test("workbook insert validation preserves required fields and excludes generated identities", () => {
  assert.equal(insertCvTimeSeriesSchema.safeParse({}).success, false);
  const parsed = insertCvTimeSeriesSchema.parse({ id: 77, companyId: 1, date: new Date("2020-01-31"), marketCap: 100 });
  assert.equal(parsed.companyId, 1);
  assert.equal(parsed.marketCap, 100);
  assert.equal("id" in parsed, false);
});
