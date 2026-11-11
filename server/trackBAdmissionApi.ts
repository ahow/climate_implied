import type { Express } from "express";
import { bindTrackBAdmission, trackBAdmissionExportDocument, type TrackBAdmissionReport } from "../shared/trackBAdmissionContract";

/** Parent must supply its reviewed public report resolver; no private file reads,
 * solver/study execution, approvals, cache modules or fallback report in this API. */
export function registerTrackBAdmissionRoutes(app: Express,
  readReport?: (protocolHash: string) => Promise<TrackBAdmissionReport | undefined> | TrackBAdmissionReport | undefined) {
  for (const suffix of ["", "/export.json"]) app.get(`/api/research/track-b-admission${suffix}`, async (req, res) => {
    const refuse = (status: number, error: string) =>
      res.set("X-Field-Semantics", "trackBAdmissionHttp.error").set("Cache-Control", "no-store").status(status).json({ error });
    if (Object.keys(req.query).length !== 1 || typeof req.query.protocolHash !== "string" || !/^[a-f0-9]{64}$/.test(req.query.protocolHash)) {
      refuse(400, "One exact frozen protocolHash is required; no override inputs accepted"); return;
    }
    if (!readReport) {
      refuse(503, "Authorized public retained pipeline report resolver is not provisioned; API report engineering remains incomplete"); return;
    }
    try {
      const input = await readReport(req.query.protocolHash);
      if (!input) { refuse(404, "No retained Track B period assessment for this exact protocol"); return; }
      const { report, ids } = bindTrackBAdmission(input);
      if (report.protocolHash !== req.query.protocolHash) throw new Error("Returned report protocol identity mismatch");
      res.set("Cache-Control", "no-store").set("X-Field-Semantics", ids.join(","));
      if (suffix) res.attachment("track-b-period-admission-unavailable.json").json(trackBAdmissionExportDocument(report));
      else res.json(report);
    } catch {
      refuse(503, "Retained Track B period assessment failed its exact public evidence contract");
    }
  });
}
