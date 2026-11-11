import type { Express } from "express";
import { bindTrackBAdmission, trackBAdmissionExportDocument, type TrackBAdmissionReport } from "../shared/trackBAdmissionContract";
import { trackBPublicPinSchema, TRACK_B_PUBLIC_PREREQUISITE, type TrackBPublicPin } from "../shared/trackBDisclosureContract";
import { TrackBDisclosureError, trackBPeriodDomainHash, type PublishedTrackBReport } from "./trackBDisclosureStore";
import { trackBPublicCatalog } from "./trackBPublicCatalog";
import { contentHash } from "./calculation/analysisManifest";
import { buildTrackBAdmissionWorkbook } from "./calculation/trackBAdmissionWorkbook";

/** Parent must supply its reviewed public report resolver; no private file reads,
 * solver/study execution, approvals, cache modules or fallback report in this API. */
export function registerTrackBAdmissionRoutes(app: Express,
  readReport?: (protocolHash: string) => Promise<PublishedTrackBReport | undefined> | PublishedTrackBReport | undefined,
  catalog: readonly TrackBPublicPin[] = trackBPublicCatalog) {
  app.get("/api/research/track-b-admission/catalog", (req, res) => {
    res.set("Cache-Control", "no-store");
    if (Object.keys(req.query).length) {
      res.set("X-Field-Semantics", "trackBAdmissionHttp.error").status(400).json({ error: "Public disclosure catalog accepts no overrides" }); return;
    }
    res.set("X-Field-Semantics-Family", "trackBPublicCatalog").json({
      contract: "track-b-public-catalog-1", reports: catalog.map(pin => trackBPublicPinSchema.parse(pin)),
      availability: "Pinned publications; retained bytes validated on exact selection",
      operatorPrerequisite: TRACK_B_PUBLIC_PREREQUISITE, scientificAcceptance: false, investmentEvidence: false,
    });
  });
  for (const suffix of ["", "/export.json", "/export.xlsx"]) app.get(`/api/research/track-b-admission${suffix}`, async (req, res) => {
    const refuse = (status: number, error: string) => {
      res.removeHeader("Content-Disposition");
      return res.type("application/json").set("X-Field-Semantics", "trackBAdmissionHttp.error")
        .set("Cache-Control", "no-store").status(status).json({ error });
    };
    if (Object.keys(req.query).some(key => !["protocolHash", "reportHash", "disclosureHash"].includes(key)) ||
      typeof req.query.protocolHash !== "string" || !/^[a-f0-9]{64}$/.test(req.query.protocolHash) ||
      ["reportHash", "disclosureHash"].some(key => req.query[key] !== undefined &&
        (typeof req.query[key] !== "string" || !/^[a-f0-9]{64}$/.test(req.query[key] as string)))) {
      refuse(400, "One exact frozen protocolHash is required; no override inputs accepted"); return;
    }
    if (!readReport) {
      refuse(503, "Authorized public retained pipeline report resolver is not provisioned; API report engineering remains incomplete"); return;
    }
    try {
      const input = await readReport(req.query.protocolHash);
      if (!input) { refuse(404, "No retained Track B period assessment for this exact protocol"); return; }
      const { report, ids } = bindTrackBAdmission(input.report), identity = trackBPublicPinSchema.parse(input.identity);
      if (report.protocolHash !== req.query.protocolHash || identity.protocolHash !== report.protocolHash ||
        identity.reportHash !== contentHash(report) || identity.periodDomainHash !== trackBPeriodDomainHash(report))
        throw new Error("Returned report protocol/content/period identity mismatch");
      if ((req.query.reportHash && req.query.reportHash !== identity.reportHash) ||
        (req.query.disclosureHash && req.query.disclosureHash !== identity.disclosureHash)) {
        refuse(409, "Published identity differs from exact selected report/disclosure; no replacement returned"); return;
      }
      res.set("Cache-Control", "no-store").set("X-Field-Semantics", ids.join(","));
      res.set("X-Track-B-Report-SHA256", identity.reportHash).set("X-Track-B-Disclosure-SHA256", identity.disclosureHash)
        .set("X-Track-B-Pipeline-SHA256", identity.pipelineResultHash).set("X-Track-B-Period-Domain-SHA256", identity.periodDomainHash);
      if (suffix === "/export.xlsx") res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        .attachment(`track-b-${identity.reportHash}.xlsx`).send(buildTrackBAdmissionWorkbook(report));
      else if (suffix) res.attachment(`track-b-${identity.reportHash}.json`).json(trackBAdmissionExportDocument(report));
      else res.json(report);
    } catch (error) {
      if (error instanceof TrackBDisclosureError) { refuse(error.status, error.message); return; }
      refuse(503, "Retained Track B period assessment failed its exact public evidence contract");
    }
  });
}
