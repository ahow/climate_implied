/**
 * Inventory of the EXISTING operator boundary, not an authorization provider.
 * Merely being in DEV, on loopback, or possessing database credentials does not
 * establish an HTTP principal. Never register privileged routes from this file.
 */
export const operatorContract = Object.freeze({
  publicMutation: "forbidden",
  authority: "authorized-workspace-shell",
  httpAuthentication: "not-implemented",
  httpPrincipal: null,
  httpRole: null,
  source: ["server/releaseSafety.ts", "server/index.ts"],
  existingCommands: {
    workbookCapture: "NODE_ENV=development npx tsx script/capture-workbook-snapshot.ts",
    overlayStage: "npx tsx script/overlay-review.ts stage <entries.json>",
    overlayDecision: "npx tsx script/overlay-review.ts approve <proposal-id> | reject <proposal-id>",
    indicatorDecision: "npx tsx script/operator-indicators.ts approve <proposal-id> | reject <proposal-id>",
    financialReview: "npx tsx script/financial-review.ts stage <review.json> | approve <id> | reject <id>",
    newsRefresh: "npx tsx script/operator-news.ts refresh <months1-24>",
    prospectiveResultExport: "NODE_ENV=development PROSPECTIVE_RESULT_EXPORT_DIR=/absolute/existing-private-0700-directory npx tsx script/operator-prospective-result-export.ts capture|read <retained-parent-id> <idempotency-request-id>",
  },
} as const);

export function operatorLifecyclePreflight(environment: string | undefined) {
  return {
    version: "operator-lifecycle-preflight-1",
    environment: environment ?? "unset",
    developmentExplicit: environment === "development",
    privilegedHttpEligible: false,
    actualMutationLifecycleExecuted: false,
    publicMutationMustRemain403: true,
    contract: operatorContract,
    blockers: [
      {
        code: "no-existing-http-principal-or-role",
        owner: "workspace owner / authentication maintainer",
        action: "Identify and provision the application's genuine operator HTTP authentication and role contract, including a supported disposable DEV principal, before privileged HTTP loader/review/capture wiring. No such principal or role exists in the inspected application.",
        evidence: "server/index.ts installs releaseSafety before routes; server/releaseSafety.ts sends operator-cli-required for public writes. No session/passport middleware establishes req.user.",
      },
      {
        code: "no-disposable-mutable-http-loader",
        owner: "authorized workspace database/import operator",
        action: "Provide an isolated disposable DEV workbook and approved-source copy with a supported importer, snapshot/review operations, and exact restore ownership. Existing shell capture and review commands do not constitute authenticated HTTP access or a private mutable workbook importer.",
        evidence: "capture-workbook-snapshot.ts captures current workbook; overlay-review.ts stages and decides overlays; neither provisions a disposable HTTP identity or importer.",
      },
    ],
    eligibleNow: [
      "Read-only HTTP replay and public-write-denial checks under the existing boundary.",
      "Private-copy calculator/recovery tests explicitly labelled engineering fixtures, not an actual mutable-current HTTP lifecycle.",
      "Rollback-only existing transaction-helper tests under an authorized workspace shell; no real issuer approval.",
    ],
    unproven: [
      "Authenticated loader/review/capture HTTP requests.",
      "Current workbook AND approved-source changes observed by a suspended historical HTTP request.",
      "Changed current output and export identity, rejected/failed refresh invariance, and full post-mutation restore.",
    ],
    prohibitedSubstitutes: [
      "Invented token, role, identity, session, localhost bypass, or a DEV-only public mutation route.",
      "Private-copy calculator execution reported as actual HTTP lifecycle evidence.",
    ],
  };
}
