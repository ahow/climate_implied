import type { ThresholdDiagnostic } from "./thresholdDiagnostic";

export interface NativeResidualRecord {
  gas: string;
  region: string;
  memberId: string;
  diagnostic: ThresholdDiagnostic;
}
export interface NativeResidualDiagnostics {
  version: "native-mass-residual-diagnostics-1";
  evidenceState: "Bounded/conditional estimate";
  qualification: string;
  baselineInputId: string;
  sourceEvidence: string;
  records: NativeResidualRecord[];
}
