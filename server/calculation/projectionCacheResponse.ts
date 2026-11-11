/**
 * Keep the response consumer (including downstream res.json middleware) from
 * owning a reference to a route-local cached analytical object. This is not an
 * analytical transformation: dates, numbers, order and JSON values are retained.
 */
export function detachProjectionCacheResponse<T>(value: T): T {
  return structuredClone(value);
}
