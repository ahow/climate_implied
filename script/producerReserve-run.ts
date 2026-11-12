import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { producerReserveDomain } from "../server/calculation/producerReserveDomain";
import { producerReserveDomainHash, producerReserveHash, buildPublicProducerReserveReport } from "../server/calculation/producerReserveModel";
import { producerReserveFreezeEvidence } from "../server/calculation/producerReserveFreeze";

const directory = "generated-artifacts/producer-reserve";
const freezeFile = `${directory}/domain-freeze.json`;
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const sourcePaths = ["server/calculation/producerReserveDomain.ts", "server/calculation/producerReserveEvidence.ts",
  "server/calculation/producerReserveModel.ts", "shared/producerReserveSchema.ts"];
if (process.argv[2] === "freeze") {
  mkdirSync(directory, { recursive: true });
  // Refuse replacement; evidence must pre-exist any actual numerical solve.
  writeFileSync(freezeFile, JSON.stringify({ createdAt: new Date().toISOString(), meaning: "Present-run conditional domain freeze, not historical availability or independent approval",
    domain: producerReserveDomain, domainHash: producerReserveDomainHash,
    sourceFiles: Object.fromEntries(sourcePaths.map(path => [path, sha(path)])) }, null, 2), { flag: "wx" });
  console.log(`Frozen domain ${producerReserveDomainHash}; no numerical solve executed.`);
} else if (process.argv[2] === "calculate") {
  const freeze = JSON.parse(readFileSync(freezeFile, "utf8"));
  if (freeze.domainHash !== producerReserveDomainHash || producerReserveHash(freeze.domain) !== producerReserveDomainHash)
    throw new Error("Domain differs from pre-solve freeze");
  for (const path of sourcePaths) {
    if (sha(path) === freeze.sourceFiles[path]) continue;
    // Only one exact mechanical compatibility delta is permitted. Reconstruct frozen bytes
    // and compare to the ORIGINAL receipt, rather than rewriting/refreezing its history.
    const current = readFileSync(path, "utf8");
    const original = current.replace("const unique = Array.from(new Set(roots));", "const unique = [...new Set(roots)];");
    const originalHash = createHash("sha256").update(original).digest("hex");
    if (path !== "server/calculation/producerReserveModel.ts" ||
        sha(path) !== producerReserveFreezeEvidence.modelSourceSha256Current ||
        originalHash !== freeze.sourceFiles[path])
      throw new Error(`Unapproved source changed after freeze: ${path}`);
  }
  const report = buildPublicProducerReserveReport();
  const output = `${directory}/calculation.json`;
  writeFileSync(output, JSON.stringify({ calculatedAt: new Date().toISOString(),
    freezeSha256: sha(freezeFile), mechanicalCompatibilityAddendum: producerReserveFreezeEvidence, report }, null, 2));
  console.log(JSON.stringify({ output, baseResult: report.baseResult,
    sensitivityRows: report.sensitivityRows, reconciliation: report.reconciliation, hashes: report.hashes }, null, 2));
} else {
  throw new Error("Use freeze (before any solve), then calculate");
}
