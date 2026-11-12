import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import * as XLSX from "xlsx";
import { contentHash } from "../server/calculation/analysisManifest";
import { assessTrackBAdmission } from "../server/calculation/trackBAdmission";
import { trackBPeriodDomainHash } from "../server/trackBDisclosureStore";
import { registerTrackBAdmissionRoutes } from "../server/trackBAdmissionApi";
import { downloadManifestMiddleware } from "../server/downloadManifestMiddleware";
import { withDownloadManifest } from "../shared/serverDownloadRegistry";
import { scientificEvidenceStatuses } from "../shared/scientificEvidence";
import { trackBAdmissionExportDocument } from "../shared/trackBAdmissionContract";

test("manifest-bound TrackB JSON/XLSX retain every unavailable engineering period without editing frozen historical test sources", async () => {
  // Negative, isolated test-only evidence; never added to the production catalog
  // and never a real publication/review/rights authorization.
  const protocol = { frozenAt: "2019-01-01T00:00:00Z", trackBPolicy: { filingLagDays: 5 },
    specifications: [{ model: "SYNTHETIC-MANIFEST-TEST-ONLY", peer: "sector", target: "next-month" }],
    expectedOrigins: ["2020-02-29T00:00:00Z", "2020-04-30T00:00:00Z"] };
  const corpus = { mode: "engineering-fixture", dataEnd: "2021-01-01T00:00:00Z", artifacts: [], periods: [] };
  const report = assessTrackBAdmission(protocol, contentHash(protocol), corpus);
  const identity = { protocolHash: report.protocolHash, reportHash: contentHash(report),
    disclosureHash: contentHash({ isolatedNegativeEngineeringMetadataTest: true }),
    pipelineResultHash: contentHash({ engineeringOnly: true, report }), periodDomainHash: trackBPeriodDomainHash(report) };
  const app = express(); app.use(downloadManifestMiddleware());
  registerTrackBAdmissionRoutes(app, hash => hash === report.protocolHash ? { report, identity } : undefined);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const address = server.address() as { port: number }, base = `http://127.0.0.1:${address.port}`;
  const path = "/api/research/track-b-admission", query = `?protocolHash=${report.protocolHash}&reportHash=${identity.reportHash}`;
  try {
    const plainJson = await fetch(`${base}${path}/export.json${query}`);
    assert.deepEqual(await plainJson.json(), trackBAdmissionExportDocument(report));
    assert.ok(plainJson.headers.get("X-Download-Manifest"));
    const enrichedJson = await (await fetch(base + withDownloadManifest(`${path}/export.json${query}`))).json();
    assert.deepEqual(enrichedJson.data, trackBAdmissionExportDocument(report));
    assert.deepEqual(enrichedJson.manifest.scientificEvidence, scientificEvidenceStatuses());
    assert.ok(enrichedJson.data.report.periods.every((period: { result: unknown; status: string }) =>
      period.result === null && period.status === "unavailable"));
    const legacyResponse = await fetch(`${base}${path}/export.xlsx${query}`);
    const original = XLSX.read(Buffer.from(await legacyResponse.arrayBuffer()), { type: "buffer" });
    const enrichedResponse = await fetch(base + withDownloadManifest(`${path}/export.xlsx${query}`));
    assert.equal(enrichedResponse.status, 200);
    const book = XLSX.read(Buffer.from(await enrichedResponse.arrayBuffer()), { type: "buffer" });
    assert.deepEqual(book.SheetNames, [...original.SheetNames, "Download manifest"]);
    for (const sheet of original.SheetNames)
      assert.deepEqual(XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1, defval: null }),
        XLSX.utils.sheet_to_json(original.Sheets[sheet], { header: 1, defval: null }));
    const decoded = Object.fromEntries(XLSX.utils.sheet_to_json<{ Field: string; Value: string }>(book.Sheets["Download manifest"])
      .map(row => [row.Field, JSON.parse(row.Value)]));
    assert.deepEqual(decoded.scientificEvidence, scientificEvidenceStatuses());
    assert.equal(decoded.scientificAcceptance, false);
    assert.equal((await fetch(base + withDownloadManifest(`${path}/export.json${query}&privatePath=denied`))).status, 400);
    assert.equal((await fetch(base + withDownloadManifest(`${path}/export.json${query}&reportHash=${"0".repeat(64)}`))).status, 400);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
