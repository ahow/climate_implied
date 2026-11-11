import { THRESHOLD_DIAGNOSTIC_LABEL, thresholdDiagnosticDisplay, type ThresholdDiagnostic } from "@shared/thresholdDiagnostic";
import { DownloadDataButton } from "./download-data-button";
import { thresholdExportBindings, thresholdExportRow } from "@/lib/threshold-export";
import { SELECTED_FIVE_PERCENT_DESCRIPTOR, residualQuantityExportNotes } from "@shared/quantityDescriptors";

export function ThresholdDiagnosticDetails({ diagnostic, contextLabel }: { diagnostic?: ThresholdDiagnostic | null; contextLabel?: string }) {
  return (
    <div className="space-y-2 text-xs text-muted-foreground" data-testid="threshold-diagnostic-details">
      <p title={SELECTED_FIVE_PERCENT_DESCRIPTOR.description}>{THRESHOLD_DIAGNOSTIC_LABEL}: {thresholdDiagnosticDisplay(diagnostic)}. Positive residual diagnostic; not net zero.</p>
      {diagnostic?.reason && <p role="status">{diagnostic.reason}</p>}
      {diagnostic && <>
        <p>Version: {diagnostic.version}. First annual value at or below the threshold; no interpolation or extrapolation. Horizon: {diagnostic.horizonYear}.</p>
        {diagnostic.baselineValue !== null && <p>Selected 2024 baseline: {diagnostic.baselineValue} {diagnostic.basis?.unit}; threshold: {diagnostic.thresholdValue}. Explicit selected input evidence: {diagnostic.baselineEvidenceId}. An explicitly captured model initial condition is conditional, not an observed inventory or independent validation.</p>}
        <ThresholdDiagnosticDownload diagnostics={[diagnostic]} contextLabels={contextLabel ? [contextLabel] : undefined} />
      </>}
    </div>
  );
}

export function ThresholdDiagnosticDownload({ diagnostics, contextLabels }: { diagnostics: ThresholdDiagnostic[]; contextLabels?: string[] }) {
  return <DownloadDataButton kind="legacy" filename="selected-2024-five-percent-diagnostic-v2"
    sheetName="5 percent diagnostic" label="Download threshold diagnostic"
    interpretationNotes={residualQuantityExportNotes()}
    rows={diagnostics.map((d, i) => thresholdExportRow(d, contextLabels?.[i] ?? null))} fieldBindings={thresholdExportBindings}
    testId="button-download-threshold-diagnostic" />;
}
