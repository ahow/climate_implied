import { z } from "zod";
import { contentHash } from "../calculation/analysisManifest";
const intensity = z.object({ value: z.number().finite().positive(), source: z.enum(["owid", "static"]) }).strict();
const schema = z.object({ eu: intensity, us: intensity, china: intensity, india: intensity }).strict();
export function packRegional(input: unknown) {
  const payload = { version: "regional-intensity-1" as const,
    source: "OWID co2_per_gdp (PPP) or explicitly tagged legacy nominal static assumption",
    observationVintage: "Capture of resolved inputs, not an original publication vintage",
    intensities: schema.parse(input) };
  return { id: contentHash(payload), payload };
}
export function unpackRegional(id: string, input: unknown) {
  const p = input as ReturnType<typeof packRegional>["payload"];
  if (!p || contentHash(p) !== id || p.version !== "regional-intensity-1")
    throw new Error("Regional snapshot content mismatch");
  return schema.parse(p.intensities);
}
