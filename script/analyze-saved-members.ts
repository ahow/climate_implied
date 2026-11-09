/**
 * Offline analysis of supplied saved members; never fills missing model runs.
 * npx tsx script/analyze-saved-members.ts attribution|convergence input.json output.json
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { exactMemberAttribution } from "../server/calculation/memberAttribution";
import { checkMemberConvergence } from "../server/calculation/memberConvergence";

const [mode, input, output] = process.argv.slice(2);
if (!["attribution", "convergence"].includes(mode) || !input || !output)
  throw new Error("Usage: analyze-saved-members.ts attribution|convergence input.json output.json");
if (resolve(input) === resolve(output)) throw new Error("Output cannot overwrite input");
const data = JSON.parse(await readFile(input, "utf8"));
const result = mode === "attribution" ? exactMemberAttribution(data) : checkMemberConvergence(data);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, inputHash: result.inputHash, claim: result.claim }));
