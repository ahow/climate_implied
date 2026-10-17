/**
 * Manual, pinned reference preparation. Does not modify approved indicators.
 * Source data: © 2025 Climate Analytics and NewClimate Institute.
 * Data reuse is non-commercial only; this restriction does not license our code.
 */
import fs from "node:fs";
import crypto from "node:crypto";
import XLSX from "xlsx";

const file = process.argv[2] ?? "generated-artifacts/ngfs/CAT_2025-11.xlsx";
const bytes = fs.readFileSync(file);
const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
if (sha256 !== "44044cda8f851f77d6ca0eeb0750848fb6ee32bab50939df2cc2363e63a8c6c1")
  throw new Error("CAT workbook changed: review the source and schema before updating the pin");
const workbook = XLSX.read(bytes);
const rows = (name: string) => XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 });
const temperatures = rows("CAT Thermometer");
const emissions = rows("Global Emissions time series");
const info = rows("Info").flat().filter(v => typeof v === "string").join("\n");
if (!info.includes("must not be used for commerical purposes") ||
    temperatures[8]?.[2] !== 45974 || emissions[8]?.[2] !== 45974 ||
    temperatures[14]?.[1] !== "Policies & action" ||
    temperatures[21]?.[1] !== "Optimistic scenario (net-zero pledges)" ||
    String(emissions[15]?.[1]).trim() !== "Policies & action" ||
    emissions[21]?.[1] !== "Optimistic scenario (net-zero pledges)")
  throw new Error("Unexpected source labels, date or licence");
function number(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Missing/nonfinite reference value");
  return value;
}
const data = {
  version: "cat-2025-11-13-v1",
  source: {
    name: "Climate Action Tracker",
    publishedAt: "2025-11-13",
    url: "https://climateactiontracker.org/global/emissions-pathways/",
    workbookUrl: "https://climateactiontracker.org/documents/1349/CAT_2025-11_PublicData_GlobalTemperatureEstimates_COP30.xlsx",
    sha256,
    attribution: "Climate Analytics and NewClimate Institute",
    copyright: "Copyright © 2025 Climate Analytics and NewClimate Institute. All rights reserved.",
    licence: "Non-commercial use only; attribution and copyright notice required.",
  },
  status: "published-external-reference",
  temperatureMetric: "Published median global mean temperature rise in 2100 above pre-industrial levels",
  climateModel: "CAT MAGICC7 — not the dashboard calculation or FaIR",
  emissionsUnit: "GtCO2e/year",
  comparisonCaveat: "Independent published scenarios, not rebased to the dashboard inventory. Emissions ranges describe CAT's low/high policy pathways, not a probability interval. Do not use aggregate CO2e as native-gas input to FaIR.",
  refreshPolicy: "Pinned release; updates require manual source review. Re-run Analysis does not refresh this reference.",
  scenarios: [
    {
      id: "current-policies",
      label: "Current policies",
      publishedName: "Policies & action",
      definition: "Published projection of real-world action under current policies; does not assume all announced targets are achieved.",
      temperatureMedianC: number(temperatures[14][4]),
      emissions: [2030, 2035, 2050, 2100].map(year => {
        const column = emissions[14].indexOf(year);
        const low = number(emissions[16][column]), high = number(emissions[15][column]);
        if (low > high) throw new Error("Reversed policy range");
        return { year, low, high };
      }),
    },
    {
      id: "all-announced-commitments",
      label: "All announced commitments delivered",
      publishedName: "Optimistic scenario (net-zero pledges)",
      definition: "Assumes governments achieve all announced targets, including long-term net-zero announcements and proposals. An optimistic conditional case, not an equally likely forecast.",
      temperatureMedianC: number(temperatures[21][4]),
      emissions: [2030, 2035, 2050, 2100].map(year => ({
        year, value: number(emissions[21][emissions[14].indexOf(year)]),
      })),
    },
  ],
  supportingSources: [
    { name: "IEA World Energy Outlook 2025", role: "Sector-level reference checks: energy, electricity, transport and industry.",
      url: "https://www.iea.org/commentaries/scenarios-in-the-world-energy-outlook-2025",
      caveat: "CPS covers enacted policies; STEPS also assesses policy intentions. WEO 2025 has no updated Announced Pledges Scenario. These are supporting references, not additional model inputs here." },
    { name: "NGFS Phase V, version 5.1", role: "Detailed pathway and model-comparison support.",
      url: "https://doi.org/10.5281/zenodo.17901363",
      caveat: "March 2024 policy/pledge cut-off; NDCs excludes long-term net-zero pledges. Not the main user-facing reference or a replacement for the full-commitments comparison." },
  ],
};
fs.writeFileSync("server/calculation/data/catReferences.json", JSON.stringify(data, null, 2) + "\n");
console.log("Prepared two attributed published CAT reference scenarios; no projection inputs changed.");
