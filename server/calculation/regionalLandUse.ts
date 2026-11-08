import { z } from "zod";
const modelsSchema = z.array(z.object({
  model: z.enum(["BLUE","OSCAR","LUCE"]),
  globalMtC: z.number().finite().positive(), eu27MtC: z.number().finite(),
  usMtC: z.number().finite(), chinaMtC: z.number().finite(), indiaMtC: z.number().finite(),
})).length(3);
export function regionalLandUse(input: unknown, anchorMtCO2: number) {
  if (!Array.isArray(input) || input.length !== 3) throw new Error("All three bookkeeping models required");
  const models = modelsSchema.parse(input).sort((a,b)=>a.model.localeCompare(b.model));
  if (new Set(models.map(m=>m.model)).size!==3) throw new Error("All three bookkeeping models required");
  if (!Number.isFinite(anchorMtCO2) || anchorMtCO2<=0) throw new Error("Invalid land-use anchor");
  const mean = (key: "globalMtC"|"eu27MtC"|"usMtC"|"chinaMtC"|"indiaMtC") =>
    models.reduce((s,m)=>s+m[key],0)/3*3.664;
  const sourceGlobalMtCO2 = mean("globalMtC");
  const relativeDifference = Math.abs(sourceGlobalMtCO2-anchorMtCO2)/anchorMtCO2;
  if (relativeDifference>1e-6) throw new Error("Land-use source incompatible with frozen inventory");
  const factor = anchorMtCO2/sourceGlobalMtCO2;
  const regional: Record<string,number> = {
    EU27: mean("eu27MtC")*factor, US: mean("usMtC")*factor,
    China: mean("chinaMtC")*factor, India: mean("indiaMtC")*factor,
    "International transport": 0,
  };
  regional["Rest of World"] = anchorMtCO2-Object.values(regional).reduce((s,v)=>s+v,0);
  return { sourceGlobalMtCO2, anchorMtCO2, relativeDifference, roundingReconciliationFactor: factor,
    cells: Object.entries(regional).sort(([a],[b])=>a.localeCompare(b))
      .map(([region,nativeMt])=>({ region, nativeMt, gas:"CO2", sector:"LULUCF" })),
    method: "Equal mean of BLUE/OSCAR/LUCE; published EU27, US, China, India; Rest of World is global residual. Signed sinks preserved.",
    internationalLandUse: "structural zero: land-use emissions assigned to land regions, not international transport" };
}
