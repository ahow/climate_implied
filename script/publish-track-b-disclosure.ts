import { publishPinnedTrackBReport } from "../server/trackBDisclosurePublisher";

async function main() {
  const [protocolHash] = process.argv.slice(2);
  if (process.argv.length !== 3 || !/^[a-f0-9]{64}$/.test(protocolHash ?? ""))
    throw new Error("Usage: authorized workspace shell: npx tsx script/publish-track-b-disclosure.ts EXACT_PROTOCOL_SHA256");
  console.log(JSON.stringify(await publishPinnedTrackBReport(protocolHash)));
}
main().catch(e => { console.error(e instanceof Error ? e.message : "Public disclosure publication refused"); process.exitCode = 1; });
