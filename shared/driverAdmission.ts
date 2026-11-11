import { z } from "zod";

/** Role describes causal use, never scientific acceptance. Candidate status and
 * permitted use are separate gates; an alias must not grant either. */
export const driverRoleSchema = z.enum([
  "mechanism-input", "level-anchor", "validation-target", "context", "candidate-leading-indicator",
]);
export type DriverRole = z.infer<typeof driverRoleSchema>;
export const DRIVER_ROLE_ALIASES = {
  "candidate-mechanism-input": "mechanism-input",
  validation: "validation-target",
} as const;

/** Explicit compatibility adapter only. Admission itself accepts canonical roles. */
export function adaptLegacyDriverRole(role: keyof typeof DRIVER_ROLE_ALIASES) {
  if (!Object.hasOwn(DRIVER_ROLE_ALIASES, role)) throw new Error("Unknown legacy driver role");
  return { role: DRIVER_ROLE_ALIASES[role], legacyRole: role,
    eligibilityTransferred: false as const };
}

export function curatedDriverRole(key: string): DriverRole {
  if (["renewableCapacityGW", "renewableGrowthRate", "evSalesSharePct", "evGrowthRate",
    "gdpTrillionUSD", "carbonIntensityKgPerGDP"].includes(key)) return "mechanism-input";
  if (["fossilCO2GtPerYear", "atmosphericCO2ppm", "co2GrowthRatePpm"].includes(key)) return "validation-target";
  return "context";
}

export function assertMechanismRole(role: unknown, id: string) {
  const parsed = driverRoleSchema.safeParse(role);
  if (!parsed.success || parsed.data !== "mechanism-input")
    throw new Error(`Forecast dependency requires canonical mechanism-input role: ${id}; legacy aliases require an explicit adapter`);
}

/** Curated histories currently have no accepted native distribution. This gate
 * is deliberately independent of the diagnostic's two observation consumers. */
export function assertCuratedForecastUse(input: {
  id: string; role: DriverRole; centralModelEligible: boolean;
}) {
  assertMechanismRole(input.role, input.id);
  if (!input.centralModelEligible) throw new Error(`Central consumption blocked for curated driver: ${input.id}`);
}
