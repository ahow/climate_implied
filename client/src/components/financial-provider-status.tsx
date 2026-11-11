import { useReadQuery as useQuery } from "@/lib/use-read-query";
import type { FinancialProviderStatus as ProviderStatus } from "@shared/financialData";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const stateLabels: Record<ProviderStatus["state"], string> = {
  "not-configured": "Not configured",
  checking: "Checking",
  verified: "Verified",
  error: "Error",
};

function dateTime(value: string | number | null): string {
  if (value === null) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : `${date.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
}

export function FinancialProviderStatus() {
  const { data, isLoading, isFetching, isError, refetch } = useQuery<ProviderStatus>({
    queryKey: ["/api/financial-data/status"],
  });

  return (
    <Card data-testid="card-financial-provider-status" aria-busy={isFetching}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">FMP connection diagnostic</CardTitle>
            <p className="text-sm text-muted-foreground">
              Provider verification is not approval to use its data in calculations.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="self-start sm:self-auto"
            onClick={() => void refetch()}
            disabled={isFetching}
            data-testid="button-reload-financial-status"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isFetching ? "Loading status…" : "Reload status"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Read-only diagnostics</Badge>
          {data && (
            <>
              <Badge variant="outline" data-testid="badge-financial-configured" data-field-id="financialProvider.configured">
                {data.configured ? "Configured" : "Not configured"}
              </Badge>
              <Badge
                variant={data.state === "error" ? "destructive" : "outline"}
                data-testid="badge-financial-provider-state"
                data-field-id="financialProvider.state"
              >
                {stateLabels[data.state]}
              </Badge>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2" role="status" aria-label="Loading provider status">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : null}

        {isError && (
          <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
            <p className="font-medium">Unable to load provider status.</p>
            <p className="text-muted-foreground">
              {data
                ? "Previously loaded diagnostics remain below and may be out of date."
                : "Configuration and verification could not be determined."}{" "}
              Use Reload status to retry; this only reads the saved diagnostic.
            </p>
          </div>
        )}

        {data && (
          <>
            <p className="text-sm text-muted-foreground" role="status">
              {data.state === "verified"
                ? "The startup diagnostic verified provider access. These observations are not approved model inputs."
                : data.state === "checking"
                  ? "The startup diagnostic is checking provider access. Verification has not completed."
                  : data.state === "not-configured"
                    ? "Provider access is not configured. No successful verification is reported."
                    : "The startup diagnostic reported an error. Provider access is not verified."}
            </p>
            {data.error && (
              <p role="alert" className="break-words text-sm text-destructive" data-field-id="financialProvider.error">
                {data.error}
              </p>
            )}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-md border p-4 text-sm md:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Diagnostic checked at</dt>
                <dd className="mt-1" data-testid="text-financial-checked-at" data-field-id="financialProvider.checkedAt">
                  {dateTime(data.checkedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Diagnostic symbol</dt>
                <dd className="mt-1 font-mono" data-field-id="financialProvider.symbol">{data.symbol || "Not available"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Observed quote / currency</dt>
                <dd className="mt-1 font-mono" data-testid="text-financial-quote">
                  {data.quote ? <>
                    <span data-field-id="financialProvider.quote.price">{data.quote.price.toLocaleString(undefined, { maximumFractionDigits: 8 })}</span>{" "}
                    <span data-field-id="financialProvider.quote.currency">{data.quote.currency || "(currency unavailable)"}</span>
                  </> : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Quote observation time (not diagnostic check time)</dt>
                <dd className="mt-1" data-testid="text-financial-quote-time" data-field-id="financialProvider.quote.timestamp">
                  {data.quote ? dateTime(data.quote.timestamp * 1000) : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Financial period / reported currency</dt>
                <dd className="mt-1">
                  <span data-field-id="financialProvider.financialPeriod">{data.financialPeriod || "Not available"}</span>{" / "}
                  <span data-field-id="financialProvider.reportedCurrency">{data.reportedCurrency || "Not available"}</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Filing date</dt>
                <dd className="mt-1">{data.filingDate || "Not available"}</dd>
              </div>
            </dl>
          </>
        )}

        {!isLoading && !isError && !data && (
          <p className="text-sm text-muted-foreground">
            No diagnostic status is available. Reload status to try again.
          </p>
        )}

        <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Diagnostics only — no approved records changed</p>
          <p>
            Startup diagnostic only; no automatic provider-price refresh. Reload status reads
            the saved status and does not fetch paid data, refresh provider prices, or rerun
            verification. Separate financial snapshots can be staged and approved through the authorized
            operator workflow below; this sample never updates historical workbook inputs.
          </p>
          {!!data?.limitations.length && (
            <ul className="list-disc space-y-1 pl-4">
              {data.limitations.map((limitation, index) => (
                <li key={`${index}-${limitation}`} data-field-id="financialProvider.limitations[]">{limitation}</li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
