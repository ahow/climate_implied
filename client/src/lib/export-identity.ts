/** Hash exactly the exported normalized data, independent of filename or clock. */
export function normalizedExportRows(rows: Record<string,unknown>[]) {
  return rows.map(row=>Object.fromEntries(Object.keys(row).sort().map(key=>[key,row[key] ?? null])));
}
export async function exportDataIdentity(rows: Record<string,unknown>[]) {
  const normalized=normalizedExportRows(rows);
  const bytes=new TextEncoder().encode(JSON.stringify(normalized));
  const hash=await crypto.subtle.digest("SHA-256",bytes);
  return { normalized,hash:Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,"0")).join("") };
}
/** Lossless JSON identity: hash the exact UTF-8 payload serialization, without
 * spreadsheet normalization, key sorting, null substitution or flattening. */
export async function exportJsonIdentity(payload: unknown) {
  const text = JSON.stringify(payload, null, 2);
  if (text === undefined) throw new Error("JSON export requires a serializable payload");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return { text, hash: Array.from(new Uint8Array(hash)).map(x => x.toString(16).padStart(2, "0")).join("") };
}
