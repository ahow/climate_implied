/** SEC complete-submission extraction only; never fetches or exports raw source bytes. */
export function sourceExhibit(sgml: string, type: string) {
  const documents = Array.from(sgml.matchAll(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/g));
  const hits = documents.filter(m => m[1].match(/<TYPE>([^\r\n]+)/)?.[1] === type);
  if (hits.length !== 1) throw new Error("Exactly one declared exhibit required");
  const name = hits[0][1].match(/<FILENAME>([^\r\n]+)/)?.[1];
  if (!name || !/^[\w.-]+$/.test(name)) throw new Error("Safe declared filename required");
  return { name, body: hits[0][1] };
}
export function embeddedSecJpegs(sgml: string) {
  return Array.from(sgml.matchAll(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/g)).filter(m => /<TYPE>GRAPHIC\r?\n/.test(m[1])).map(m => {
    const d = m[1], name = d.match(/<FILENAME>([^\r\n]+)/)?.[1];
    if (!name || !/^[\w.-]+\.jpg$/i.test(name)) throw new Error("Declared JPEG filename required");
    const start = d.indexOf(`begin 644 ${name}`);
    if (start < 0) throw new Error("Matching UU header required");
    const out: number[] = [], lines = d.slice(start).split(/\r?\n/);
    let ended = false;
    for (const raw of lines.slice(1)) {
      if (raw === "end") { ended = true; break; }
      if (!raw) continue; // A zero-length UU row can become empty after trailing-space trimming.
      if (/[^\x20-\x60]/.test(raw)) throw new Error("Invalid UU data line");
      const n = (raw.charCodeAt(0) - 32) & 63;
      if (n > 45) throw new Error("UU line length exceeded");
      if (!n) continue;
      // Standard UU encodings may trim trailing ASCII spaces; these encode zero bits.
      const line = raw.padEnd(1 + Math.ceil(n / 3) * 4, " "), row: number[] = [];
      for (let i = 1; i < 1 + Math.ceil(n / 3) * 4; i += 4) {
        const a = Array.from(line.slice(i, i + 4)).map(c => (c.charCodeAt(0) - 32) & 63);
        row.push((a[0] << 2) | (a[1] >> 4), ((a[1] & 15) << 4) | (a[2] >> 2), ((a[2] & 3) << 6) | a[3]);
      }
      out.push(...row.slice(0, n));
      if (out.length > 20000000) throw new Error("20MB decoded image bound");
    }
    if (!ended || out[0] !== 255 || out[1] !== 216 || out[out.length - 2] !== 255 || out[out.length - 1] !== 217)
      throw new Error("Complete JPEG/UU terminator required");
    return { name, bytes: Uint8Array.from(out) };
  });
}
