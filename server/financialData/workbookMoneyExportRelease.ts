import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readWorkbookMoneyAudit } from "./workbookMoneyExport";
import { rememberReportRelease, rememberReportReleaseFailure } from "../snapshots/reportMaterialContext";
/** Additive source-release capture around the immutable validated monetary
 * reader. Its original source, guards, summaries and frozen receipts stay exact.
 * A race between reads refuses provenance, never invents replacement amounts. */
export async function readWorkbookMoneyExportRelease() {
  const summary = await readWorkbookMoneyAudit(), root = "generated-artifacts/workbook-money-audit-v1";
  try {
    const privateAudit = await readFile(`${root}/private-audit.json`, "utf8");
    const reconciliation = await readFile(`${root}/denomination-reconciliation.json`, "utf8");
    const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
    if (hash(privateAudit) !== summary.sourceMetadataHash || hash(reconciliation) !== summary.denominationReconciliationHash)
      return rememberReportReleaseFailure(summary, "Monetary provenance source changed between authenticated reads; ordinary safe summary remains available without attestation");
    return rememberReportRelease(summary, "workbook-money-audit", { version: "money-audit-consumed-source-1", summary,
      privateAudit, reconciliation, meaning: "Exact private safe-summary/audit/reconciliation source release; no new monetary approval or private publication" });
  } catch {
    // Original authenticated reader already succeeded. Additional provenance
    // capture cannot disable its correct ordinary export; no proof is attached.
    return rememberReportReleaseFailure(summary, "Additional monetary provenance source capture unavailable; original authenticated safe export remains available without attestation");
  }
}
