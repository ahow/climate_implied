/**
 * Authorized shell only. Uses configured database credentials without printing
 * them. Does not bypass proposal review or operate on production by default.
 *
 * npx tsx script/operator-indicators.ts approve <proposal-id>
 * npx tsx script/operator-indicators.ts reject <proposal-id>
 * npx tsx script/operator-indicators.ts collect
 *
 * For a deliberately configured production shell, add --production-authorized.
 */
async function main() {
  const args = process.argv.slice(2);
  if (process.env.NODE_ENV === "production" && !args.includes("--production-authorized"))
    throw new Error("Explicit --production-authorized is required in a production shell");
  const [command, id] = args.filter(a => a !== "--production-authorized");
  if (!["approve", "reject", "collect"].includes(command ?? ""))
    throw new Error("Use approve <proposal-id>, reject <proposal-id>, or collect");
  if (command === "collect") {
    const { runFetch } = await import("../server/dataIngestion/orchestrator");
    await runFetch("manual");
    console.log("Collection completed; proposals still require review.");
  } else {
    if (!id || !/^[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error("Valid proposal ID required");
    const { approveProposal, rejectProposal } = await import("../server/dataIngestion/dataStore");
    const result = await (command === "approve" ? approveProposal(id) : rejectProposal(id));
    if (!result) throw new Error("Proposal not pending or not found; no transition applied");
    console.log(JSON.stringify({ id: result.id, status: result.status }));
  }
}
main().then(() => process.exit(0)).catch(e => {
  // Database/provider exceptions can contain sensitive connection details.
  console.error("Operator command failed. Verify command, proposal state and authorized database configuration.");
  process.exit(1);
});
