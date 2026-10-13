// Development-only aggregate capture. Never exports company rows or credentials.
import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const domain = process.env.REPLIT_DEV_DOMAIN;
if (!domain) throw new Error("REPLIT_DEV_DOMAIN is required");
const response = await fetch(`https://${domain}/api/projection`);
if (!response.ok) throw new Error(`Projection capture failed: ${response.status}`);
const result = await response.json();
const output = process.argv[2] || "generated-artifacts/calculation-baselines/before-package1.json";
if (!output.startsWith("generated-artifacts/")) throw new Error("Use excluded generated-artifacts storage");
const { dirname } = await import("node:path");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({
  capturedAt: new Date().toISOString(),
  scope: "development; existing effective inputs and outputs, not production or scientific validation",
  sha256: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
  result,
}, null, 2));
console.log(`Saved development calculation snapshot: ${output}`);
