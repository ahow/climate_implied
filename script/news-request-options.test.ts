import { test } from "node:test";
import assert from "node:assert/strict";
import { newsMonthWindow } from "../server/newsApi/requestOptions";

test("missing month defaults to a valid 12-month window", () => {
  assert.equal(newsMonthWindow(undefined), 12);
});
test("invalid and structured queries use the default rather than NaN", () => {
  for (const value of ["", " ", "undefined", "NaN", "foo", "6x", "1.5", null, ["6"], {}, "Infinity"])
    assert.equal(newsMonthWindow(value), 12);
});
test("supported integer month windows are retained", () => {
  for (const value of ["1", "6", "12", "24"])
    assert.equal(newsMonthWindow(value), Number(value));
});
test("out-of-range integer month windows are bounded", () => {
  assert.equal(newsMonthWindow("0"), 1);
  assert.equal(newsMonthWindow("-1"), 1);
  assert.equal(newsMonthWindow("25"), 24);
});
