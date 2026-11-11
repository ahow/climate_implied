import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fieldSemantics } from "../shared/fieldSemantics";
import { outputFieldSemantics } from "../shared/outputFieldSemantics";
import { conditionalCompanySemantics } from "../shared/companyConditionalSemantics";
import { warmingValidationReferenceSemantics, warmingReferenceExportLeafBindings,
  warmingReferenceExportDocument } from "../shared/warmingValidationReferenceSemantics";
import { trackBAdmissionSemantics, trackBAdmissionHttpSemantics, trackBAdmissionExportLeafBindings } from "../shared/trackBAdmissionContract";
import { trackBWorkbookReasonBindings, trackBWorkbookIdentityFields } from "../server/calculation/trackBAdmissionWorkbook";
import { trackBPublicCatalogSemantics } from "../shared/trackBDisclosureContract";
import { stage10CoverageSemantics, stage10JsonExportLeafBindings, stage10ExportBindings } from "../shared/stage10Coverage";
const census = JSON.parse(readFileSync("docs/field_semantics_census.json", "utf8"));
const frozen = JSON.parse(readFileSync("docs/field_semantics_original_cohort.json", "utf8"));

test("frozen original1001 cohort stays immutable; supplemental leaves never manufacture old closure", () => {
  assert.equal(frozen.slots.length, 1028);
  assert.equal(frozen.slots.filter((s: { role: string }) => s.role === "withheld").length, 27);
  assert.equal(frozen.slots.filter((s: { role: string }) => s.role === "original-gap").length, 572);
  assert.equal(frozen.slots.filter((s: { role: string }) => s.role === "originally-bound").length, 429);
  const fingerprint = createHash("sha256").update(JSON.stringify(frozen.slots.map((s: { key: string }) => s.key).sort())).digest("hex");
  assert.equal(fingerprint, "34c22e5313d2db68748af9576beb7d72c6b1817f2aa9c1ad77aa9866e1d92f79");
  const old = census.originalGapReconciliation;
  assert.equal(old.originalPublicSlots, 1001);
  assert.equal(old.originalFullyBoundFields, 1000);
  assert.equal(old.closedOriginalSlots, 571);
  assert.equal(old.remainingOriginalUnboundSlots, 1);
  assert.deepEqual(old.missingOriginalSlots, []);
  assert.equal(old.slotIdentityFingerprint, fingerprint);
  assert.equal(old.originalCohortComplete, false);
  assert.equal(old.quantityPreservingExportAliases.length, 3);
  assert.ok(old.quantityPreservingExportAliases.every((a: { currentField: string }) =>
    a.currentField === "[].Legacy fixed-5gt-v1 year (5 GtCO2e)"));
});

test("every new typed API/export denominator change is separate and reconciles arithmetically", () => {
  const added = census.supplementalSlotAccounting;
  assert.equal(added.addedSlots, 331);
  assert.equal(added.addedPublicSlots, 331);
  assert.equal(added.addedBoundSlots, 331);
  assert.deepEqual(added.removedOriginalSlots, []);
  assert.equal(census.fields.length, 1359);
  assert.equal(census.originalGapReconciliation.currentPublicSlots, 1332);
  assert.equal(census.originalGapReconciliation.publicSlotDenominatorDelta, 331);
  assert.equal(census.fullyBoundFields, 1331);
  assert.equal(census.fullyBoundFields, census.originalGapReconciliation.originalFullyBoundFields + added.addedBoundSlots);
  assert.equal(census.fields.length, 1028 + added.addedSlots);
  // Compare against actual concurrent registered domains, not an obsolete issuer
  // fact count. The reference's exact38-ID contract is independently checked.
  assert.equal(census.definitions, fieldSemantics.length + outputFieldSemantics.length);
  assert.equal(census.supplementalQualifiedChanges.conditionalCompany.definitions, conditionalCompanySemantics.length);
  assert.equal(added.externalTypedApiSlots, 2766);
  assert.equal(added.externalTypedApiBoundSlots, 2766);
  assert.equal(added.externalTypedApiSlots, 28 + added.companyCoverageApiLeafSlots + added.conditionalCompanyApiLeafSlots +
    added.warmingReferenceApiLeafSlots + added.warmingReferenceJsonExportLeafSlots +
    added.trackBAdmissionApiLeafSlots + added.trackBAdmissionJsonExportLeafSlots + added.trackBAdmissionWorkbookLeafSlots +
    added.trackBAdmissionXlsxApiLeafSlots + added.trackBAdmissionCatalogLeafSlots +
    added.stage10CoverageApiLeafSlots + added.stage10CoverageJsonExportLeafSlots + added.stage10CoverageXlsxApiLeafSlots +
    added.workbookMoneyAuditApiLeafSlots + added.workbookMoneyAuditXlsxApiLeafSlots);
  assert.equal(added.companyCoverageApiLeafSlots, 133);
  assert.equal(added.companyCoverageJsonExportLeafSlots, 133);
  assert.equal(added.conditionalCompanyApiLeafSlots, 63);
  assert.equal(added.conditionalCompanySuccessLeavesPerApi, 30);
  assert.equal(added.conditionalCompanyWorkbookColumns, 2);
  assert.equal(added.warmingReferenceApiLeafSlots, 39);
  assert.equal(added.warmingReferenceJsonExportLeafSlots, 661);
  assert.equal(added.trackBAdmissionApiLeafSlots, 24);
  assert.equal(added.trackBAdmissionJsonExportLeafSlots, 446);
  assert.equal(added.trackBAdmissionWorkbookLeafSlots, 65);
  assert.equal(added.trackBAdmissionXlsxApiLeafSlots, 65);
  assert.equal(added.trackBAdmissionCatalogLeafSlots, 12);
  assert.equal(added.stage10CoverageApiLeafSlots, 51);
  assert.equal(added.stage10CoverageJsonExportLeafSlots, 954);
  assert.equal(added.stage10CoverageXlsxApiLeafSlots, 101);
  assert.equal(added.workbookMoneyAuditApiLeafSlots, 35);
  assert.equal(added.workbookMoneyAuditXlsxApiLeafSlots, 89);
  assert.equal(added.expandedApiAndDownloadPublicSlots, 4098);
  assert.equal(added.expandedApiAndDownloadBoundSlots, 4097);
  assert.equal(added.expandedPublicDeltaFromOriginal, 3097);
  assert.equal(added.supplementalMetadataSheetColumns, 31);
});
test("Monetary audit36 exact definitions/124 supplemental slots never qualify unknown money or close original1001", () => {
  const money = census.supplementalQualifiedChanges.workbookMoneyAudit;
  assert.equal(money.definitions, 36);
  assert.equal(money.reportLeaves, 34);
  assert.equal(money.workbook.qualificationFields.length, 20);
  assert.equal(Object.keys(money.workbook.sourceColumns).length, 15);
  assert.equal(money.typedApiAndWorkbookFields.length, 124);
  assert.ok(money.typedApiAndWorkbookFields.every((f: { bound: boolean }) => f.bound));
  assert.equal(money.api.headerBinding["X-Workbook-Money-Audit-SHA256"], "workbookMoney.auditHash");
});
test("Stage10 exact51 definitions/1106 aggregate supplements keep lifecycle separate and original1001 unchanged", () => {
  const coverage = census.supplementalQualifiedChanges.stage10Coverage;
  assert.equal(coverage.definitions, 51);
  assert.deepEqual(coverage.ids, stage10CoverageSemantics.map(s => s.id));
  assert.equal(coverage.reportSchemaLeaves, 50);
  assert.deepEqual(coverage.jsonExport.leafBindings, stage10JsonExportLeafBindings());
  assert.equal(Object.keys(coverage.jsonExport.leafBindings).length, 953);
  assert.deepEqual(coverage.workbook.aggregateColumns, stage10ExportBindings);
  assert.equal(coverage.workbook.identityFields.length, 19);
  assert.equal(Object.keys(coverage.workbook.lifecycleAuditColumns).length, 7);
  assert.equal(coverage.api.readOnlyRetainedResolverImplemented, true);
  assert.equal(coverage.api.publicWrites, false); assert.equal(coverage.api.providerRefresh, false);
  assert.equal(coverage.api.realApprovalCreated, false);
  assert.equal(coverage.typedApiAndWorkbookFields.length, 1106);
  assert.ok(coverage.typedApiAndWorkbookFields.every((f: { bound: boolean; id: string }) =>
    f.bound && outputFieldSemantics.some(s => s.id === f.id)));
  assert.ok(frozen.slots.every((s: { surface: string }) => !s.surface.includes("stage10-coverage")));
  assert.equal(census.originalGapReconciliation.originalPublicSlots, 1001);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields, 1000);
});
test("TrackB35 definitions and612 supplements bind actual trusted reader/catalog/XLSX but never fabricate real publication or historical acceptance", () => {
  const track = census.supplementalQualifiedChanges.trackBAdmission;
  assert.equal(track.definitions, 35);
  assert.deepEqual(track.ids, [...trackBAdmissionSemantics, ...trackBAdmissionHttpSemantics, ...trackBPublicCatalogSemantics].map(s => s.id));
  assert.equal(track.reportSchemaLeaves, 23);
  assert.deepEqual(track.jsonExport.leafBindings, trackBAdmissionExportLeafBindings());
  assert.equal(Object.keys(track.jsonExport.leafBindings).length, 445);
  assert.deepEqual(track.workbook.reasonColumns, trackBWorkbookReasonBindings);
  assert.deepEqual(track.workbook.identityFields, [...trackBWorkbookIdentityFields]);
  assert.equal(track.workbook.metadataColumns, 31);
  assert.equal(track.api.mounted, true);
  assert.equal(track.api.unlistedStatus, 404);
  assert.equal(track.api.authorizedPublicReportResolverProvisioned, true);
  assert.equal(track.api.readerAndOfflinePublicationEngineeringImplemented, true);
  assert.equal(track.api.realReportPublicationDemonstrated, false);
  assert.equal(track.api.authorizedRealReportPins, 0);
  assert.equal(track.catalog.definitions, 11);
  assert.equal(track.typedApiAndWorkbookFields.length, 612);
  assert.ok(track.typedApiAndWorkbookFields.every((field: { bound: boolean; id: string }) =>
    field.bound && outputFieldSemantics.some(s => s.id === field.id)));
  assert.ok(frozen.slots.every((s: { surface: string }) => !s.surface.includes("track-b-admission") && !s.surface.includes("trackBAdmissionWorkbook")));
  assert.equal(census.originalGapReconciliation.originalPublicSlots, 1001);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields, 1000);
});

test("reference38 definitions and finite JSON serialization are exact supplements, not original closure", () => {
  const reference = census.supplementalQualifiedChanges.warmingValidationReference;
  assert.equal(reference.definitions, 38);
  assert.deepEqual(reference.ids, warmingValidationReferenceSemantics.map(s => s.id));
  assert.equal(reference.api.successLeaves, 38);
  assert.equal(reference.jsonExport.primitiveSerializationLeaves, 660);
  assert.equal(reference.jsonExport.referenceLeaves, 38);
  assert.equal(reference.jsonExport.rowCount, 2);
  assert.equal(reference.jsonExport.columnsPerRow, 11);
  assert.deepEqual(reference.jsonExport.leafBindings, warmingReferenceExportLeafBindings());
  assert.equal(reference.typedApiFields.length, 700);
  assert.ok(reference.typedApiFields.every((f: { bound: boolean }) => f.bound));
  const exportFields = reference.typedApiFields.filter((f: { surface: string; field: string }) =>
    f.surface === reference.jsonExport.surface && f.field !== "error");
  assert.equal(exportFields.length, 660);
  const leaves = (value: unknown, path = ""): string[] => value !== null && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) => leaves(child, path ? `${path}.${key}` : key)) : [path];
  assert.deepEqual(exportFields.map((f: { field: string }) => f.field).sort(),
    leaves(warmingReferenceExportDocument()).sort());
  assert.equal(exportFields.filter((f: { field: string }) => f.field.startsWith("reference.")).length, 38);
  assert.equal(exportFields.filter((f: { field: string }) => f.field.startsWith("rows.")).length, 22);
  assert.equal(exportFields.filter((f: { field: string }) =>
    !f.field.startsWith("reference.") && !f.field.startsWith("rows.")).length, 600);
  assert.ok(frozen.slots.every((s: { surface: string }) => !s.surface.includes("/api/reference/warming-validation")));
});

test("S03-002 adds exactly two registry and six native role/admission leaves, never original closure", () => {
  const expected = {
    'API GET "/api/research/driver-registry"': ["indicators[].legacyRole", "indicators[].admission"],
    'API GET "/api/emissions/candidate"': ["result.use", "result.productionEligible", "result.centralConsumptionAllowed",
      "inputs.indicators[].legacyRole", "inputs.indicators[].diagnosticConsumed", "inputs.indicators[].centralModelEligible"],
  };
  for (const [surface, fields] of Object.entries(expected)) {
    const added = census.supplementalSlotAccounting.addedFields.filter((e: { surface: string; field: string }) =>
      e.surface === surface && fields.includes(e.field));
    assert.deepEqual(added.map((e: { field: string }) => e.field).sort(), [...fields].sort());
    assert.ok(added.every((e: { bound: boolean }) => e.bound));
    assert.ok(frozen.slots.every((e: { surface: string; field: string }) =>
      e.surface !== surface || !fields.includes(e.field)));
  }
  assert.equal(census.originalGapReconciliation.originalPublicSlots, 1001);
  assert.equal(census.originalGapReconciliation.originalFullyBoundFields, 1000);
  assert.equal(census.originalGapReconciliation.closedOriginalSlots, 571);
});

test("sidecar16, sheets31, abatement43, Gordon6 and nominal40 remain qualified supplements", () => {
  const changes = census.supplementalQualifiedChanges;
  assert.equal(changes.thresholdDiagnostic.definitions, 246);
  assert.equal(changes.nativeResidualDiagnostics.definitions, 30);
  assert.equal(changes.nativeResidualDiagnostics.originalNativeApiFields, 187);
  assert.equal(changes.nativeResidualDiagnostics.originalNativeWorkbookColumns, 35);
  assert.equal(changes.nativeResidualDiagnostics.addedCandidateApiFields, 26);
  assert.equal(changes.nativeResidualDiagnostics.addedRegionalSubmittedInputApiFields, 26);
  assert.equal(changes.nativeResidualDiagnostics.separateNativeDiagnosticWorkbookColumns, 21);
  assert.equal(changes.summarySidecar.definitions, 16);
  assert.equal(changes.metadataSheets.definitions, 31);
  assert.equal(Object.keys(changes.metadataSheets.sheets["Field semantics"]).length, 14);
  assert.equal(Object.keys(changes.metadataSheets.sheets["Column bindings"]).length, 17);
  assert.equal(changes.companyAbatement.definitions, 43);
  assert.equal(changes.gordonBaseline.definitions, 6);
  assert.equal(changes.originalNominalAssessment.definitions, 40);
  assert.equal(changes.originalNominalAssessment.typedApiFields.length, 28);
  assert.ok(changes.originalNominalAssessment.typedApiFields.every((f: { bound: boolean }) => f.bound));
  assert.equal(changes.originalNominalAssessment.omittedUndefinedBranchProperties.length, 14);
  assert.equal(census.verifiedExportBindings.filter((b: { surface: string }) =>
    b.surface.includes("threshold-diagnostic-details")).length, 19);
});

test("strict completeness fails on OLD unknown summary JSON, not cured by authenticated new sidecar", () => {
  const unresolved = census.unresolvedTypes;
  assert.equal(unresolved.length, 1);
  assert.equal(unresolved[0].surface, 'API GET "/api/data/runs"');
  assert.equal(unresolved[0].field, "runs[].summary");
  assert.equal(unresolved[0].type, "unknown");
  assert.deepEqual(census.unresolvedDynamicKeys, []);
  assert.equal(census.completion, false);
  for (const gate of ["--require-original-complete", "--require-complete"]) {
    const result = spawnSync("npx", ["tsx", "script/field-semantics-census.ts", "--check", gate],
      { encoding: "utf8", timeout: 120000 });
    assert.equal(result.status, 1, gate);
    assert.doesNotMatch(result.stderr, /Field census stale/);
    assert.match(result.stderr, gate === "--require-original-complete"
      ? /Original cohort incomplete/ : /SEMANTICS INCOMPLETE: 1331\/1332/);
  }
});
