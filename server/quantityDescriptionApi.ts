import type { RequestHandler } from "express";
import { FIXED_5GT_DESCRIPTOR, GORDON_DEFINITION, RETIRED_FINANCE_RESIDUAL_DESCRIPTOR } from "../shared/quantityDescriptors";

/** Presentation boundary only; original engines, numeric values and compatibility
 * keys remain unchanged. Exact old descriptions are admitted, not arbitrary text. */
export function describeQuantityResponse(path: string, payload: unknown): unknown {
  if (path === "/api/calculation-contract" && payload && typeof payload === "object" && "metricDefinitions" in payload) {
    const body = payload as { metricDefinitions: Record<string, unknown> };
    const replacements = {
      physicalResidualThreshold: ["Legacy 5 Gt annual residual (not net zero)", FIXED_5GT_DESCRIPTOR.thresholdLabel],
      financeResidualThreshold: ["Legacy 5% of starting annual emissions (not net zero)", RETIRED_FINANCE_RESIDUAL_DESCRIPTOR.description],
      financeGrowth: ["Legacy r - E/P; not a calibrated emissions-decline inference", GORDON_DEFINITION],
    };
    const metricDefinitions = { ...body.metricDefinitions };
    for (const [field, [oldText, description]] of Object.entries(replacements)) {
      if (metricDefinitions[field] !== oldText && metricDefinitions[field] !== description)
        throw new Error(`Unreviewed ${field} API description; quantity descriptor review required`);
      metricDefinitions[field] = description;
    }
    return { ...body, metricDefinitions };
  }
  if (path === "/api/projection/regions" && Array.isArray(payload))
    return payload.map(row => {
      if (!row || typeof row !== "object") throw new Error("Invalid regional description row");
      if (row.milestoneDefinition !== "Legacy 5 Gt milestone; not net zero; null means not reached by 2100" &&
        row.milestoneDefinition !== FIXED_5GT_DESCRIPTOR.description)
        throw new Error("Unreviewed regional milestone API description; quantity descriptor review required");
      return { ...row, milestoneDefinition: FIXED_5GT_DESCRIPTOR.description };
    });
  return payload;
}

/** Only successful GET JSON on the two reviewed API-description surfaces.
 * No new routes, source reads, output quantities, mutations or numerical calls. */
export function quantityDescriptionMiddleware(): RequestHandler {
  return (req, res, next) => {
    if (req.method !== "GET" || !["/api/calculation-contract", "/api/projection/regions"].includes(req.path)) return next();
    const json = res.json;
    res.json = function (body: unknown) {
      return json.call(this, this.statusCode < 400 ? describeQuantityResponse(req.path, body) : body);
    };
    next();
  };
}
