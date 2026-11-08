/** Read-only provider audit. No identity, lifecycle or financial approvals. */
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { contentHash } from "../server/calculation/analysisManifest";
import { fmpRequest, figiRequest, type Profile } from "../server/financialData/provider";
import { diagnoseMapping } from "../server/financialData/mappingDiagnostics";
const root = "generated-artifacts/financial-data";
const source = JSON.parse(await readFile(`${root}/mapping-audit.json`, "utf8"));
const selected = ["unmatched", "ambiguous"].flatMap(status =>
  source.results.filter((r: any) => r.status === status)
    .sort((a: any,b: any) => contentHash({ isin: a.isin, seed: "audit-20261108" })
      .localeCompare(contentHash({ isin: b.isin, seed: "audit-20261108" }))).slice(0,50));
const selectionHash = contentHash(selected.map((r: any) => ({ companyId: r.companyId, isin: r.isin, status: r.status })));
const path = `${root}/root-cause-audit.json`;
await mkdir(root, { recursive: true });
let rows: any[] = [];
try {
  const previous = JSON.parse(await readFile(path, "utf8"));
  if (previous.selectionHash !== selectionHash) throw new Error("Frozen audit sample changed");
  rows = previous.rows;
} catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
let errors = 0;
for (const item of selected) {
  if (rows.some(r => r.companyId === item.companyId)) continue;
  try {
    const [figi] = await figiRequest([item.isin]);
    if (figi.error) throw new Error("OpenFIGI job error");
    const search = await fmpRequest("search-isin", { isin: item.isin });
    const profiles: Profile[] = [];
    for (const result of search.slice(0, 10)) {
      if (typeof result.symbol !== "string") continue;
      const [profile] = await fmpRequest("profile", { symbol: result.symbol });
      if (profile) profiles.push(profile as unknown as Profile);
      await new Promise(r => setTimeout(r,350));
    }
    rows.push({ companyId: item.companyId, originalStatus: item.status,
      collectedAt: new Date().toISOString(), searchCount: search.length,
      profileCollectionTruncated: search.length > 10, profiles, figi,
      ...diagnoseMapping(item.isin, profiles, figi.data ?? []) });
    errors = 0;
  } catch (e) {
    errors++;
    console.error(`Audit provider failure: ${e instanceof Error ? e.message : "unknown"}`);
  }
  const report = { selectionHash, requested: selected.length, completed: rows.length,
    sourceAuditHash: contentHash(source.results), selection: "50 deterministic hash-sampled cases per original state",
    accepted: false, rows };
  await writeFile(path+".tmp", JSON.stringify(report,null,2));
  await rename(path+".tmp",path);
  console.log(`Root-cause evidence saved: ${rows.length}/${selected.length}`);
  if (errors >= 3) throw new Error("Three consecutive provider failures; checkpoint retained");
  await new Promise(r => setTimeout(r,2700));
}
console.log(JSON.stringify({ completed: rows.length, requested: selected.length,
  reasons: rows.reduce((a,r) => { for (const reason of r.reasons) a[reason]=(a[reason]??0)+1; return a; },{}) }));
