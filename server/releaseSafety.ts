import type { RequestHandler } from "express";

export const publicDiagnostics = new Set([
  "/api/emissions/validate-native-pathways",
  "/api/emissions/regional-residual-diagnostics",
  "/api/calculation/ensemble-summary",
  "/api/calculation/evaluate-holdout",
  "/api/calculation/evaluate-signal",
  "/api/calculation/validate-history",
  "/api/calculation/audit-vintages",
  "/api/calculation/research-contracts",
]);
export function schedulerEnabled(value: string | undefined) { return value === "true"; }

/**
 * Public HTTP is read-only except bounded pure diagnostics. Operator writes use
 * the workspace/server CLI, whose database access is outside the public API.
 * No client secret or implicit localhost/proxy bypass.
 */
export function releaseSafety(options: { diagnosticLimit?: number } = {}): RequestHandler {
  const limit = options.diagnosticLimit ?? 30;
  let windowStart = Date.now(), used = 0;
  return (req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (req.method !== "POST" || !publicDiagnostics.has(req.path)) {
      res.status(403).json({ error: "operator-cli-required",
        message: "Public data changes are disabled. Use an authorized operator command; uploads await the immutable importer." });
      return;
    }
    // Global per-process budget deliberately does not trust proxy-controlled IPs.
    // Multi-replica rate limiting remains an infrastructure acceptance item.
    const now = Date.now();
    if (now - windowStart >= 60_000) { windowStart = now; used = 0; }
    if (++used > limit) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((windowStart + 60_000 - now) / 1000))));
      res.status(429).json({ error: "diagnostic-rate-limit" });
      return;
    }
    next();
  };
}
