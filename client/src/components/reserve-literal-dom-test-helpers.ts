import assert from "node:assert/strict";

const phrasingOnly = new Set(["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "a", "button", "label", "strong", "em", "code", "pre"]);
const blockTags = new Set(["ol", "ul", "li", "dl", "dt", "dd", "div", "section", "table", "p"]);
const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** Inspect unparsed SSR markup: a browser HTML parser would auto-close a <p>
 * and conceal the original invalid nesting. This checks the emitted structure
 * directly, including every nested array/object ReserveLiteral branch. */
export function assertNoLiteralBlockInPhrasingContainer(html: string) {
  const stack: string[] = [];
  for (const match of Array.from(html.matchAll(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi))) {
    const tag = match[1].toLowerCase();
    if (match[0].startsWith("</")) {
      const last = stack.pop();
      assert.equal(last, tag, `SSR markup must close ${last} before ${tag}`);
    } else {
      if (blockTags.has(tag)) {
        const invalidAncestor = stack.find(ancestor => phrasingOnly.has(ancestor));
        assert.equal(invalidAncestor, undefined, `<${tag}> must not descend from phrasing-only <${invalidAncestor}>`);
      }
      if (!voidTags.has(tag) && !match[0].endsWith("/>")) stack.push(tag);
    }
  }
  assert.equal(stack.length, 0, "SSR markup must close all containers");
}
