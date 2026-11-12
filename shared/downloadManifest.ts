import { exportContracts, type ExportKind } from "./downloadClaims";
import { requireHistoricalType } from "./historicalTypes";
import { scientificEvidenceStatuses } from "./scientificEvidence";

/** Server-authored only after retained-result and material-archive verification.
 * Deliberately NOT an input to createDownloadManifest: UI/caller assertions
 * cannot upgrade an ordinary view export to an authenticated producer export. */
export interface RetainedProducerIdentity {
  version: "retained-producer-binding-v1";
  resultId: string;
  resultHash: string;
  manifestId: string;
  materialInputsId: string;
  codeArchiveId: string;
  modelVersion: string;
  orderedSnapshotHashes: string[];
  scenario: string;
  meaning: string;
  scientificAcceptance: boolean;
}

export interface DownloadManifestInput {
  filename: string;
  kind: ExportKind;
  exportedAt: string;
  dataHash: string;
  hashMethod: string;
  selection: unknown;
  requestContext?: unknown;
  rows?: Record<string, unknown>[];
  columnBindings?: unknown;
  sheets?: string[];
}

/** Exact declarations only. No current/revised type substituted for missing
 * original-vintage evidence. A partial or inconsistent declaration fails closed.
 */
export function downloadHistoricalTypes(rows: Record<string, unknown>[] = []) {
  const found = new Map<string, { "Historical type code": string; "Historical type label": string }>();
  for (const row of rows) {
    const code = row["Historical type code"] ?? row.historicalTypeCode;
    const label = row["Historical type label"] ?? row.historicalTypeLabel;
    if (code === undefined && label === undefined) continue;
    const type = requireHistoricalType({ historicalTypeCode: code, historicalTypeLabel: label });
    found.set(type["Historical type code"], type);
  }
  return Array.from(found.values());
}

/** Manifest is metadata, never an immutable analysis archive or source approval.
 * UI state and transport pins are not authenticated producer provenance.
 */
export function createDownloadManifest(input: DownloadManifestInput) {
  if (!Object.hasOwn(exportContracts, input.kind)) throw new Error("Unknown download claim");
  if (!/^[a-f0-9]{64}$/.test(input.dataHash)) throw new Error("Download requires an exact SHA-256 identity");
  const historicalTypes = downloadHistoricalTypes(input.rows);
  return {
    version: "download-manifest-v1",
    filename: input.filename,
    exportedAt: input.exportedAt,
    claim: { kind: input.kind, ...exportContracts[input.kind] },
    dataIdentity: { algorithm: "SHA-256", hash: input.dataHash, method: input.hashMethod },
    requestedUiSelection: structuredClone(input.selection ?? null),
    producerIdentity: null as RetainedProducerIdentity | null,
    requestContext: structuredClone(input.requestContext ?? null),
    selectionBoundary: "Requested UI selection only, NOT certified input/model/run identity or proof that these data were produced from those selections. Null requestedUiSelection means no archived UI selection was supplied, not certified current inputs. Producer identity is unavailable (null); response/query pins are transport context only, not an authenticated complete input/model/run binding. Export time is not publication time or original-vintage evidence.",
    historicalTypes,
    historicalTypeBoundary: historicalTypes.length
      ? "Exact declarations retained from exported rows; declarations alone do not authenticate vintage."
      : "No historical type declared by this payload; no archived-forecast or verified-past-input label assigned.",
    columnBindings: input.columnBindings ?? null,
    sheets: input.sheets ?? [],
    scientificEvidence: scientificEvidenceStatuses(),
    methodology: "/api/methodology/registry",
    scientificAcceptance: false,
  };
}

/** Values serialized as JSON, including strings, so spreadsheet readback is
 * unambiguous and objects/null/booleans are not silently flattened or dropped.
 */
export function downloadManifestRows(manifest: ReturnType<typeof createDownloadManifest>) {
  return Object.entries(manifest).map(([Field, value]) => ({ Field, Value: JSON.stringify(value) }));
}
