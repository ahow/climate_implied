import { readFile, writeFile } from "node:fs/promises";
import { historicalValidation } from "../server/calculation/historicalValidation";
import { compareEnsembles } from "../server/calculation/ensemble";
const ensemble = JSON.parse(await readFile("generated-artifacts/fair-reference/ensemble.json", "utf8"));
// AR6 WGI SPM A.1.2: observed 2011–2020 warming, relative to 1850–1900.
const history = historicalValidation({
  ensemble, simulationKind: "total",
  reference: { source: "https://www.ipcc.ch/report/ar6/wg1/chapter/summary-for-policymakers/",
    kind: "total", baseline: "1850-1900", startYear: 2011, endYear: 2020, lower: .95, upper: 1.20 },
});
const previous = process.argv[2] ? JSON.parse(await readFile(process.argv[2], "utf8")) : null;
const report = { history, reproducibility: previous ? compareEnsembles(ensemble, previous) : null,
  independentReferencePassed: false,
  explanation: "Previous local run comparison tests reproducibility only, not independent validation. Attribution and updated historical forcing remain unvalidated." };
await writeFile("generated-artifacts/fair-reference/historical-validation.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
