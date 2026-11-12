import { createEconomicBridgeService, publicEconomicBridgeAdapters } from "../server/producerReserveApi";
import { economicBridgeCells, economicBridgeContracts, economicBridgeSupplementalCensus } from "../shared/economicBridgeSchema";

/** Read-only supplemental inventory. Does not regenerate a canonical ledger or
 * award original-cohort closure. The producer adapter refuses absent/stale
 * pre-solve receipts BEFORE executing its model. */
const service = createEconomicBridgeService(publicEconomicBridgeAdapters);
const calculations = [];
for (const adapter of publicEconomicBridgeAdapters) {
  const body = await service.execute(adapter.key);
  const cells = economicBridgeCells(body);
  const leaves = cells.map(cell => {
    const value: unknown = JSON.parse(cell.jsonValue);
    return { pointer: cell.pointer, type: value === null ? "null" : Array.isArray(value) ? "array" : typeof value,
      missingness: value === null ? "explicit null preserved; never zero-filled" : "literal present value or container" };
  });
  calculations.push({
    key: adapter.key, route: economicBridgeContracts[adapter.key].route,
    resultHash: body.identity.resultHash, sourceArchiveId: body.identity.codeArtifact.id,
    inputParent: body.identity.parent, exactPublicBodyLeafAndContainerCount: leaves.length,
    structuralFields: [...new Set(leaves.map(leaf => leaf.pointer.replace(/\/\d+(?=\/|$)/g, "/*")))].sort(),
    leaves,
    semanticAuthority: "Exact public worker report carries source facts separately from assumptions, all units/formulas, claims/refusals and missingness; identity binds exact worker code and actual executed output. Serialization fields are not new original1001 slots.",
  });
}
console.log(JSON.stringify({ ...economicBridgeSupplementalCensus, calculations }, null, 2));
