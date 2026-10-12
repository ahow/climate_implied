import type { RequestHandler } from "express";

const methods = ["absolute", "sector_relative", "sub_sector_relative", "industry_relative"];
const signals = ["carbon_intensity", "sdg_exposure", "decarb_ambition", "decarb_gap"];
type Query = Record<string, unknown>;

function scalar(query: Query, key: string): string | undefined {
  const value = query[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${key} must be a single non-empty value`);
  return value;
}

function numeric(query: Query, key: string, min: number, max: number, integer = false): void {
  const raw = scalar(query, key);
  if (raw === undefined) return;
  const value = Number(raw);
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(raw) ||
      !Number.isFinite(value) || value <= min || value > max || (integer && !Number.isSafeInteger(value))) {
    throw new Error(`${key} must be ${integer ? "an integer" : "a finite number"} greater than ${min} and at most ${max}`);
  }
}

function choice(query: Query, key: string, values: string[], required = false): void {
  const value = scalar(query, key);
  if ((required && value === undefined) || (value !== undefined && !values.includes(value))) {
    throw new Error(`${key} must be one of: ${values.join(", ")}`);
  }
}

/** Validate before database/model work; omitted parameters alone receive defaults. */
export function validateCvQuery(path: string, query: Query): void {
  // Express routes are case-insensitive and accept a trailing slash by default.
  path = path.toLowerCase().replace(/\/+$/, "");
  const costRoutes = ["/sdg-growth", "/decarb-terciles", "/decarb-gap/summary", "/decarb-gap/timeseries"];
  if ([...costRoutes, "/carbon-price", "/backtest"].includes(path)) scalar(query, "geography");
  if (costRoutes.includes(path)) numeric(query, "costOfEquity", 0, 1);
  if (["/decarb-terciles", "/decarb-gap/summary", "/decarb-gap/timeseries"].includes(path)) {
    choice(query, "method", methods);
  }
  if (path === "/decarb-bands" && query.costOfEquity !== undefined) {
    throw new Error("decarb-bands does not use costOfEquity; it selects a target-rate band by aggregate P/E");
  }
  if (path === "/carbon-price") {
    if (query.uploadId === undefined) throw new Error("uploadId is required; select a completed dataset from /api/cv/uploads");
    numeric(query, "uploadId", 0, 2147483647, true);
    choice(query, "method", ["absolute", "sector_relative"], true);
    choice(query, "includeScope3", ["true", "false"]);
    choice(query, "winsorize", ["true", "false"]);
    numeric(query, "winsorizePercentile", 0, 49, true);
    choice(query, "inferenceMethod", ["carbon_intensity", "climate_revenue", "decarbonization_ambition"]);
    if (query.costOfEquity !== undefined) throw new Error("carbon-price uses a fixed costOfEquity of 0.08; this parameter is not supported");
  }
  if (path === "/backtest") {
    const allowed = ["signal", "trackingError", "trackingErrorUnit", "method", "geography", "format", "strategy", "costOfEquity"];
    for (const key of Object.keys(query)) {
      if (!allowed.includes(key)) throw new Error(`Unsupported backtest parameter: ${key}`);
    }
    choice(query, "signal", signals);
    numeric(query, "trackingError", 0, 20);
    choice(query, "trackingErrorUnit", ["percent"]);
    choice(query, "format", ["summary", "series"]);
    const signal = scalar(query, "signal") ?? "carbon_intensity";
    choice(query, "method", signal === "decarb_gap" ? methods : ["absolute"]);
    if (query.strategy !== undefined) throw new Error("strategy is not supported; request signal=decarb_gap for the former valuation-aware comparison");
    if (query.costOfEquity !== undefined) throw new Error("backtest uses a fixed costOfEquity of 0.08 for decarb_gap; this parameter is not supported");
  }
}

export const validateCvRequest: RequestHandler = (req, res, next) => {
  try {
    validateCvQuery(req.path, req.query);
    next();
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};
