import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import { createDownloadManifest, downloadManifestRows } from "../shared/downloadManifest";
import { serverDownloadRegistry } from "../shared/serverDownloadRegistry";

/** Always attach the exact manifest as a base64url response header. Existing
 * default response bodies (and their goldens) are byte-for-byte unchanged.
 * Explicit manifest-v1 opt-in embeds it into JSON/XLSX as well. This transport
 * option never grants access, invokes a source reader or changes query pins.
 */
export function downloadManifestMiddleware(): RequestHandler {
  return (req, res, next) => {
    const selected = new URL(req.url, "https://download.invalid");
    const option = selected.searchParams.getAll("downloadMetadata");
    const optIn = option.length > 0;
    if (optIn) {
      if (option.length !== 1 || option[0] !== "manifest-v1")
        return void res.status(400).json({ error: "Unsupported download metadata version" });
      selected.searchParams.delete("downloadMetadata");
      req.url = selected.pathname + selected.search;
    }
    const entry = serverDownloadRegistry.find(item => (item.paths as readonly string[]).includes(req.path));
    const original = res.send;
    let handled = false;
    res.send = function (body: unknown) {
      if (handled || res.statusCode >= 400 || !res.getHeader("Content-Disposition")) return original.call(this, body);
      handled = true;
      if (!entry) throw new Error("Unregistered attachment route; download refused");
      const contentType = String(res.getHeader("Content-Type") ?? "");
      const bytes = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
      const json = contentType.includes("json") ? JSON.parse(bytes.toString("utf8")) : undefined;
      const workbook = contentType.includes("spreadsheetml") ? XLSX.read(bytes, { type: "buffer" }) : undefined;
      const rows: Record<string, unknown>[] = workbook
        ? workbook.SheetNames.flatMap(name => XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[name]))
        : Array.isArray(json) ? json : json?.rows ?? [];
      const disposition = String(res.getHeader("Content-Disposition"));
      const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "attachment";
      const manifest = {
        ...createDownloadManifest({ filename, kind: entry.kind, exportedAt: new Date().toISOString(),
          dataHash: createHash("sha256").update(bytes).digest("hex"),
          hashMethod: "SHA-256 of original response body bytes before optional metadata embedding",
          selection: {
            query: Object.fromEntries(selected.searchParams),
            responsePins: Object.fromEntries(Object.entries(res.getHeaders()).filter(([key]) =>
              /(?:sha256|x-analysis|x-indicator)/i.test(key))),
          },
          rows, sheets: workbook ? [...workbook.SheetNames, ...(optIn ? ["Download manifest"] : [])] : [],
          columnBindings: json?.columnBindings ?? null }),
        transportClaim: entry.claim,
        transport: optIn ? "embedded-and-header" : "header-only-legacy-body-preserved",
      };
      res.setHeader("X-Download-Manifest", Buffer.from(JSON.stringify(manifest)).toString("base64url"));
      res.setHeader("X-Download-Manifest-Encoding", "base64url-json-utf8");
      res.setHeader("X-Download-Claim", entry.claim);
      res.append("Link", '</api/methodology/registry>; rel="describedby"');
      let outgoing = body;
      if (optIn && workbook) {
        if (workbook.SheetNames.includes("Download manifest")) throw new Error("Conflicting download manifest sheet");
        XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(downloadManifestRows(manifest)), "Download manifest");
        outgoing = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      } else if (optIn && json !== undefined) {
        outgoing = JSON.stringify({ data: json, manifest });
      } else if (optIn) throw new Error("Unsupported attachment format; metadata embedding refused");
      res.removeHeader("Content-Length");
      return original.call(this, outgoing);
    };
    next();
  };
}
