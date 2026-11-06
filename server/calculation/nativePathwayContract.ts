import { z } from "zod";
import inventory from "./data/inventory2024.json";

const pathwaySchema = z.object({
  scenario: z.enum(["implemented-policies", "announced-commitments"]),
  source: z.object({ url: z.string().url().startsWith("https://"), revision: z.string().min(1),
    policyCutoff: z.string().regex(/^\d{4}-\d{2}$/), includesLongTermPledges: z.boolean(),
    processingStage: z.enum(["raw", "harmonized", "infilled"]) }),
  unit: z.literal("Mt gas/year"),
  years: z.array(z.number().int()).length(77),
  gases: z.record(z.array(z.number().finite()).length(77)),
  infilling: z.record(z.object({ method: z.string().min(10), evidence: z.string().url(),
    sensitivity: z.string().min(10) })).default({}),
});
export const pairSchema = z.array(pathwaySchema).length(2);
export function nativeInventory() {
  const totals: Record<string, number> = {};
  for (const cell of inventory.cells) {
    const gas = cell.gas === "CO2" ? (cell.sector === "LULUCF" ? "CO2-LULUCF" : "CO2-EIP") : cell.gas;
    totals[gas] = (totals[gas] ?? 0) + cell.nativeMt;
  }
  return totals;
}
/** Accounting validation, not proof that a declared source/method is scientifically adequate. */
export function validateNativePair(input: unknown, baseline = nativeInventory()) {
  const pair = pairSchema.parse(input);
  if (new Set(pair.map(p => p.scenario)).size !== 2) throw new Error("Both distinct policy cases are required");
  for (const p of pair) {
    if (p.scenario === "announced-commitments" && !p.source.includesLongTermPledges)
      throw new Error("NDC-only pathways cannot be relabelled all announced commitments");
    if (p.years.some((year, i) => year !== 2024 + i)) throw new Error("Contiguous 2024–2100 annual years required");
    const required = Object.keys(baseline).sort(), supplied = Object.keys(p.gases).sort();
    if (JSON.stringify(required) !== JSON.stringify(supplied)) throw new Error("Missing or unexpected native gas; no silent zero infill");
    for (const gas of required) {
      const values = p.gases[gas];
      if (Math.abs(values[0] - baseline[gas]) > Math.max(1e-9, Math.abs(baseline[gas]) * 1e-6))
        throw new Error(`Inventory mismatch: ${gas}`);
      if (!gas.startsWith("CO2-") && values.some(v => v < 0)) throw new Error(`Negative non-CO2 emissions: ${gas}`);
    }
    for (const gas of Object.keys(p.infilling)) if (!(gas in baseline)) throw new Error("Unknown infilled gas");
  }
  return { status: "accounting-valid-not-scientifically-promoted", inventoryVersion: inventory.version,
    scenarios: pair.map(p => ({
      scenario: p.scenario, source: p.source, unit: p.unit,
      annualNative: Object.fromEntries([2030, 2050, 2100].map(year =>
        [year, Object.fromEntries(Object.entries(p.gases).map(([gas, values]) => [gas, values[year - 2024]]))])),
      cumulative2025Through2100Mt: Object.fromEntries(Object.entries(p.gases).map(([gas, values]) =>
        [gas, values.slice(1).reduce((sum, v) => sum + v, 0)])),
      infilling: p.infilling,
    })),
  };
}
