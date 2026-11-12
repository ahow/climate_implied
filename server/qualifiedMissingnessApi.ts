import type { Express, Request, Response } from "express";
import XLSX from "xlsx";
import { QualifiedMissingnessStore } from "./dataIngestion/qualifiedMissingnessStore";
import { operatorContract } from "./operatorContract";

/** Network-reachable DEV is not an operator authorization boundary.
 * No genuine HTTP principal exists in the current operator contract, and this
 * private archive has no trusted source-rights-qualified disclosure catalog.
 * Never open private bytes, even when an archive environment path is present.
 */
export function registerQualifiedMissingnessApi(app: Express) {
  const deny = (_req: Request, res: Response) => res.set("Cache-Control", "no-store").status(403).json({
    error: "operator-cli-required",
    gap: "no-existing-http-principal-or-role",
    message: "Private qualified-source review and export require the authorized workspace operator CLI. No genuine operator HTTP principal or trusted source-rights-qualified disclosure is available.",
    httpAuthentication: operatorContract.httpAuthentication,
    privilegedHttpEligible: false,
  });
  app.get("/api/development/qualified-missingness", deny);
  app.get("/api/development/qualified-missingness/export", deny);
}

/** Explicit trusted-code injection for isolated node:test engineering checks.
 * Not an HTTP principal, licensing grant, configuration switch or app mount.
 * Default registration above never calls this or accepts injection/options.
 * Hash allowlist must come from test code, never request/env/source declarations.
 */
export function registerQualifiedMissingnessEngineeringTestApi(
  app: Express, fixture: { root: string; sourceHashes: readonly string[] },
) {
  if (process.env.NODE_ENV !== "development" || !process.env.NODE_TEST_CONTEXT)
    throw new Error("Qualified engineering HTTP injection is isolated node:test only");
  const root = fixture.root, hashes = new Set(fixture.sourceHashes);
  if (!hashes.size || Array.from(hashes).some(hash => !/^[a-f0-9]{64}$/.test(hash)))
    throw new Error("Explicit exact engineering source hashes required");
  const read = (xlsx: boolean) => (req: Request, res: Response) => {
    res.set("Cache-Control", "no-store");
    try {
      if (process.env.NODE_ENV !== "development" || !process.env.NODE_TEST_CONTEXT)
        return res.status(403).json({ error: "isolated-engineering-test-required" });
      const revision = req.query.revision;
      if (revision !== undefined && (typeof revision !== "string" || !/^[a-f0-9]{64}$/.test(revision)))
        return res.status(400).json({ error: "Expected exact review revision SHA256" });
      const store = new QualifiedMissingnessStore(root, true);
      // Validate the entire archive, not just a caller-selected historic prefix.
      // A source's own review/licence declarations cannot extend this allowlist.
      if (store.history().some(event => !hashes.has(event.sourceId)))
        return res.status(403).json({ error: "engineering-source-not-in-trusted-test-allowlist" });
      if (!xlsx) return res.json(store.view(revision));
      res.set("Content-Disposition", 'attachment; filename="development-qualified-review.xlsx"');
      res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return res.send(XLSX.write(store.export(revision), { type: "buffer", bookType: "xlsx" }));
    } catch (error) {
      return res.status(422).json({ error: error instanceof Error ? error.message : "Qualified review read failed" });
    }
  };
  app.get("/api/development/qualified-missingness", read(false));
  app.get("/api/development/qualified-missingness/export", read(true));
}
