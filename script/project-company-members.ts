/** Explicit inputs only; no automatic identity approval or missing-data defaults. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { projectCompanyMembers } from "../server/calculation/companyProjection";
const inputFile = process.argv[2];
if (!inputFile) throw new Error("Usage: npx tsx script/project-company-members.ts company-member-input.json");
const result = projectCompanyMembers(JSON.parse(await readFile(inputFile, "utf8")));
if (result.status !== "conditional-projection") {
  console.log(JSON.stringify(result));
  process.exitCode = 2;
} else {
  const directory = "generated-artifacts/company-projections";
  await mkdir(directory, { recursive: true });
  const file = `${directory}/${result.inputHash}.json`;
  await writeFile(file, JSON.stringify(result), { flag: "wx" });
  console.log(JSON.stringify({ file, inputHash: result.inputHash, members: result.members.length,
    unavailableGrowth: result.members.filter(m => m.growth === null).length, claim: result.claim }));
}
