import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { HISTORICAL_INDICATORS } from "../server/calculation/historicalIndicators";
import { shortHorizonEmissions } from "../server/calculation/shortHorizonEmissions";
import { contentHash } from "../server/calculation/analysisManifest";
const observations = HISTORICAL_INDICATORS.map(r => ({ year: r.year, value: r.fossilCO2GtPerYear }));
const protocolId = createHash("sha256").update(await readFile("docs/Short_Horizon_Emissions_Protocol.md")).digest("hex");
const result = { protocolId, sourceHash: contentHash(observations), observations,
  sourceBasis: "existing curated series; not independently authenticated release vintages",
  ...shortHorizonEmissions(observations) };
const directory = "generated-artifacts/short-horizon-emissions";
await mkdir(directory, { recursive: true });
const output = `${directory}/${contentHash(result)}.json`;
const text = JSON.stringify(result, null, 2) + "\n";
try { await writeFile(output, text, { flag: "wx" }); }
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "EEXIST" || await readFile(output, "utf8") !== text) throw error;
}
console.log(JSON.stringify({ output, sourceHash: result.sourceHash, horizons: result.horizons }, null, 2));
