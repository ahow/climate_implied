/** Immutable private sample; READ ONLY archive access, no provider/DB writes. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { contentHash } from "../server/calculation/analysisManifest";
import { loadSnapshot, resolveSnapshot } from "../server/snapshots/store";
import { sampleReturnObservations } from "../server/calculation/returnQuality";
if (process.env.NODE_ENV === "production") throw new Error("Private development source preparation only");
const snapshotId = process.argv[2];
if (!snapshotId || !/^[a-f0-9]{64}$/.test(snapshotId)) throw new Error("Explicit immutable workbook required");
const root = "generated-artifacts/return-quality";
mkdirSync(root, { recursive: true });
const protocol = JSON.parse(readFileSync("docs/Return_Quality_Protocol.json", "utf8"));
const protocolHash = contentHash(protocol);
const planPath = `${root}/${protocolHash}-${snapshotId}-freeze.json`;
const samplePath = `${root}/${protocolHash}-${snapshotId}-sample.json`;
if (existsSync(samplePath)) throw new Error("Sample already retained; no resampling");
if (!existsSync(planPath)) writeFileSync(planPath, JSON.stringify({
  frozenAt: new Date().toISOString(), protocolHash, snapshotId, protocol,
  scope: "Revised-history quality sample only; not identity approval, vintage or efficacy evidence",
}, null, 2), { flag: "wx" });
try {
  const header = await resolveSnapshot(snapshotId);
  if (!header || header.id !== snapshotId) throw new Error("Missing exact archive");
  const workbook = await loadSnapshot(header);
  const identities = new Map(workbook.companies.map(c => [c.id, c.isin]));
  const observations = workbook.timeSeries.map(r => {
    const isin = identities.get(r.companyId);
    if (!isin) throw new Error("Observation outside fixed workbook population");
    return { isin, date: new Date(r.date).toISOString().slice(0, 10), value: r.totalReturnIndex };
  });
  const result = sampleReturnObservations(observations, protocol.dataEnd, protocol.sampleSize, protocol.seed);
  const output = { protocolHash, snapshotId, preparedAt: new Date().toISOString(), ...result };
  writeFileSync(samplePath, JSON.stringify(output, null, 2), { flag: "wx" });
  console.log(JSON.stringify({ protocolHash, snapshotId, populationCount: result.populationCount,
    sampled: result.sample.length, sampleHash: contentHash(output), sourceFile: samplePath,
    sourceAcceptance: false, providerComparisonsExecuted: 0 }));
  process.exit(0);
} catch (e) { console.error((e as Error).message); process.exit(1); }
