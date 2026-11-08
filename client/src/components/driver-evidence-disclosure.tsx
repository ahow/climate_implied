import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface DriverRegistry {
  status: string;
  indicators: {
    id: string;
    definition: string;
    publisher: string;
    rawUnit: string;
    role: string;
    centralModelEligible: false;
    reason: string;
    evidenceState: string;
  }[];
}

export function DriverEvidenceDisclosure() {
  const registry = useQuery<DriverRegistry>({
    queryKey: ["/api/research/driver-registry"],
  });
  const indicators = registry.data?.indicators ?? [];
  const uniqueCount = new Set(indicators.map((indicator) => indicator.id)).size;
  const complete = indicators.length === 22 && uniqueCount === 22;

  return (
    <Card className="p-5 mb-6 space-y-3" data-testid="driver-evidence-disclosure">
      <h2 className="text-lg font-semibold">Driver evidence registry</h2>
      <p className="text-sm text-muted-foreground">
        The 22 tracked indicators are documented for research transparency. Registry roles and
        evidence states are not calibrated model parameters or evidence of causal effects.
        These indicators are not eligible for the central model.
      </p>
      {registry.isError ? (
        <div role="alert" className="space-y-2">
          <p className="text-sm text-muted-foreground">The driver registry could not be loaded. Indicator coverage and evidence states cannot be verified.</p>
          <Button variant="outline" size="sm" onClick={() => void registry.refetch()} disabled={registry.isFetching}>Retry driver registry</Button>
        </div>
      ) : registry.isLoading ? (
        <div role="status" aria-label="Loading driver evidence registry" className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : registry.data ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="break-all">{registry.data.status}</Badge>
            <p className="text-xs text-muted-foreground" data-testid="driver-registry-coverage">{uniqueCount} of 22 indicators accounted for</p>
          </div>
          {!complete && (
            <p role="alert" className="text-sm text-muted-foreground">
              Registry coverage is incomplete or contains duplicate IDs. The response returned {indicators.length} entries with {uniqueCount} unique IDs; all 22 indicators cannot be verified.
            </p>
          )}
          {indicators.length === 0 ? (
            <p className="text-sm text-muted-foreground">No indicator evidence records were returned.</p>
          ) : (
            <details className="rounded-md border p-3">
              <summary className="cursor-pointer text-sm font-semibold">Inspect all {indicators.length} indicator evidence records</summary>
              <ul className="mt-3 divide-y">
                {indicators.map((indicator, index) => (
                  <li key={`${indicator.id}-${index}`} className="py-3 first:pt-0 space-y-2" data-testid={`driver-evidence-${indicator.id}`}>
                    <h3 className="text-sm font-semibold font-mono break-all">{indicator.id}</h3>
                    <p className="text-sm text-muted-foreground break-words">{indicator.definition}</p>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-xs">
                      <div><dt className="text-muted-foreground">Publisher</dt><dd className="break-words">{indicator.publisher || "Not supplied"}</dd></div>
                      <div><dt className="text-muted-foreground">Raw unit</dt><dd className="break-words">{indicator.rawUnit || "Not supplied"}</dd></div>
                      <div><dt className="text-muted-foreground">Research role</dt><dd className="break-words">{indicator.role || "Not supplied"}</dd></div>
                      <div><dt className="text-muted-foreground">Evidence state</dt><dd className="break-words">{indicator.evidenceState || "Not supplied"}</dd></div>
                      <div><dt className="text-muted-foreground">Central model eligible</dt><dd>{indicator.centralModelEligible === false ? "No" : "Not verified"}</dd></div>
                      <div className="sm:col-span-2"><dt className="text-muted-foreground">Reason</dt><dd className="whitespace-pre-wrap break-words">{indicator.reason || "Not supplied"}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Driver evidence is unavailable. No registry response was returned.</p>
      )}
    </Card>
  );
}
