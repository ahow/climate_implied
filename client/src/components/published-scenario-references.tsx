import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type PublishedReferences = {
  version: string;
  status: "published-external-reference";
  source: {
    name: string;
    publishedAt: string;
    url: string;
    workbookUrl: string;
    sha256: string;
    attribution: string;
    copyright: string;
    licence: string;
  };
  temperatureMetric: string;
  climateModel: string;
  emissionsUnit: string;
  comparisonCaveat: string;
  refreshPolicy: string;
  scenarios: {
    id: string;
    label: string;
    publishedName: string;
    definition: string;
    temperatureMedianC: number;
    emissions: { year: number; low?: number; high?: number; value?: number }[];
  }[];
  supportingSources: { name: string; role: string; url: string; caveat: string }[];
};

const milestoneYears = [2030, 2035, 2050, 2100];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isHttpsUrl = (value: unknown): value is string => {
  if (!isText(value)) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

function isPublishedReferences(value: unknown): value is PublishedReferences {
  if (!isRecord(value) || value.status !== "published-external-reference") return false;
  if (!["version", "temperatureMetric", "climateModel", "emissionsUnit", "comparisonCaveat", "refreshPolicy"]
    .every((key) => isText(value[key]))) return false;
  const source = value.source;
  if (!isRecord(source) ||
    !["name", "publishedAt", "sha256", "attribution", "copyright", "licence"].every((key) => isText(source[key])) ||
    !isHttpsUrl(source.url) || !isHttpsUrl(source.workbookUrl) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(source.publishedAt as string) ||
    !Number.isFinite(Date.parse(`${source.publishedAt}T00:00:00Z`))) return false;
  if (!Array.isArray(value.scenarios) || value.scenarios.length !== 2) return false;
  for (const id of ["current-policies", "all-announced-commitments"]) {
    const scenario = value.scenarios.find((item: unknown) => isRecord(item) && item.id === id);
    if (!isRecord(scenario) || !["label", "publishedName", "definition"].every((key) => isText(scenario[key])) ||
      !isFiniteNumber(scenario.temperatureMedianC) || !Array.isArray(scenario.emissions)) return false;
    for (const year of milestoneYears) {
      const points = scenario.emissions.filter((item: unknown) => isRecord(item) && item.year === year);
      if (points.length !== 1 || !isRecord(points[0])) return false;
      const point = points[0];
      if (id === "current-policies") {
        if (!isFiniteNumber(point.low) || !isFiniteNumber(point.high) || point.low > point.high) return false;
      } else if (!isFiniteNumber(point.value)) return false;
    }
  }
  return Array.isArray(value.supportingSources) && value.supportingSources.length > 0 &&
    value.supportingSources.every((item: unknown) => isRecord(item) &&
      ["name", "role", "caveat"].every((key) => isText(item[key])) && isHttpsUrl(item.url));
}

export function PublishedScenarioReferences() {
  const { data, isLoading, isError, isFetching, refetch } = useQuery<unknown>({
    queryKey: ["/api/reference-scenarios"],
  });
  const reference = isPublishedReferences(data) ? data : null;
  const policies = reference?.scenarios.find((scenario) => scenario.id === "current-policies");
  const commitments = reference?.scenarios.find((scenario) => scenario.id === "all-announced-commitments");
  const linkClass = "underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <section
      aria-labelledby="published-references-heading"
      data-testid="published-scenario-references"
      className="rounded-lg border bg-card text-card-foreground p-4 sm:p-6 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Independent published references</p>
          <h2 id="published-references-heading" className="text-lg font-semibold">Published climate scenarios</h2>
          <p className="text-sm text-muted-foreground">
            External context, not dashboard projection outputs. These references do not change the
            headline calculation or complete Package 2.
          </p>
        </div>
        <span className="rounded-md border px-2.5 py-1 text-xs font-medium">Read-only reference</span>
      </div>

      {isLoading ? (
        <div role="status" aria-label="Loading published scenario references" className="space-y-3">
          <span className="sr-only">Loading published scenario references…</span>
          <div className="h-24 rounded-md bg-muted animate-pulse" />
          <div className="h-36 rounded-md bg-muted animate-pulse" />
        </div>
      ) : isError || !reference || !policies || !commitments ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isError ? "Published references could not be loaded." : "No complete, valid published reference is available."}
            </p>
            <p className="text-xs text-muted-foreground">No reference values are shown. Dashboard calculations are unchanged.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Retrying…" : "Retry"}
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="font-medium">{reference.source.name} · <time dateTime={reference.source.publishedAt}>
              {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
                .format(new Date(`${reference.source.publishedAt}T00:00:00Z`))}
            </time></span>
            <a href={reference.source.url} target="_blank" rel="noopener noreferrer" className={linkClass}>Source publication</a>
            <a href={reference.source.workbookUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>Original CAT workbook</a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[policies, commitments].map((scenario) => (
              <div key={scenario.id} className="rounded-md border p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">{scenario.label}</h3>
                  <p className="text-xs text-muted-foreground mt-1">CAT: {scenario.publishedName}</p>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tracking-tight tabular-nums">{scenario.temperatureMedianC.toFixed(1)}°C</span>
                  <span className="text-xs text-muted-foreground">published median · 2100</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{scenario.definition}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {reference.temperatureMetric}. Climate model: {reference.climateModel}.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="text-left pb-3">
                <span className="block font-semibold text-foreground">Milestone emissions comparison · {reference.emissionsUnit}</span>
                <span className="block mt-1 text-xs text-muted-foreground">
                  Current policies: low–high policy-pathway range, not an uncertainty probability interval.
                  Optimistic commitments: separate single values, not a range.
                </span>
              </caption>
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 text-left font-medium">Year</th>
                  <th scope="col" className="py-2 px-2 text-right font-medium">Current policies<br /><span className="text-xs font-normal">Policy-pathway range</span></th>
                  <th scope="col" className="py-2 pl-4 text-right font-medium">All commitments delivered<br /><span className="text-xs font-normal">Optimistic single value</span></th>
                </tr>
              </thead>
              <tbody>
                {milestoneYears.map((year) => {
                  const policy = policies.emissions.find((point) => point.year === year)!;
                  const optimistic = commitments.emissions.find((point) => point.year === year)!;
                  return (
                    <tr key={year} className="border-b last:border-0">
                      <th scope="row" className="py-3 pr-4 text-left font-normal tabular-nums">{year}</th>
                      <td className="py-3 px-2 text-right tabular-nums">{policy.low!.toFixed(1)}–{policy.high!.toFixed(1)}</td>
                      <td className="py-3 pl-4 text-right tabular-nums">{optimistic.value!.toFixed(1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rounded-md border bg-muted/30 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Different inventory baseline · not directly interchangeable</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{reference.comparisonCaveat}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{reference.refreshPolicy}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Supporting sources · context, not calculation inputs</h3>
            {reference.supportingSources.map((source) => (
              <div key={source.name} className="border-l-2 pl-3 space-y-1">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className={`text-sm font-medium ${linkClass}`}>{source.name}</a>
                <p className="text-xs text-muted-foreground leading-relaxed">{source.role} {source.caveat}</p>
              </div>
            ))}
          </div>

          <div className="rounded-md border p-4 space-y-1" data-testid="published-reference-licence">
            <p className="text-sm font-semibold">NON-COMMERCIAL data use only</p>
            <p className="text-xs">{reference.source.licence}</p>
            <p className="text-xs">Attribution: {reference.source.attribution}</p>
            <p className="text-xs">{reference.source.copyright}</p>
            <p className="text-xs text-muted-foreground pt-1">Pinned release: {reference.version}</p>
          </div>
        </>
      )}
    </section>
  );
}
