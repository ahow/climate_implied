import { createHash } from "node:crypto";
import { CALCULATION_VERSION, RNG_VERSION, LEGACY_CLIMATE, LEGACY_FINANCE } from "../../shared/calculationContract";

export function canonical(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite calculation input");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && value) return `{${Object.entries(value)
    .filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  throw new Error("Unsupported calculation input");
}

export function calculationKey(kind: string, inputs: unknown, settings: unknown = {}, version = CALCULATION_VERSION): string {
  return `${kind}:${createHash("sha256").update(canonical({
    version, rng: RNG_VERSION, climate: LEGACY_CLIMATE, finance: LEGACY_FINANCE, inputs, settings,
  })).digest("hex")}`;
}
