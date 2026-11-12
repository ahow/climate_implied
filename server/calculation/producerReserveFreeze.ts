/** Public allowlisted evidence only. No generated/private file reads or path dependency.
 * Original freeze bytes are retained unchanged. The later ES-target compatibility edit
 * changes Set iteration syntax only; semantic model/domain hashes remain unchanged.
 */
export const producerReserveFreezeEvidence = {
  frozenAt: "2026-11-12T14:30:39.281Z",
  freezeSha256: "03c88f118156484be83d9695088d31ab035cf25bf7f79cd83b841b2c1c07bb45",
  domainHash: "d4753022234baf2852d3ab8f9cd640636bb714570564b41f5ff7eeecf9dc8873",
  modelSemanticHash: "9336d02597e9e099717a37a646eafea66ce72a80ef488e87a09c8b5547342c18",
  modelSourceSha256AtFreeze: "b55478acf1a73b018a95b7eefef7e5d09fec20dac99df2b7676735fb32288d9e",
  modelSourceSha256Current: "0687b9111c2db1b9b8d6f8b7871992265fe2ee2f09879f08f723ce4180d47123",
  postFreezeChange: "Mechanical ES target compatibility only: Set spread replaced by Array.from(Set), preserving insertion order, equality and deduplication; no formula, domain, fact, timing, tolerance or result changed.",
  validationStatus: "Present-run conditional freeze, not historical availability or independent approval",
} as const;
