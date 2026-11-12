/** Each archive load owns one depth-first verification graph. A shared retained
 * parent is verified once, never once per path through a historical diff DAG.
 * Limits REFUSE the entire load; they never truncate/skip dependencies or return
 * a partially verified result. No cross-request cache can hide removed parents.
 */
export const RESULT_GRAPH_LIMITS = { maxDepth: 32, maxNodes: 512 } as const;
export function boundedResultGraphReader<T>(
  read: (id: string, loadParent: (id: string) => Promise<T>) => Promise<T>,
  limits: { maxDepth: number; maxNodes: number } = RESULT_GRAPH_LIMITS,
) {
  const verified = new Map<string, T>(), active = new Set<string>();
  let visited = 0;
  const load = async (id: string): Promise<T> => {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid retained result graph identity");
    if (active.has(id)) throw new Error("Retained result dependency cycle; no partial verification");
    if (verified.has(id)) return verified.get(id)!;
    if (active.size >= limits.maxDepth || visited >= limits.maxNodes)
      throw new Error("Retained result dependency graph budget exceeded; no dependencies skipped");
    visited++;
    active.add(id);
    try {
      const node = await read(id, load);
      verified.set(id, node);
      return node;
    } finally { active.delete(id); }
  };
  return load;
}
