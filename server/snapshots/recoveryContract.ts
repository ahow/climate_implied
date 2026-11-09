import { z } from "zod";
export const recoveryTables = ["cv_companies", "cv_time_series", "indicator_values"] as const;

export function safeRecoveryPath(value: string) {
  if (!/^generated-artifacts\/recovery\/[a-zA-Z0-9_-]+$/.test(value))
    throw new Error("Use a dedicated ignored recovery directory");
  return value;
}

export function assertRecoveryManifest(value: unknown) {
  const result = z.object({
    version: z.literal(1),
    tables: z.array(z.object({
      table: z.enum(recoveryTables), file: z.string(),
      hash: z.string().regex(/^[a-f0-9]{64}$/), rows: z.number().int().nonnegative(),
    })).length(recoveryTables.length),
  }).parse(value);
  if (new Set(result.tables.map(t => t.table)).size !== recoveryTables.length
      || result.tables.some(t => t.file !== `${t.table}.jsonl`))
    throw new Error("Incomplete or invalid recovery table/file set");
  return result;
}
