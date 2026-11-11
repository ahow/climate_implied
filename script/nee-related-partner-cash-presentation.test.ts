import { test } from "node:test";
import assert from "node:assert/strict";
import { displayedEquityCellValue } from "../server/calculation/neeRelatedPartnerCashPresentation";
test("synthetic visible equity signs are distinct from taxonomy debit/credit signs", () => {
  for (const [html, expected] of [
    ['<td><ix:nonFraction sign="-">5</ix:nonFraction></td>', 5000000],
    ['<td>(<ix:nonFraction>5</ix:nonFraction>)</td>', -5000000]
  ] as const) assert.equal(displayedEquityCellValue(html, html.indexOf("<ix:"), 5000000), expected);
  assert.throws(() => displayedEquityCellValue("<ix:nonFraction>5</ix:nonFraction>", 0, 5));
  assert.throws(() => displayedEquityCellValue("<td>5</td>", 4, NaN));
});
