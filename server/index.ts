import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { releaseSafety } from "./releaseSafety";
import { registerWarmingValidationReferenceRoutes } from "./warmingValidationReferenceApi";
import { quantityDescriptionMiddleware } from "./quantityDescriptionApi";
import { registerTrackBAdmissionRoutes } from "./trackBAdmissionApi";
import { loadPublishedTrackBAdmission } from "./trackBDisclosureStore";
import { registerStage10CoverageRoutes } from "./stage10CoverageApi";
import { registerWorkbookMoneyAuditApi } from "./workbookMoneyAuditApi";
import { registerQualifiedMissingnessApi } from "./qualifiedMissingnessApi";
import { registerCarbonPassThroughRoutes } from "./carbonPassThroughApi";
import { registerReadonlyDiffApi } from "./readonlyDiffApi";
import { readonlyDiffRepository } from "./snapshots/readonlyDiffStore";
import { registerMethodologyApi } from "./methodologyApi";
import { downloadManifestMiddleware } from "./downloadManifestMiddleware";
import { producerDownloadMiddleware, registerProducerDownloadRoutes } from "./producerDownload";
import { loadAnalysisResult } from "./snapshots/results";
import { registerScientificEvidenceApi } from "./scientificEvidenceApi";
import { registerProspectiveResearchApi } from "./prospectiveResearchApi";

const app = express();
const httpServer = createServer(app);
app.use(releaseSafety());

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "256kb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      // Do not copy company/provider rows or request evidence into server logs.

      log(logLine);
    }
  });

  next();
});

(async () => {
  app.use(downloadManifestMiddleware());
  app.use(producerDownloadMiddleware(loadAnalysisResult));
  registerProducerDownloadRoutes(app, loadAnalysisResult);
  registerScientificEvidenceApi(app);
  registerProspectiveResearchApi(app);
  registerMethodologyApi(app);
  app.use(quantityDescriptionMiddleware());
  registerWarmingValidationReferenceRoutes(app);
  // Exact source-pinned public disclosures only; no private archive fallback.
  // The genuine production catalog is empty until operator rights review/pins.
  registerTrackBAdmissionRoutes(app, loadPublishedTrackBAdmission);
  registerStage10CoverageRoutes(app);
  registerWorkbookMoneyAuditApi(app);
  registerQualifiedMissingnessApi(app);
  registerCarbonPassThroughRoutes(app);
  registerReadonlyDiffApi(app, readonlyDiffRepository);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
