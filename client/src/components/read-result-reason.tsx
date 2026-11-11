export function ReadResultReason({
  label, loading, error, available, emptyReason,
}: {
  label: string;
  loading?: boolean;
  error?: unknown;
  available: boolean;
  emptyReason: string;
}) {
  if (!loading && !error && available) return null;
  const state = error ? "error" : loading ? "loading" : "absent";
  return (
    <p role={error ? "alert" : "status"} data-read-state={state} className="text-xs text-muted-foreground">
      {label}: {error ? "Read failed for the current selection. No previous result is shown; retry the read."
        : loading ? "Loading the current selection; previous results are withheld."
        : emptyReason}
    </p>
  );
}
