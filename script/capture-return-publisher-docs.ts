/** Bounded public publisher-document capture, never a data/provider API request.
 * No credentials, login submission, subscription, or bypass is used. */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
if (process.env.NODE_ENV === "production") throw new Error("Private development evidence capture only");
const root = "generated-artifacts/return-calendar-source/publisher";
mkdirSync(root, { recursive: true });
const sources = [
  ["actual-dates", "https://product.datastream.com/navigator/AdvanceHelpFiles/Functions/WebHelp/Actual_dates.htm"],
  ["currency-code", "https://product.datastream.com/navigator/AdvanceHelpFiles/Functions/WebHelp/Currency_code_EC.htm"],
  ["request-frequency", "https://product.datastream.com/navigator/AdvanceHelpFiles/Functions/WebHelp/Calculation_and_Request_Frequency.htm"],
  ["datatype-access", "https://product.datastream.com/browse/search.aspx?dt=true"],
  ["legacy-doc-path", "https://product.datastream.com/dswsclient/Docs/AboutDSWS.htm"],
] as const;
const results = [];
for (const [name, url] of sources) {
  const startedAt = new Date().toISOString();
  // Do not follow the data dictionary's login redirect. Public content only.
  const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(35000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  const bodyPath = `${root}/${name}.html`;
  writeFileSync(bodyPath, bytes, { flag: "wx", mode: 0o600 });
  results.push({
    name, url, capturedAt: startedAt, status: response.status,
    location: response.headers.get("location"), contentType: response.headers.get("content-type"),
    bodyPath, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
    headers: Object.fromEntries(response.headers.entries()),
  });
}
writeFileSync(`${root}/capture.json`, JSON.stringify({
  scope: "public-publisher-documentation-only", requests: results.length, results,
  noCredentialsOrLoginSubmission: true, noDataApiCalls: true,
}, null, 2) + "\n", { flag: "wx", mode: 0o600 });
console.log(JSON.stringify({ requests: results.length,
  results: results.map(({ name, status, sha256 }) => ({ name, status, sha256 })) }));
