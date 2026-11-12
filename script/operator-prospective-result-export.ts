import { pathToFileURL } from "node:url";
import {
  captureStoredProspectiveResultExport, readStoredProspectiveResultExport, prospectiveExportStoreConfig,
} from "../server/snapshots/prospectiveResultExportLifecycle";

/** Existing authorized workspace shell only. No approval action or HTTP token.
 * Provision a private 0700 directory separately, then explicitly configure
 * NODE_ENV=development PROSPECTIVE_RESULT_EXPORT_DIR=/absolute/existing/path.
 * capture <retained-parent-id> <idempotency-request-id>
 * read <retained-parent-id> <idempotency-request-id> [--xlsx-stdout]
 */
export async function runProspectiveExportCommand(args: string[], env: NodeJS.ProcessEnv = process.env) {
  const [command, expectedParentResultId, requestId, format, ...extra] = args;
  if (!["capture", "read"].includes(command) || !expectedParentResultId || !requestId || extra.length ||
      (format !== undefined && (command !== "read" || format !== "--xlsx-stdout")))
    throw new Error("Usage: operator-prospective-result-export.ts capture|read <parent-id> <request-id> [read-only --xlsx-stdout]");
  // The genuine reader verifies retained result + material/source/workbook/
  // overlay dependencies. This command never captures or changes those inputs.
  const { loadAnalysisResult } = await import("../server/snapshots/results");
  const input = { expectedParentResultId, requestId }, config = prospectiveExportStoreConfig(env);
  const result = command === "capture"
    ? await captureStoredProspectiveResultExport(input, config, loadAnalysisResult)
    : await readStoredProspectiveResultExport(input, config, loadAnalysisResult);
  if (format === "--xlsx-stdout") process.stdout.write(result.bytes);
  else process.stdout.write(JSON.stringify({
    requestId, id: result.id, record: result.record,
    disposition: "disposition" in result ? result.disposition : "retained-read",
    authority: "authorized-workspace-shell", published: false, operatorApproval: false,
  }) + "\n");
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runProspectiveExportCommand(process.argv.slice(2)).then(() => process.exit(0)).catch(error => {
    console.error(error instanceof Error ? error.message : "Prospective export operation failed");
    process.exit(1);
  });
}
