import type { SourceAdapter } from "./types";
import { noaaAdapter } from "./noaa";
import { owidAdapter } from "./owid";
import { worldBankAdapter } from "./worldBank";
import { perplexityAdapter } from "./perplexity";
import { derivedAdapter } from "./derived";

// Order matters: API + web-search adapters run first to populate values that the
// derived adapter consumes. The derived adapter MUST be last.
export const ADAPTERS: SourceAdapter[] = [
  noaaAdapter,
  owidAdapter,
  worldBankAdapter,
  perplexityAdapter,
  derivedAdapter,
];

export type { SourceAdapter };
