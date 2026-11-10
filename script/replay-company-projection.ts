/** Local bundle only. No database access or live-source fallback. */
import { readFileSync, writeFileSync } from "node:fs";
import { replayCompanyProjection, exportCompanyProjectionReplay } from "../server/calculation/companyProjectionReplay";
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: tsx script/replay-company-projection.ts bundle.json output-prefix");
const replay = await replayCompanyProjection(JSON.parse(readFileSync(input, "utf8")));
const exported = exportCompanyProjectionReplay(replay);
writeFileSync(`${output}.xlsx`, exported.bytes);
const { bytes, ...identity } = exported;
writeFileSync(`${output}.json`, JSON.stringify({ ...replay, export: identity }, null, 2));
console.log(JSON.stringify({ manifestId: replay.manifestId, resultHash: replay.resultHash, ...identity }));
