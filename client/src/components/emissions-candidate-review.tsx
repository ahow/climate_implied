import { useState } from "react";
import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { Button } from "@/components/ui/button";
import { DownloadDataButton } from "./download-data-button";
import { nativeExportRow,nativeExportBindings } from "@shared/nativeExport";
import type { NativeResidualDiagnostics } from "@shared/nativeThresholdDiagnostics";
import { thresholdDiagnosticDisplay, THRESHOLD_DIAGNOSTIC_LABEL } from "@shared/thresholdDiagnostic";
import { nativeThresholdExportRows, nativeThresholdExportBindings } from "@/lib/native-threshold-export";
import { nativeResidualDiagnosticsSchema } from "@shared/nativeThresholdSchema";
import { ScientificEvidenceStrands } from "./scientific-evidence-strands";

type CandidateResponse = {
  residualDiagnostics?: NativeResidualDiagnostics;
  inputs?: {
    inventoryYear?: number;
    indicatorYear?: number;
    assumptions?: string[];
    readiness?: {
      status?: string;
      mainCase?: string;
      comparisonCase?: string;
      missing?: string[];
    };
    indicators?: {
      key?: string;
      label?: string;
      unit?: string;
      year?: number;
      value?: number | null;
      role?: string;
      reason?: string;
    }[];
  };
  result?: {
    validation?: string;
    temperature?: null;
    trajectory?: {
      year: number;
      reportingGtCO2e: number;
      nativeMt: Record<string, number>;
      sectorsGtCO2e: Record<string,number>;
    }[];
  };
};

type ReviewScenario = "constant" | "transition" | "dashboard";
const scenarioLabels: Record<ReviewScenario, string> = {
  constant: "Constant-activity control",
  transition: "Illustrative transition",
  dashboard: "Dated dashboard-input diagnostic",
};

const reviewYears = [2024, 2030, 2050, 2100];
const formatEmissions = new Intl.NumberFormat("en", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function EmissionsCandidateReview() {
  const [scenario, setScenario] = useState<ReviewScenario>("constant");
  const { data, isLoading, isError, refetch, isFetching } = useQuery<CandidateResponse>({
    queryKey: [`/api/emissions/candidate?scenario=${scenario}`],
    select: response => {
      if (!response) return response;
      if (response.residualDiagnostics) nativeResidualDiagnosticsSchema.parse(response.residualDiagnostics);
      for (const rows of [response.result?.trajectory, response.inputs?.indicators]) {
        if (rows != null && (!Array.isArray(rows) || rows.some(row => !row || typeof row !== "object")))
          throw new Error("Candidate observation records unavailable.");
      }
      return response;
    },
  });

  return (
    <section
      className="rounded-lg border bg-card text-card-foreground p-4 sm:p-6 space-y-4"
      aria-labelledby="emissions-candidate-heading"
      data-testid="emissions-candidate-review"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 id="emissions-candidate-heading" className="text-lg font-semibold">
            Package 2 · Emissions candidate review
          </h2>
          <p className="text-sm text-muted-foreground">
            Read-only candidate, not calibrated and not a forecast.
          </p>
        </div>
        <div className="space-y-1">
          <label htmlFor="emissions-candidate-scenario" className="block text-xs font-medium text-muted-foreground">
            Review scenario
          </label>
          <select
            id="emissions-candidate-scenario"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={scenario}
            onChange={(event) => setScenario(event.target.value as ReviewScenario)}
            data-testid="select-emissions-candidate-scenario"
          >
            <option value="constant">Constant-activity control</option>
            <option value="transition">Illustrative transition</option>
            <option value="dashboard">Dated dashboard-input diagnostic</option>
          </select>
        </div>
      </div>

      <ScientificEvidenceStrands />
      <p className="rounded-md border p-3 text-sm font-medium">
        Package 2 remains incomplete: the native-gas scenarios are not yet calibrated.
        The published CAT references above are independent comparisons, not outputs of this candidate model.
      </p>

      <p className="text-sm text-muted-foreground">
        This partial Package 2 review does not validate the legacy calculation and makes no new
        temperature claim. Calibration and source assessment are still pending.
      </p>
      {!isError && data?.result && !data.residualDiagnostics &&
        <p role="status" className="text-xs text-muted-foreground">Native residual diagnostics are unavailable in this response. No default or legacy baseline is substituted.</p>}
      {!isError && data?.residualDiagnostics && <section className="rounded-md border p-3 space-y-2" data-testid="native-residual-diagnostics">
        <h3 className="text-sm font-semibold">{THRESHOLD_DIAGNOSTIC_LABEL} · native-mass diagnostics</h3>
        <p className="text-xs text-muted-foreground">{data.residualDiagnostics.qualification}</p>
        <p className="text-xs text-muted-foreground break-words">Baseline input: {data.residualDiagnostics.baselineInputId}. {data.residualDiagnostics.sourceEvidence}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr><th className="text-left">Region / gas</th><th className="text-right">2024 baseline (native mass/year)</th><th className="text-right">5% threshold (same unit)</th><th className="text-right">{THRESHOLD_DIAGNOSTIC_LABEL}</th></tr></thead>
            <tbody>{data.residualDiagnostics.records.map(r => <tr key={`${r.region}:${r.memberId}:${r.gas}`}>
              <th className="text-left font-normal py-1">{r.region} / {r.gas}</th>
              <td data-field-id="native.residualDiagnostics.records[].diagnostic.baselineValue" className="text-right">{r.diagnostic.baselineValue?.toPrecision(6) ?? "Withheld"} {r.diagnostic.basis?.unit}</td>
              <td data-field-id="native.residualDiagnostics.records[].diagnostic.thresholdValue" className="text-right">{r.diagnostic.thresholdValue?.toPrecision(6) ?? "Withheld"}</td>
              <td data-field-id="native.residualDiagnostics.records[].diagnostic.year" className="text-right">{thresholdDiagnosticDisplay(r.diagnostic)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <DownloadDataButton kind="native" filename="native-mass-five-percent-2024-diagnostics"
          sheetName="Native residual diagnostic" label="Download separate native threshold diagnostics"
          rows={nativeThresholdExportRows(data.residualDiagnostics.records)}
          fieldBindings={nativeThresholdExportBindings} testId="button-download-native-thresholds" />
      </section>}

      {isLoading ? (
        <div role="status" aria-label="Loading candidate emissions" className="space-y-3">
          <span className="sr-only">Loading candidate emissions…</span>
          {reviewYears.map((year) => (
            <div key={year} className="h-8 rounded bg-muted animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
          <p className="text-sm text-muted-foreground">
            Candidate emissions could not be loaded. No candidate values are shown.
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : !data?.result?.trajectory?.length ? (
        <p className="rounded-md border p-3 text-sm text-muted-foreground">
          No candidate trajectory is available for this scenario.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="text-left text-xs text-muted-foreground pb-2">
              {scenarioLabels[scenario]} · Reporting emissions only
            </caption>
            <thead>
              <tr className="border-b text-muted-foreground">
                <th scope="col" data-field-id="native.result.trajectory[].year" className="py-2 text-left font-medium">Year</th>
                <th scope="col" data-field-id="native.result.trajectory[].reportingGtCO2e" className="py-2 text-right font-medium">Reporting emissions (GtCO2e, AR6 GWP100)</th>
              </tr>
            </thead>
            <tbody>
              {reviewYears.map((year) => {
                const point = data?.result?.trajectory?.find((entry) => entry.year === year);
                return (
                  <tr key={year} className="border-b last:border-0">
                    <th scope="row" className="py-2 text-left font-normal tabular-nums">{year}</th>
                    <td className="py-2 text-right tabular-nums">
                      {point && Number.isFinite(point.reportingGtCO2e)
                        ? formatEmissions.format(point.reportingGtCO2e)
                        : "Not available"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <DownloadDataButton
            kind="native"
            filename={`native-emissions-${scenario}`}
            rows={data.result.trajectory.map(nativeExportRow)}
            fieldBindings={nativeExportBindings}
          />
        </div>
      )}

      {!isLoading && !isError && data?.inputs && (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Readiness and missing calibration</h3>
            <p className="text-xs text-muted-foreground">
              Inventory year: {data.inputs.inventoryYear ?? "Not available"} · Indicator year:{" "}
              {data.inputs.indicatorYear ?? "Not available"}
            </p>
            {data.inputs.readiness?.status && (
              <p className="text-sm text-muted-foreground">
                Reported readiness status: {data.inputs.readiness.status}
              </p>
            )}
            {data.inputs.readiness?.mainCase && (
              <p className="text-sm text-muted-foreground">
                Native-gas main-case basis (not yet calibrated): {data.inputs.readiness.mainCase}
              </p>
            )}
            {data.inputs.readiness?.comparisonCase && (
              <p className="text-sm text-muted-foreground">
                Native-gas comparison basis (not yet calibrated): {data.inputs.readiness.comparisonCase}
              </p>
            )}
            {data.inputs.readiness?.missing?.length ? (
              <ul aria-label="Missing readiness requirements" className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {data.inputs.readiness.missing.map((item, index) => (
                  <li data-field-id="native.inputs.readiness.missing[]" key={index}>{item}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                No missing-requirement details were supplied. This does not establish readiness.
              </p>
            )}
          </div>

          <details className="rounded-md border p-3">
            <summary className="cursor-pointer text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Indicator roles · 2024 values
            </summary>
            {data.inputs.indicators?.length ? (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <caption className="text-left text-xs text-muted-foreground pb-2">
                    Dated input diagnostics, not calibrated policy cases. Values from other years
                    are identified rather than presented as 2024 observations.
                  </caption>
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th scope="col" data-field-id="native.inputs.indicators[].label" className="py-2 pr-4 text-left font-medium">Indicator</th>
                      <th scope="col" data-field-id="native.inputs.indicators[].value" className="py-2 pr-4 text-left font-medium">2024 value / unit</th>
                      <th scope="col" data-field-id="native.inputs.indicators[].role" className="py-2 pr-4 text-left font-medium">Role</th>
                      <th scope="col" data-field-id="native.inputs.indicators[].reason" className="py-2 text-left font-medium">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.inputs.indicators.map((indicator, index) => {
                      const year = indicator.year ?? data.inputs?.indicatorYear;
                      const value = typeof indicator.value === "number" && Number.isFinite(indicator.value)
                        ? formatEmissions.format(indicator.value)
                        : "Not available";
                      return (
                        <tr key={indicator.key ?? index} className="border-b last:border-0">
                          <th scope="row" className="py-2 pr-4 text-left font-normal">
                            {indicator.label ?? indicator.key ?? "Unnamed indicator"}
                          </th>
                          <td className="py-2 pr-4 tabular-nums">
                            {year === 2024 ? value : "2024 value not available"}
                            {year === 2024 ? indicator.unit ? ` ${indicator.unit}` : " — unit not supplied" : ""}
                            {year !== 2024 && (
                              <span className="block text-xs text-muted-foreground">
                                {year ?? "Undated"} input: {value}{indicator.unit ? ` ${indicator.unit}` : " — unit not supplied"}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">{indicator.role ?? "Not supplied"}</td>
                          <td className="py-2">{indicator.reason ?? "Not supplied"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No indicator-role details are available.</p>
            )}
          </details>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Diagnostic assumptions</h3>
            {data.inputs.assumptions?.length ? (
              <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                {data.inputs.assumptions.map((assumption, index) => (
                  <li data-field-id="native.inputs.assumptions[]" key={index}>{assumption}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No assumptions were supplied.</p>
            )}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        GtCO2e is a reporting aggregate, not a native species mass. Native species masses remain
        separate in Mt per species and are not combined in this table.
        {data?.result?.validation && !isError && (
          <span> Validation status: {data.result?.validation}. This is not calibration.</span>
        )}
      </p>
    </section>
  );
}
