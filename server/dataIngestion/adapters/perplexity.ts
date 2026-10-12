import { fetchWithTimeout, todayIso, type FetchedValue, type SourceAdapter } from "./types";
import { INDICATORS, type IndicatorDef, type IndicatorKey } from "../indicatorRegistry";

const PPLX_URL = "https://api.perplexity.ai/chat/completions";
const MODEL = "sonar";

const WEB_SEARCH_DEFS: IndicatorDef[] = INDICATORS.filter(
  (d) => d.fetchMethod === "websearch"
);

interface PplxResponse {
  choices?: { message?: { content?: string } }[];
  citations?: string[];
}

function extractJson(text: string): any | undefined {
  // Try fenced code block first, then first {...} block.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const braceMatch = candidate.match(/\{[\s\S]*\}/);
  if (!braceMatch) return undefined;
  try {
    return JSON.parse(braceMatch[0]);
  } catch {
    return undefined;
  }
}

async function fetchOne(
  def: IndicatorDef,
  apiKey: string
): Promise<FetchedValue | undefined> {
  const system =
    "You are a precise climate-data research assistant. Use web search to find the single most recent authoritative value for the requested indicator. " +
    "Respond ONLY with a JSON object: {\"value\": <number|null>, \"year\": <integer>, \"sourceUrl\": <string>, \"note\": <short string>}. " +
    "If you cannot find an authoritative numeric value for this exact indicator, set \"value\" to null — do NOT guess, do NOT return 0, and do NOT substitute a different metric. " +
    "Use the same primary source named in the request for continuity. Do not include any text outside the JSON.";
  const user = `Indicator: ${def.label}. Unit: ${def.unit}. ${def.searchHint ?? ""} ` +
    `Return the numeric value in the unit "${def.unit}" (for fractions return a decimal between 0 and 1, for percentages return the percentage number). ` +
    `Only return a value for THIS EXACT indicator — the same metric, same global/surveyed scope, and same source described above. ` +
    `Do NOT substitute a related metric, a single-country or single-region figure, or a different survey question. ` +
    `If the only data you can find is for a different metric, scope, or population, return "value": null.`;

  let resp: Response;
  try {
    resp = await fetchWithTimeout(
      PPLX_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.1,
          max_tokens: 400,
        }),
      },
      20000
    );
  } catch (e) {
    console.warn(`[perplexity] ${def.key} request error:`, (e as Error).message);
    return undefined;
  }

  if (!resp.ok) {
    console.warn(`[perplexity] ${def.key} failed: ${resp.status}`);
    return undefined;
  }

  const json = (await resp.json()) as PplxResponse;
  const content = json.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);
  if (!parsed || typeof parsed.value !== "number" || !Number.isFinite(parsed.value)) {
    console.warn(`[perplexity] ${def.key} unparseable / no-value response`);
    return undefined;
  }

  // Reject implausible values. The model sometimes returns 0 (or a negative) as a
  // "no data found" sentinel; for every web-search indicator (capacities, shares,
  // rates) a non-positive value is never legitimate and would zero out the series
  // if approved. Fractions must additionally fall within (0, 1].
  if (parsed.value <= 0 || (def.unit === "fraction" && parsed.value > 1)) {
    console.warn(
      `[perplexity] ${def.key} implausible value ${parsed.value} (unit ${def.unit}) — discarded`
    );
    return undefined;
  }

  const year =
    typeof parsed.year === "number" && Number.isFinite(parsed.year)
      ? Math.round(parsed.year)
      : new Date().getFullYear();
  const sourceUrl =
    typeof parsed.sourceUrl === "string"
      ? parsed.sourceUrl
      : json.citations?.[0];

  return {
    indicatorKey: def.key,
    year,
    value: parsed.value,
    source: def.source,
    sourceUrl,
    asOfDate: todayIso(),
    method: "websearch",
    rawContext:
      (typeof parsed.note === "string" ? parsed.note + " " : "") +
      (json.citations?.length ? `Citations: ${json.citations.join(", ")}` : ""),
  };
}

export const perplexityAdapter: SourceAdapter = {
  id: "perplexity",
  keys: WEB_SEARCH_DEFS.map((d) => d.key) as IndicatorKey[],
  async fetch(): Promise<FetchedValue[]> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      console.log(
        "[perplexity] PERPLEXITY_API_KEY not set — skipping web-search indicators (curated values retained)"
      );
      return [];
    }

    const out: FetchedValue[] = [];
    for (const def of WEB_SEARCH_DEFS) {
      const result = await fetchOne(def, apiKey);
      if (result) out.push(result);
    }
    return out;
  },
};
