export type SemanticsCompletionGate="--require-original-complete"|"--require-complete";
export interface SemanticsGateEvidence {
  baseline:boolean;
  closedOriginalSlots:number;
  fullyBoundFields:number;
  publicSlots:number;
  slotFingerprint:string;
  frozenOriginalSlotFingerprint:string;
  resolvedResponseAliases:number;
  withheldFields:number;
}

/** Pure strict-gate decision shared by the actual census CLI and focused tests.
 * A passing inventory freshness check never implies semantic completeness.
 */
export function semanticsCompletionGateError(gate:SemanticsCompletionGate,evidence:SemanticsGateEvidence):string|null {
  if(gate==="--require-original-complete") {
    return evidence.baseline || evidence.closedOriginalSlots!==572 || evidence.fullyBoundFields!==1001 ||
      evidence.slotFingerprint!==evidence.frozenOriginalSlotFingerprint || evidence.resolvedResponseAliases!==4 ||
      evidence.withheldFields!==27
      ? "Original cohort incomplete or original slot identity/alias/withholding contract changed" : null;
  }
  if(evidence.fullyBoundFields!==evidence.publicSlots)
    return `SEMANTICS INCOMPLETE: ${evidence.fullyBoundFields}/${evidence.publicSlots} public field slots bound; display-only expressions additionally unenumerated`;
  return "Original API/XLSX cohort is bound, but complete supplemental chained responses, custom sheets, chart payloads and display-attribute semantics are not verified";
}
