import type { Express, RequestHandler } from "express";
import { operatorContract } from "./operatorContract";

/**
 * The existing workspace CLI is authenticated outside HTTP. No HTTP principal
 * exists, so neither private read nor capture is permitted over HTTP, even in
 * DEV or with spoofed user/role/loopback headers. Never opens a private store.
 */
export const denyPrivateProspectiveExport: RequestHandler = (_req, res) => {
  res.set("Cache-Control", "no-store").status(403).json({
    error: "operator-cli-required",
    authority: operatorContract.authority,
    message: "Private prospective export capture and read require the existing authorized workspace CLI; no HTTP operator authentication is implemented.",
  });
};

export function registerProspectiveResultExportBoundary(app: Express) {
  app.all("/api/analysis/results/:id/prospective-exports", denyPrivateProspectiveExport);
  app.all("/api/analysis/results/:id/prospective-exports/:requestId", denyPrivateProspectiveExport);
}
