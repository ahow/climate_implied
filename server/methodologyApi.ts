import type { Express } from "express";
import { methodologyRegistry } from "../shared/methodologyRegistry";
import { serverDownloadRegistry } from "../shared/serverDownloadRegistry";

export function registerMethodologyApi(app: Express) {
  app.get("/api/methodology/registry", (req, res) => {
    if (Object.keys(req.query).length) return res.status(400).json({ error: "Methodology definitions accept no overrides" });
    return res.set("Cache-Control", "public, max-age=300").json({
      ...methodologyRegistry(), serverDownloads: serverDownloadRegistry,
    });
  });
}
