/** This registry only consumes same-origin server response headers. There is no
 * setter taking an arbitrary UI payload/manifest or global 'current' proof. */
const retainedResults = new WeakMap<object, string>();
export function retainProducerDownload(response: Response) {
  const encoded = response.headers.get("X-Producer-Identity");
  if (!response.ok || !encoded) return response;
  let proof: any;
  try {
    proof = JSON.parse(atob(encoded.replace(/-/g, "+").replace(/_/g, "/")));
  } catch { throw new Error("Invalid server producer identity; result withheld"); }
  if (proof.version !== "retained-producer-binding-v1" ||
      !/^[a-f0-9]{64}$/.test(proof.resultId) || !/^[a-f0-9]{64}$/.test(proof.manifestId))
    throw new Error("Invalid server retained-result identity; result withheld");
  const json = response.json.bind(response);
  response.json = async () => {
    const payload = await json();
    if (payload && typeof payload === "object")
      retainedResults.set(payload, proof.resultId);
    return payload;
  };
  return response;
}
export function exactProducerDownload(payload: unknown) {
  const id = payload && typeof payload === "object" ? retainedResults.get(payload) : undefined;
  return id ? `/api/analysis/results/${id}/export.json?downloadMetadata=manifest-v1` : null;
}
