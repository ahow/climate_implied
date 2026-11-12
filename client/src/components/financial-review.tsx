import { useReadQuery as useQuery } from "@/lib/use-read-query";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScientificEvidenceStrands } from "./scientific-evidence-strands";
import type { ScientificEvidenceStatuses } from "@shared/scientificEvidence";
import type { interimWarningSummary } from "@shared/interimWarningEvidence";

interface FinancialReviewItem {
  id: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  payload: {
    identity: {
      companyId: string;
      isin: string;
      symbol: string;
      currency: string;
      exchange: string;
      issuerId: string;
    };
    quote: { price: number; marketCap: number; observedAt: string };
    statement: { netIncome: number; period: string; filingDate: string; currency: string };
    fetchedAt: string;
  };
  calculation: {
    inputId: string;
    priceToLastAnnualEarnings: number | null;
    reason: string | null;
    quoteAgeHours: number;
  };
}

interface FinancialReviewsResponse {
  items: FinancialReviewItem[];
  approvalMode: "operator-cli";
  limitation: string;
}

interface CalculationReadiness {
  scientificEvidence?: ScientificEvidenceStatuses;
  interimWarnings?: ReturnType<typeof interimWarningSummary>;
  defaultEngine: string;
  candidateEnabled: boolean;
  checks: { id: string; label: string; passed: boolean; reason: string }[];
  limitations: string[];
}

function dateTime(value: string | null | undefined): string {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : `${date.toLocaleString()} (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
}

function number(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toLocaleString(undefined, { maximumFractionDigits: 8 })
    : "Not available";
}

function LoadingDetails({ label }: { label: string }) {
  return (
    <div className="space-y-2" role="status" aria-label={label}>
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function Snapshot({ item }: { item: FinancialReviewItem }) {
  const missing = ["identity", "quote", "statement"].filter(key => !item.payload?.[key as keyof FinancialReviewItem["payload"]]);
  if (!item.calculation) missing.push("calculation");
  if (missing.length) return <article className="rounded-md border p-4 text-sm" data-testid={`financial-review-${item.id}`}>
    <p role="status">Financial snapshot details are incomplete: {missing.join(", ")} not returned. No ratio or approval conclusion is substituted.</p>
  </article>;
  const { identity, quote, statement, fetchedAt } = item.payload;
  const { calculation } = item;
  const statusLabels = {
    pending: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
    superseded: "Superseded",
  };
  return (
    <article className="space-y-4 rounded-md border p-4" data-testid={`financial-review-${item.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="break-words font-medium">{identity.symbol || identity.companyId || "Financial snapshot"}</h4>
          <p className="break-all font-mono text-xs text-muted-foreground">Review ID: {item.id}</p>
        </div>
        <Badge variant={item.status === "approved" ? "default" : item.status === "rejected" ? "destructive" : item.status === "superseded" ? "secondary" : "outline"}>
          {statusLabels[item.status]}
        </Badge>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm md:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Company / issuer ID</dt><dd className="mt-1 break-all">{identity.companyId || "Not available"} / {identity.issuerId || "Not available"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">ISIN / exchange</dt><dd className="mt-1 break-all">{identity.isin || "Not available"} / {identity.exchange || "Not available"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Quote price / currency</dt><dd className="mt-1 font-mono">{number(quote.price)} {identity.currency || "(currency unavailable)"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Market capitalization / quote currency</dt><dd className="mt-1 font-mono">{number(quote.marketCap)} {identity.currency || "(currency unavailable)"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Quote observed at</dt><dd className="mt-1">{dateTime(quote.observedAt)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Quote age at calculation</dt><dd className="mt-1">{number(calculation.quoteAgeHours)} hours</dd></div>
        <div><dt className="text-xs text-muted-foreground">Last-annual net income / statement currency</dt><dd className="mt-1 font-mono">{number(statement.netIncome)} {statement.currency || "(currency unavailable)"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Annual statement period / filing date</dt><dd className="mt-1">{statement.period || "Not available"} / {statement.filingDate || "Not available"}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Snapshot fetched at</dt><dd className="mt-1">{dateTime(fetchedAt)}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Calculation input ID</dt><dd className="mt-1 break-all font-mono">{calculation.inputId || "Not available"}</dd></div>
      </dl>
      <div className="space-y-1 rounded-md bg-muted/50 p-3 text-sm">
        <p className="font-medium">Price-to-last-annual earnings ratio (not TTM P/E)</p>
        <p className="font-mono">{number(calculation.priceToLastAnnualEarnings)}</p>
        {calculation.reason && <p className="text-xs text-muted-foreground">{calculation.reason}</p>}
        {calculation.priceToLastAnnualEarnings == null && !calculation.reason && (
          <p className="text-xs text-muted-foreground">No ratio was returned for this snapshot.</p>
        )}
        <p className="text-xs text-muted-foreground">
          {item.status === "pending"
            ? "Awaiting an authorized operator decision; not an approved financial snapshot."
            : item.status === "approved"
              ? "Approved financial snapshot; separate from historic workbook data."
              : item.status === "rejected"
                ? "Rejected snapshot; not an approved financial input."
                : "Superseded snapshot; no longer the current approved financial input."}
        </p>
      </div>
    </article>
  );
}

export function FinancialReview() {
  const { data, isLoading, isFetching, isError, refetch } = useQuery<FinancialReviewsResponse>({
    queryKey: ["/api/financial-data/reviews"],
  });
  const active = data?.items?.filter((item) => item.status === "pending" || item.status === "approved") ?? [];
  const history = data?.items?.filter((item) => item.status === "rejected" || item.status === "superseded") ?? [];

  return (
    <Card data-testid="card-financial-review" aria-busy={isFetching}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Financial snapshot review</CardTitle>
            <p className="text-sm text-muted-foreground">Review saved financial inputs without changing approval decisions.</p>
          </div>
          <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={() => void refetch()} disabled={isFetching} data-testid="button-reload-financial-reviews">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isFetching ? "Loading reviews…" : "Reload reviews"}
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Read-only review</Badge>
          <Badge variant="outline">Approval: {data?.approvalMode ?? "operator-cli"}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <LoadingDetails label="Loading financial reviews" />}
        {isError && (
          <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
            <p className="font-medium">Unable to load financial reviews.</p>
            <p className="text-muted-foreground">{data ? "Previously loaded snapshots below may be out of date. " : ""}Use Reload reviews to retry; it only reads saved records.</p>
          </div>
        )}
        {data && (
          <>
            {!Array.isArray(data.items) ? <p role="status">Financial snapshot inventory is unavailable: no items array was returned. An absent inventory is not an empty review queue.</p> : active.length ? (
              <section className="space-y-3" aria-label="Pending and approved financial snapshots">
                <h3 className="text-sm font-semibold">Pending and approved snapshots</h3>
                {active.map((item) => <Snapshot key={item.id} item={item} />)}
              </section>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm" role="status">
                <p className="font-medium">No pending or approved financial snapshots</p>
                <p className="mt-1 text-muted-foreground">Saved snapshots will appear here when available. Reload reads existing records only.</p>
              </div>
            )}
            {history.length > 0 && (
              <section className="space-y-3" aria-label="Rejected and superseded financial snapshots">
                <h3 className="text-sm font-semibold">Rejected and superseded snapshots</h3>
                {history.map((item) => <Snapshot key={item.id} item={item} />)}
              </section>
            )}
            {data.limitation && <p className="text-sm text-muted-foreground">{data.limitation}</p>}
          </>
        )}
        {!isLoading && !isError && !data && (
          <p className="text-sm text-muted-foreground">No review response is available. Reload reviews to try again.</p>
        )}
        <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Authorized workspace CLI only</p>
          <p>There is no public mutation endpoint for financial approvals. An authorized workspace operator can run:</p>
          <code className="block break-all font-mono">npx tsx script/financial-review.ts approve &lt;id&gt;</code>
          <code className="block break-all font-mono">npx tsx script/financial-review.ts reject &lt;id&gt;</code>
          <p>Approved financial snapshots are separate from historic workbook data. Reload reviews makes a GET request only; it does not approve records, fetch provider data, or change workbook inputs.</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ScientificValidation() {
  const { data, isLoading, isFetching, isError, refetch } = useQuery<CalculationReadiness>({
    queryKey: ["/api/calculation/readiness"],
  });
  return (
    <Card data-testid="card-scientific-validation" aria-busy={isFetching}>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">Scientific validation</CardTitle>
            <p className="text-sm text-muted-foreground">Calculation readiness checks and reported limitations, not a claim of scientific certification.</p>
          </div>
          <Button variant="outline" size="sm" className="self-start sm:self-auto" onClick={() => void refetch()} disabled={isFetching} data-testid="button-reload-calculation-readiness">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {isFetching ? "Loading checks…" : "Reload checks"}
          </Button>
        </div>
        <div><Badge variant="secondary">Read-only diagnostics</Badge></div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <LoadingDetails label="Loading scientific validation" />}
        {isError && (
          <div role="alert" className="rounded-md border border-destructive/40 p-3 text-sm">
            <p className="font-medium">Unable to load calculation readiness.</p>
            <p className="text-muted-foreground">{data ? "Previously loaded checks below may be out of date. " : "Readiness has not been determined. "}Use Reload checks to retry.</p>
          </div>
        )}
        {data && (
          <>
            {data.scientificEvidence ? <ScientificEvidenceStrands evidence={data.scientificEvidence} /> :
              <p role="status">Separate scientific evidence statuses were not returned. Acceptance cannot be inferred.</p>}
            {data.interimWarnings && <section className="rounded-md border p-3 space-y-2 text-xs" aria-label="Interim warning evidence">
              <h3 className="font-semibold">Interim warnings remain limitation-specific</h3>
              <p>{data.interimWarnings.policy}</p>
              <p>{data.interimWarnings.originalHostCount} retained-source warning hosts; {data.interimWarnings.recordedRemovalBindings} recorded removal bindings. Existing resolution records only, not new scientific acceptance.</p>
              <p className="text-muted-foreground">{data.interimWarnings.coverageLimit}</p>
            </section>}
            <dl className="grid grid-cols-1 gap-4 rounded-md border p-4 text-sm md:grid-cols-2">
              <div><dt className="text-xs text-muted-foreground">Default engine</dt><dd className="mt-1 break-words font-mono">{data.defaultEngine || "Not available"}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Candidate engine</dt><dd className="mt-1"><Badge variant={data.candidateEnabled === true ? "default" : "outline"}>{data.candidateEnabled === true ? "Enabled" : data.candidateEnabled === false ? "Disabled" : "Unavailable — candidate enablement not returned"}</Badge></dd></div>
            </dl>
            {!Array.isArray(data.checks) ? <p role="status">Readiness checks are unavailable: no checks array was returned.</p> : data.checks.length > 0 ? (
              <ul className="space-y-2" aria-label="Calculation readiness checks">
                {data.checks.map((check) => (
                  <li key={check.id} className="rounded-md border p-3 text-sm" data-testid={`readiness-check-${check.id}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{check.label}</p>
                      <Badge variant={check.passed === true ? "secondary" : "destructive"}>{check.passed === true ? "Passed" : check.passed === false ? "Not passed" : "Unavailable — check outcome not returned"}</Badge>
                    </div>
                    <p className="mt-1 break-words text-xs text-muted-foreground">{check.reason || "No explanation supplied."}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-md border border-dashed p-4 text-sm" role="status">
                <p className="font-medium">No validation checks reported</p>
                <p className="mt-1 text-muted-foreground">Readiness cannot be inferred from an empty check list.</p>
              </div>
            )}
            <div className="space-y-2 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Reported limitations</p>
              {data.limitations?.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4">{data.limitations.map((limitation, index) => <li key={`${index}-${limitation}`}>{limitation}</li>)}</ul>
              ) : <p>No limitations were returned. This does not establish scientific validity.</p>}
            </div>
          </>
        )}
        {!isLoading && !isError && !data && <p className="text-sm text-muted-foreground">No readiness response is available. Reload checks to try again.</p>}
        <p className="text-xs text-muted-foreground">Reload checks makes a GET request only. It does not enable an engine or change calculation settings.</p>
      </CardContent>
    </Card>
  );
}
