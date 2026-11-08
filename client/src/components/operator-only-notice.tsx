export const OPERATOR_ONLY_REASON = "Read-only dashboard. Uploads, resets, collection, approvals, rejections and manual data changes require the operator CLI. Public HTTP mutations are denied (403 operator-cli-required).";

export function OperatorOnlyNotice() {
  return (
    <aside role="note" className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground" data-testid="operator-only-notice">
      <strong className="text-foreground">Operator-only changes. </strong>
      {OPERATOR_ONLY_REASON} Reloading views only reads existing results; it does not collect data or run a new scientific model.
    </aside>
  );
}
