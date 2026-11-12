import type { RetainedProducerIdentity } from "./downloadManifest";
import { consumerCanonicalJson } from "./derivedConsumer";

export const headlineDrilldownModes = ["contributions", "sensitivities"] as const;
export type HeadlineDrilldownMode = typeof headlineDrilldownModes[number];
export const headlineDrilldownLabels = {
  contributions: "Within-model contributions · exact Shapley · chosen constant-activity baseline",
  sensitivities: "One-at-a-time sensitivities · target minus reverted driver · not contributions",
} as const;
export interface HeadlineDrilldownSelection {
  parent: string;
  year: number;
  region?: string;
  sector?: string;
  gas?: string;
  driver?: string;
}
export interface HeadlineDrilldownRow {
  region: string;
  sector: string;
  sectorCode: string;
  gas: string;
  driver: string;
  year: number;
  memberId: string;
  baselineNativeMt: number;
  targetNativeMt: number;
  revertedDriverNativeMt: number | null;
  valueNativeMt: number;
  gwp100: number;
  valueGtCO2e: number;
}
export interface HeadlineDrilldown {
  version: "headline-drilldown-1";
  mode: HeadlineDrilldownMode;
  label: string;
  parent: RetainedProducerIdentity;
  memberId: string;
  seed: unknown;
  selection: HeadlineDrilldownSelection;
  derivation: {
    id: string;
    codeHash: string;
    method: string;
    baseline: string;
    groups: Record<string, string[]>;
    reconciliationNativeMt: number;
    parentReportingGtCO2e: number;
    targetReportingGtCO2e: number;
    filters: string;
  };
  rows: HeadlineDrilldownRow[];
  limitations: string[];
  scientificAcceptance: false;
}
export function headlineDrilldownUrl(mode: HeadlineDrilldownMode,
  selection: HeadlineDrilldownSelection, format?: "json" | "xlsx") {
  if (!headlineDrilldownModes.includes(mode) || !/^[a-f0-9]{64}$/.test(selection.parent) ||
    !Number.isInteger(selection.year) || selection.year < 2024 || selection.year > 2100)
    throw new Error("Exact retained headline and supported year required");
  const query = new URLSearchParams({ parent: selection.parent, year: String(selection.year) });
  for (const key of ["region", "sector", "gas", "driver"] as const)
    if (selection[key] !== undefined) query.set(key, selection[key]!);
  return `/api/headline-drilldown/${mode}${format ? `/export.${format}` : ""}?${query}`;
}

/** A derived response is never relabelled as the exact parent's native output. */
export function requireMatchingHeadlineDrilldown(value: HeadlineDrilldown,
  parent: RetainedProducerIdentity, mode: HeadlineDrilldownMode, selection: HeadlineDrilldownSelection) {
  if (!value || typeof value !== "object" || !value.derivation || !value.parent || !value.selection ||
    value.version !== "headline-drilldown-1" || value.mode !== mode ||
    value.label !== headlineDrilldownLabels[mode] || value.scientificAcceptance !== false ||
    consumerCanonicalJson(value.parent) !== consumerCanonicalJson(parent) ||
    consumerCanonicalJson(value.selection) !== consumerCanonicalJson(selection) ||
    !/^[a-f0-9]{64}$/.test(value.derivation.id) || !/^[a-f0-9]{64}$/.test(value.derivation.codeHash))
    throw new Error("Drilldown does not resolve to the selected retained headline");
  return value;
}

export function headlineDrilldownIdentityText(value: HeadlineDrilldown) {
  const { id, ...derivationBase } = value.derivation;
  return consumerCanonicalJson({ parent: value.parent, selection: value.selection, mode: value.mode,
    derivationBase, rows: value.rows, memberId: value.memberId, seed: value.seed });
}
export async function verifyHeadlineDrilldownIdentity(value: HeadlineDrilldown) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(headlineDrilldownIdentityText(value)));
  const id = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
  if (id !== value.derivation.id) throw new Error("Drilldown signed cells, member, seed or derivation content changed");
  return value;
}
