/** MANDATORY private gate, deliberately outside public script/*.test.ts discovery.
 * Both assertion bodies moved verbatim from producerReserve.test.ts.
 * Missing source/freeze/calculation evidence MUST fail, never skip.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { producerReserveDomainHash, producerReserveHash } from "../server/calculation/producerReserveModel";
import { producerReserveFreezeEvidence as freeze } from "../server/calculation/producerReserveFreeze";

test("mandatory retained primary-source validator: no skip, no public-export fallback", () => {
  const result = execFileSync(process.execPath, ["--import", "tsx", "script/producerReserve-validate-private.ts"], { encoding: "utf8" });
  assert.equal(JSON.parse(result).passed, 85);
});

test("original domain freeze predates calculation and exact mechanical source delta is accounted for", () => {
  const bytes = readFileSync("generated-artifacts/producer-reserve/domain-freeze.json");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), freeze.freezeSha256);
  const receipt = JSON.parse(bytes.toString());
  assert.equal(receipt.domainHash, producerReserveDomainHash);
  assert.equal(producerReserveHash(receipt.domain), producerReserveDomainHash);
  const current = readFileSync("server/calculation/producerReserveModel.ts", "utf8");
  assert.equal(createHash("sha256").update(current).digest("hex"), freeze.modelSourceSha256Current);
  const original = current.replace("const unique = Array.from(new Set(roots));", "const unique = [...new Set(roots)];");
  assert.equal(createHash("sha256").update(original).digest("hex"), receipt.sourceFiles["server/calculation/producerReserveModel.ts"]);
  const calculation = JSON.parse(readFileSync("generated-artifacts/producer-reserve/calculation.json", "utf8"));
  assert.ok(Date.parse(receipt.createdAt) < Date.parse(calculation.calculatedAt));
});
