import type { NativeResidualRecord } from "@shared/nativeThresholdDiagnostics";
import { thresholdExportRow, thresholdExportBindings } from "./threshold-export";

export function nativeThresholdExportRows(records: NativeResidualRecord[]) {
  return records.map(r => ({
    ...thresholdExportRow(r.diagnostic, `${r.region} / ${r.gas} / ${r.memberId}`),
    Gas: r.gas, Region: r.region,
  }));
}
export const nativeThresholdExportBindings = {
  ...Object.fromEntries(Object.entries(thresholdExportBindings).map(([column, binding]) => [
    column, { ...binding, id: column === "Context" ? "native.residualDiagnostics.records[].contextLabel" :
      binding.id.replace("thresholdDiagnostic.", "native.residualDiagnostics.records[].diagnostic.") },
  ])),
  Gas: { id: "native.residualDiagnostics.records[].gas", transform: "Identity; native species/account, not CO2e" },
  Region: { id: "native.residualDiagnostics.records[].region", transform: "Identity; no regional baseline borrowing" },
};
