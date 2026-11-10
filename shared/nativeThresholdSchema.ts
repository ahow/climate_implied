import { z } from "zod";
import { thresholdDiagnosticSchema } from "./thresholdDiagnosticSchema";
import { nativeGasIds } from "./nativeOutputSemantics";

export const regionalNativeResidualRequestSchema = z.object({
  baselineYear: z.literal(2024),
  input: z.unknown(), // Existing strict regional-member validator owns the cell/scenario contract.
}).strict();

export const nativeResidualDiagnosticsSchema = z.object({
  version: z.literal("native-mass-residual-diagnostics-1"),
  evidenceState: z.literal("Bounded/conditional estimate"),
  qualification: z.string().min(1),
  baselineInputId: z.string().regex(/^captured-(native-inventory|regional-native-input)-sha256:[a-f0-9]{64}$/),
  sourceEvidence: z.string().min(1),
  records: z.array(z.object({
    gas: z.enum(["CO2-FFI", "CO2-LULUCF", ...nativeGasIds.filter(gas => gas !== "CO2")]),
    region: z.enum(["Global", "China", "EU27", "India", "International transport", "Rest of World", "US"]),
    memberId: z.string().min(1),
    diagnostic: thresholdDiagnosticSchema,
  }).strict()).min(1),
}).strict().superRefine((value, ctx) => {
  const identities = new Set<string>();
  for (const record of value.records) {
    const id = JSON.stringify([record.region, record.memberId, record.gas]);
    const basis = record.diagnostic.basis;
    const species = record.gas.startsWith("CO2-") ? "CO2" : record.gas;
    if (identities.has(id) || !basis || basis.selectionId !== value.baselineInputId ||
        basis.gasBasis !== `native-mass:${record.gas}:${record.region}` ||
        basis.memberId !== record.memberId || basis.unit !== `Mt ${species}/year` ||
        (record.diagnostic.status !== "withheld" && record.diagnostic.baselineEvidenceId !== value.baselineInputId))
      ctx.addIssue({ code: "custom", message: "Native diagnostic gas/region/member/input/unit identity is inconsistent or duplicated" });
    identities.add(id);
  }
});
