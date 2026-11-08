type Client = {
  query: (sql: string) => Promise<{ rows: { acquired?: boolean }[] }>;
  release: (error?: Error | boolean) => void;
};
/** Session lock survives the adapters' separate transactions; never use a
 * pooled query for acquire/unlock because it can select a different session. */
export async function withCollectionLock<T>(
  pool: { connect: () => Promise<Client> }, action: () => Promise<T>,
): Promise<{ acquired: false } | { acquired: true; result: T }> {
  const client = await pool.connect();
  let acquired = false, discard = false;
  try {
    const result = await client.query("SELECT pg_try_advisory_lock(126907, 1) AS acquired");
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) return { acquired: false };
    return { acquired: true, result: await action() };
  } finally {
    try {
      if (acquired) await client.query("SELECT pg_advisory_unlock(126907, 1)");
    } catch (error) {
      discard = true;
      throw error;
    } finally { client.release(discard || undefined); }
  }
}
