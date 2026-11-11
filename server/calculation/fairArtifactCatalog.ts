import { createHash } from "node:crypto";

/** Pins of existing retained bytes, not regenerated scientific outputs.
 * Changing a pin is a new reviewed artifact version, never an HTTP operation. */
const retained = [
  ["fair-reference", "6f2749385f8c42d911d875ddf47a72f1e3c8e7cd1e32b9bd710b88ecf6ddc232", "e021ccc60d12ba2724e4b304c77129490095f3932230cf01fb5ec32959262235"],
  ["regional-fair-zero-history", "738b378c6d03d51ce56a604116bcf365d0cb4beec5511dbd8b3c0f5ae5817616", "6650e10693eef517cf4cc7835753d172cf916060297769f8e8d3ac9ae0b34d2f"],
  ["regional-fair-carry-history", "738b378c6d03d51ce56a604116bcf365d0cb4beec5511dbd8b3c0f5ae5817616", "76978c065c7fab0a6c313d8d0576a2bffc8a648ae7649d83ad7c94a14f5f51ca"],
  ["regional-fair-peak-history", "5baeac548c647c7bf2f4267ee691f9464a97673a1fd83d0399e82ab4c1fd3508", "cb3f977101e302a728ab9a60ece7ae4bd2bc04b7f6366dfacac02f967984b2ca"],
  ["reference-gas-infill/s0-2030-constant-2024", "09a139f709514e709137254479f728a541c8660cacc6180d5f722395ecff350b", "adeb4b2e769b1f3c76667ed4e9efa0bd88c5a18400f87505ff2e9139d1ea15fd"],
  ["reference-gas-infill/s0-2030-linear-zero-2050", "901b05b6394a282705ac32d4239edecfa477d0fee21018a9ba1b49a97044ff34", "2899db158a6735c0988b1e8a5958dc482ac3ad4af160d0d3c7713f945c30ed14"],
  ["reference-gas-infill/s0-2030-zero-after-2024", "2db9e09e15f89857f0bd53eece584f5052e412b32418d55d1a77592b0416a62e", "3930030f07a331d195268b6e7e09d737af8f75f29623a33e87678166530f9a3b"],
  ["reference-gas-infill/s0-2050-constant-2024", "d556b22761f6b9ce03065ed3cc0ae2ff8bbd2a0c1d62fc1ecf5168d64e74111b", "a37e7bc2f2c2631b57cea3bc0f2a45102251418c5ccf2eed517fad27f20ce658"],
  ["reference-gas-infill/s0-2050-linear-zero-2050", "30a328a543fc4595af7ce2b9f6e5b1a32d45a8f1c4b9a1812a60bfe5393d1df2", "964b790c64912eb67f441d6b93122cd7465a7ac71f565e168cb9dee34b373d2d"],
  ["reference-gas-infill/s0-2050-zero-after-2024", "6bad0b81b8d54431f11991f5441170a23431e885e98f34d63fbdac46ebbed17e", "4aa3899218812f0f70fd33a925c91e1e5b6edfbbf1537c18d87af26d4236b03a"],
  ["reference-gas-infill/s1-2030-constant-2024", "6c14acb34da12c52898379375ed27d884b828bd4896dc549dd7bfdd701a2e2c5", "56a1ac235a8d8abc0d81ad861f399dac649dae6cc18326f7865a5e133df56910"],
  ["reference-gas-infill/s1-2030-linear-zero-2050", "fba0366db2ed424579cddcc5d11e6c544c11520a5dbea09cbf4f742ab9a70834", "91f8e6f0d544afee3cb065b048c3db10fe551ae0dd339dd106cbf916472ffa38"],
  ["reference-gas-infill/s1-2030-zero-after-2024", "583bdb3a23eb281e49ada2a71fe2741110cc133cd3e306dcba1d09eb7ac67a5f", "af34dcf8e1344912fbd1940af7a282f514a3629bf6ee0fb8cfc9ad66450501c0"],
  ["reference-gas-infill/s1-2050-constant-2024", "b5e5820a74449830d7b0c843c7d5183f7debb271680a0dd53402aa4463a6f93d", "3e4a04db15a1c81b1cec500b4fb4c6e2751481a45ca7f75d7d63a343a47b5f4e"],
  ["reference-gas-infill/s1-2050-linear-zero-2050", "e617c2400391cefae1a2bc1bf1a2a8cff76c008e3b01ac440073a087e5f6875c", "659533ffe37060a97c6a4eb947ed1300898a87977f3b9d4644d038fb49fdc59b"],
  ["reference-gas-infill/s1-2050-zero-after-2024", "7b1f4f05d79bbe864bb8ce1b93607fcd0c11fbc3e4a90de1bdfd7af0eacf0955", "f091f689331fe11317ce64be1a1e2a7ef925ee7fd9cae817a80f1b00141ba3ce"],
] as const;

export const fairSha256 = (bytes: string | Buffer) => createHash("sha256").update(bytes).digest("hex");
export const FAIR_ARTIFACT_VERSION = "s07-offline-fair-v1";
export const FAIR_UPSTREAM_REVISION = "ec46fefc8f8c6b560a8b78ab1f4a9a5e04537f79";
export const fairArtifactCatalog = retained.map(([directory, ensembleSha256, resultSha256]) => {
  const manifest = {
    artifactId: directory.replaceAll("/", "--"),
    version: FAIR_ARTIFACT_VERSION,
    fairVersion: "2.2.4",
    upstreamRevision: FAIR_UPSTREAM_REVISION,
    ensembleSha256, resultSha256,
    memberIdsSha256: "ce25f929633422b68083893000e43fd574bb24c2c8e49cab22e86a86708c8a56",
    members: 841, startYear: 1750, endYear: 2100,
    baseline: "1850-1900",
    observable: "annual-mean-surface-temperature-anomaly-not-established-observational-GMST",
    simulationKind: "total",
    scientificAcceptance: "not-accepted",
    productionEligible: false,
    interpretation: directory === "fair-reference" ? "upstream-draft-example-not-current-policy" :
      directory.startsWith("regional-") ? "conditional-regional-control-unapproved-minor-gas-history" :
        "conditional-ngfs-native-inventory-and-infill-sensitivity-not-approved-forecast",
  } as const;
  return { directory: `generated-artifacts/${directory}`, manifest,
    manifestSha256: fairSha256(JSON.stringify(manifest)) };
});

export function fairArtifactSelection(entry: typeof fairArtifactCatalog[number]) {
  return { artifactId: entry.manifest.artifactId, version: entry.manifest.version,
    manifestSha256: entry.manifestSha256, ensembleSha256: entry.manifest.ensembleSha256,
    memberIdsSha256: entry.manifest.memberIdsSha256 };
}
