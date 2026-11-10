/**
 * Read-only review of the original contract. Writes proposed records only.
 * No ledger mutation, execution of historical commands, network, or promotion.
 */
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const ledgerPath="docs/workplan_completion_ledger.json";
const before=readFileSync(ledgerPath,"utf8"),ledger=JSON.parse(before);
const census=JSON.parse(readFileSync("docs/field_semantics_census.json","utf8"));
const sha=(text:string)=>createHash("sha256").update(text).digest("hex");
const git=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
type Review={status:string;files:string[];behavior:string;equation:string;actual:unknown;threshold:string;gaps:string[];next:string};
const reviews:Record<string,Review>={};
const put=(id:string,status:string,files:string[],behavior:string,equation:string,actual:unknown,threshold:string,gaps:string[],next:string)=>{
  for(const file of files) if(!existsSync(file)) throw new Error(`Missing direct evidence: ${id}: ${file}`);
  reviews[id]={status,files,behavior,equation,actual,threshold,gaps,next};
};
const V="verified",P="partial",B="blocked-production-provisioning";
const safety=["server/releaseSafety.ts","server/dataIngestion/scheduler.ts","script/release-safety.test.ts","script/privileged-route-inventory.test.ts"];
const baseline=["script/verify-process-baseline.ts","script/verify-remaining-baselines.ts"];
const claims=["client/src/pages/dashboard.tsx","client/src/pages/climate-valuation.tsx","client/src/pages/decarb-signal.tsx","client/src/pages/decarb-gap-signal.tsx","script/ui-claims.test.ts"];
const semantics=["script/field-semantics-census.ts","shared/outputFieldSemantics.ts","shared/remainingFieldSemantics.ts","shared/nativePathwaySemantics.ts","shared/finiteExportSchemas.ts","server/dataIngestion/summaryContract.ts","script/remaining-field-semantics.test.ts","script/finite-export-schemas.test.ts","docs/API_Contract.md"];
const manifests=["server/calculation/analysisManifest.ts","server/snapshots/materialInputs.ts","server/routes.ts","script/analysis-manifest.test.ts","script/snapshot-request.test.ts"];
const overlays=["server/snapshots/overlayContract.ts","server/snapshots/overlays.ts","server/snapshots/overlayReview.ts","script/overlay-replay.test.ts","script/overlay-order.test.ts"];
const recovery=["script/rehearse-analytical-recovery.ts","server/snapshots/recoveryContract.ts","script/recovery-contract.test.ts"];
const drivers=["server/calculation/driverEvidence.ts","server/dataIngestion/indicatorRegistry.ts","server/calculation/emissionsInputs.ts","script/driver-evidence.test.ts"];
const counts=["shared/indicatorFieldSemantics.ts","client/src/components/indicator-cards.tsx","client/src/components/driver-evidence-disclosure.tsx","client/src/pages/dashboard.tsx","client/src/pages/methodology.tsx","client/src/pages/data-management.tsx","server/dataIngestion/indicatorRegistry.ts","script/finite-export-schemas.test.ts"];

put("S00-001",V,["server/routes.ts","script/verify-ci-negative-control.py"],
  "Reconciled stale 66c7782 release text to latest retained 2026-11-10 08:54:10Z build-info/health evidence and current_release: da140f272a058d093662530e48c66dbc2266c9dc; Railway d1a94087-c6a3-4d7c-8a4b-3a21325babe3 SUCCESS. 80a9315 is not that release. This is a dated identity observation, not a new live check or deployment of this dirty worktree.",
  "build-info.sourceCommit == recorded validated source; health.status == ok",
  {live:"da140f272a058d093662530e48c66dbc2266c9dc",original80a9315Live:false},"Exact source SHA and successful deployment identity at recorded observation",[],
  "Parent re-observes source identity after its eventual release; do not relabel current uncommitted changes as deployed.");
put("S00-002",P,["package.json",".github/workflows/validation.yml"],
  "Historical full-suite runs are preserved: latest retained TS/check/build run 310/310 at 08:47:50Z; latest retained full Python discovery 63/63 at 00:55:22Z. This parallel task ran focused suites only, not a final all-language regression.",
  "tests=pass+fail+skip; acceptance requires both full suites, typecheck and build at the same reviewed candidate",
  {historicalTS:310,historicalPython:63,currentFocusedOnly:true},"Both full suites + check + build successful on final candidate",
  ["The retained full TS and Python executions are from different earlier worktree revisions; no full-suite acceptance of parallel edits is claimed."],
  "Parent runs final full suites/check/build after merging all parallel edits and records exact revision/counts.");
put("S00-003",V,baseline,
  "Prior actual fixed-seed fresh-process captures cover global/category trajectories, Gordon/gap/conversion/walk-forward and separate four-region/retained-workbook group outputs; direct scripts assert exact analytical hashes and strip administrative identity from payload. No unchanged replay rerun in this task.",
  "SHA256(canonical analytical payload process1) == SHA256(payload process2); seed=123, runs=1000; fixed walkForward months=30",
  {freshProcesses:2,categories:6,regionalCases:4,valuationGroups:187,sdgRows:193,targetTercileRows:187},"Exact equality on fixed archived implementation/inputs; no claim of scientific validity",[],
  "Retain archived fixture identity; rerun only when reviewed analytical code/input changes require a new baseline.");
put("S00-004",P,safety,
  "Static route inventory and self-contained Express tests exercise all 14 inventoried POST registrations: seven diagnostics allowed and seven mutations denied. Scheduler is opt-in; advisory collection locking and operator CLI paths are separate controls.",
  "inventoried HTTP POSTs=7 diagnostic+7 mutation; mutation unauthorised status=403",
  {routes:14,diagnostics:7,mutations:7},"Every privileged operation, including non-HTTP DB/cache/provider/scheduler entry points inventoried and authorised",
  ["Route enumeration does not exhaust arbitrary operator/CLI/provider calls; successful authorised development operation for every inventoried mutation is not established by deny tests."],
  "Join exact CLI/paid-provider/cache/scheduler call sites to operator capabilities and isolated authorised success evidence.");
put("S00-005",P,safety,
  "schedulerEnabled accepts only literal true; startScheduler checks it. Prior report claims one enabled environment and collection-lock tests pass, but lock serialization is not evidence of how many environments currently emit enabled startup messages.",
  "schedulerEnabled(undefined)=false; schedulerEnabled('false')=false; schedulerEnabled('true')=true",
  {optInUnitGate:"pass",currentHostCount:"not freshly evidenced"},"Exactly one enabled host/environment with dated startup logs",
  ["No retained direct startup-log artifact for all live environments was inspected in this task; shared-DB advisory locking alone cannot prove one enabled host."],
  "Parent inventories environment settings and records matching startup excerpts without restarting parallel workflows.");
put("S00-006",P,[".github/workflows/validation.yml","script/verify-ci-negative-control.py"],
  "validate gates promote with needs:validate; normal push runs both suites/check/build; promotion advances production-validated without force, rejecting obsolete main SHA. Retained deployment observation says Railway follows validated source.",
  "promote runs only if validate succeeds and origin/main == VALIDATED_SHA",
  {workflowDependency:"validate -> promote",deploymentBranch:"production-validated"},"Railway configured to deploy only successfully validated commits",
  ["Workflow source proves branch gate, not an exhaustive current Railway/admin-bypass configuration audit."],
  "Attach a redacted Railway source-branch/deployment-trigger observation and branch protection audit.");
put("S00-007",V,baseline,
  "Direct prior two-clean-process executions assert both content hash and full analytical payload equality; captured external regional inputs prevent live-source variation. Fixed fixtures characterize old code only.",
  "first.hash===second.hash and deepEqual(first.payload,second.payload)",
  {processes:2,exactHashMatch:true},"Two clean processes with declared fixed inputs and exact equality",[],
  "Preserve exact fixture/hash and original characterisation scope; no unchanged rerun required.");
put("S00-008",P,safety,
  "Public HTTP mutations are refused by default and UI mutation call sites removed. Current focused tests prove denial and zero fixture writes; operator authorisation/CLI capabilities are not equivalent to successful execution of all mutations.",
  "unauthorised mutation =>403; writes in deny harness=0",
  {publicRefusal:"pass",allAuthorisedOperations:"not demonstrated"},"Every inventoried privilege denied without authority and works with authority; no reusable client secret",
  ["Need isolated authorised success per operation and built-client secret scan at final merged candidate."],
  "Use parent-owned operator harness for each supported development operation; scan built assets without exposing secret values.");
put("S00-009",V,["server/releaseSafety.ts","script/release-safety.test.ts","script/privileged-route-inventory.test.ts"],
  "Self-contained route harness confirms diagnostic POSTs remain public but resource-limited: oversized JSON rejected 413, rate excess rejected 429; mutations remain 403. No real collector or app startup was invoked.",
  "diagnosticLimit=2 => first two requests200, third429; oversized body=>413",
  {oversized:413,excess:429},"Diagnostic oversize and excess requests rejected while bounded diagnostic requests remain allowed",[],
  "Preserve rejection tests and review limits if a new diagnostic route is added.");
put("S00-010",P,safety,
  "Source gate and advisory-lock tests are direct; the prior ledger's scheduler verification cited tests of locking, not retained startup logs demonstrating exactly one enabled environment.",
  "count(environments with enabled startup log) must equal1",
  {enabledEnvironmentCount:"unproven by retained local logs"},"Exactly one environment logs scheduler enabled",
  ["Old verified status overstates evidence available in retained execution logs; no workflow logs were accessed during this task."],
  "Record one dated enabled startup and all other environments disabled; keep current public-write guard intact.");
put("S00-011",P,[".github/workflows/validation.yml","script/verify-ci-negative-control.py","script/test_ci_negative_control.py"],
  "Stale unreconciled clause now explicitly mapped to actual negative-control run42641316679: injected validate failure, promote skipped, protected branch unchanged at0c8f20427061e1bb6928de88ed377ae66675e3c7. This was workflow_dispatch failure injection, NOT a deliberately broken source commit. Later ordinary failed CI mentioned in current_release is not substituted for this exact experiment.",
  "validate=failure && promote=skipped && protectedBranchBefore==protectedBranchAfter",
  {runId:42641316679,gateRehearsalPassed:true,deliberatelyBrokenSourceCommit:false},"A deliberately broken commit fails CI and is not deployed",
  ["Exact original broken-source-commit negative experiment has not been demonstrated; dependency-gate injection is narrower."],
  "Parent may conduct an isolated deliberate broken-source CI experiment under approved release controls; do not dispatch during parallel edits.");

put("S01-001",P,["script/output-register.ts","docs/System_Output_Register.md",...semantics],
  `Corrected output-register scope: qualified semantics binds ${census.fullyBoundFields}/1001 original public slots.134 of135 gaps from866 checkpoint closed, cumulative571/572. Six actual production export builders have runtime finite schemas with35 real XLSX domain-case readbacks; two Date slots bind to exact selected source/date formatting. API returns every raw persisted summary JSON value unchanged, including unknown historical properties/arrays/primitives; optional known-producer interpretation does not replace it. This last original opaque slot remains unresolved. Extra concrete columns and known producer leaf metadata are supplemental, not original closure. Broader expression/builder inventory is not complete semantic verification.`,
  "originalClosed=571; originalRemaining=572-571=1; bound=429+571=1000; denominatorDelta=0; original1028 slot fingerprint exactly matches40c524b",
  {bound:1000,publicSlots:1001,remaining:1,finiteExportFamilies:6,concreteDomainReadbacks:35,
    originalSlotFingerprint:census.originalGapReconciliation.slotIdentityFingerprint,
    displayExpressions:census.displayExpressionInventory.length,workbookBuilderSites:census.workbookBuilderInventory.length},
  "Every output has label,equation,unit,population,engine,evidence state,replacement stage",
  ["Original runs[].summary historical leaf semantics remain unresolved; raw JSON is preserved on the wire, never replaced by a string/envelope/hash. Supplemental chained response branches, display attributes/chart payloads, custom metadata/JSON sheets and replacement-stage mapping are also not exhaustively verified."],
  "Review actual historical summary schemas without altering retained data or hiding unknown values, then reconcile supplemental/display/custom-sheet scope. Keep both strict completion gates unchanged.");
put("S01-002",P,claims,
  "The original 'Interim actions:' heading is retained as a composite obligation, not silently deleted as non-actionable; child S01-003..011 actions have individually audited evidence and gaps.",
  "composite verified only if every required child action is fully met",
  {children:"S01-003..S01-011",allChildrenMet:false},"All enumerated interim actions complete",
  ["Counts now derive22 from shared registry; 5Gt is still not5%; dated1.37 reference and complete per-value metadata remain incomplete."],
  "Close the individually listed child criteria and only then promote this composite heading.");
put("S01-003",V,["server/calculation/publicValuationContract.ts","script/public-valuation-contract.test.ts",...claims],
  "publicValuationResult recursively strips unsupported physical claim keys; /api/cv response wrapper applies filtering. Company pages no longer publish numeric valuation-derived temperature/carbon-price/net-zero outputs and physical downloads were removed. This does not assert removal of all legacy computation code from the bundle.",
  "recursive unsupported-key deletion before public JSON; UI shows unavailable, not numeric substitutes",
  {withheldTypedSlots:27,publicContractTests:"pass",companyUIClaimTests:"pass"},"Withhold the three named numeric valuation-derived public claims",[],
  "Preserve recursive filter and UI/export negative assertions; audit bundle absence separately under S01-013.");
put("S01-004",P,["client/src/lib/valuation-claims.ts",...claims],
  "Gordon baseline helper computes costOfEquityPct-100/PE with finite positive P/E guard; many company labels now describe Gordon/earnings yield rather than physical decarbonisation. Selected cost-of-equity controls mean not every label is the exact fixed8% requested wording.",
  "gordonBaselinePct(PE,rPct)=rPct-100/PE; default rPct=8",
  {defaultPercent:8,physicalInterpretation:"withheld"},"Identical requested Gordon baseline (r=8%) label at every renamed surface",
  ["Exact fixed8% label is not uniformly applicable to variable-r consumers; requires explicit scoped label and cross-surface equality audit."],
  "Enumerate remaining labels and bind actual r assumption visibly rather than incorrectly force8% on variable-r values.");
put("S01-005",V,["server/climateValuation/decarbGapCalculator.ts","shared/peerValuationSemantics.ts","client/src/pages/decarb-gap-signal.tsx","script/ui-claims.test.ts","script/peer-valuation-semantics.test.ts"],
  "Peer diagnostic is explicitly described as within-peer earnings-yield rank; the score is a rank, not projected physical emissions minus an inferred rate. Tests and dictionary record positive-P/E precedence, median/ties/singleton behavior.",
  "g_i-g_peer=EY_peer-EY_i; rank_i=round(1000*(2*i/(n-1)-1))/1000; n<2=>0",
  {physicalGapClaim:"withheld",rankDisclosure:"present"},"Note explicitly identifies within-peer earnings-yield ranking",[],
  "Keep rank explanation attached to the diagnostic and retain descriptive-only claim boundaries.");
put("S01-006",V,["server/climateValuation/sharedUtils.ts","client/src/pages/climate-valuation.tsx","client/src/pages/decarb-signal.tsx","script/ui-claims.test.ts"],
  "Carbon-intensity grouping labels specify emissions per market cap, not revenue. The GDP regional counterfactual is separately qualified rather than merged with company market-cap intensity.",
  "company CI=(scope1+scope2[+scope3])/positive marketCap",
  {companyDenominator:"market capitalisation",revenueDenominator:false},"Company carbon-intensity label names market cap, not revenue",[],
  "Preserve qualified units and do not infer financial materiality or cross-currency equivalence.");
put("S01-007",P,["shared/historicalFieldSemantics.ts","client/src/components/emissions-chart.tsx","client/src/pages/dashboard.tsx","client/src/pages/methodology.tsx"],
  "On-track/delayed headline verdict is removed and positive residual milestones are explained as diagnostics. However actual legacy trajectory code uses a fixed5GtCO2e threshold, explicitly NOT5%of2024; these quantities cannot be reconciled by renaming alone.",
  "min(year where trajectory.p50<=5GtCO2e), null if absent through2100; not 0.05*baselineEmissions",
  {actualThreshold:"5 GtCO2e",originalRequestedThreshold:"5% of 2024"},"Exact requested5% quantity and matching UI/API/export label; no on-track/delayed verdict",
  ["Fixed5Gt differs from5%of2024. Preserve scientifically honest existing label pending an approved analytical change/baseline update."],
  "Parent decides approved quantity change vs explicit original-clause deviation; do not count current5Gt labelling as exact5% acceptance.");
put("S01-008",V,["client/src/pages/dashboard.tsx","client/src/components/published-scenario-references.tsx","script/ui-claims.test.ts"],
  "Default dashboard has published scenario references and no mounted legacy model consumers. Legacy view requires explicit opt-in and carries direct CO2-only/all-GHG plus fixed1.1C warning; published CAT/UNEP context is separate from own forecast.",
  "showLegacy initial=false; legacy consumers mounted only when true",
  {legacyDefaultMounted:false,knownLimitationWarning:true,publishedContext:true},"Legacy gauge removed from headline, optional comparison with direct warning and published context",[],
  "Keep published references contextual and avoid calling their values a validated dashboard forecast.");
put("S01-009",V,counts,
  "Shared indicatorFieldSpecs drives22 keys for card rendering, operational server inventory, methodology/dashboard/driver count text and finite export schemas. Both server acquisition and card presentation definitions are resolved by these authoritative keys, failing explicitly if configuration is missing. Discovered14 previously configured cards despite20 prose; eight added concrete cards/columns are disclosed separately, not original semantic closure credit.",
  "cards.keys==serverRegistry.keys==indicatorFieldSpecs.keys; every displayed count derives registry.length=22",
  {dashboardDerived:22,methodologyDerived:22,serverRegistry:22,renderedCardKeys:22,previouslyConfiguredCards:14},
  "One registry generates every displayed count",[],
  "Preserve exact key-set/count assertions and explicit missing-configuration errors for future additions.");
put("S01-010",P,["shared/calculationContract.ts","server/calculation/emissionsInputs.ts","server/calculation/nativePathwayContract.ts"],
  "Shared legacy constants distinguish physical/finance versions and2024 inventory basis; candidate inventory and inputs state2024. Direct source scan did not locate a shared dated1.37C annual2025 validation-reference record. Legacy1.1C remains explicitly characterization, not this target.",
  "validation target(2025 annual)=1.37C must remain separate from inventoryYear2024 and legacyOffset1.1C",
  {inventoryYear:2024,legacyOffsetC:1.1,requestedDatedReferenceStored:false},"Shared inventory basis/base year plus dated annual1.37C reference distinct from decadal/inventory/calculation constants",
  ["Dated requested annual validation datum not implemented as a distinct shared reference; no scientific acceptance of that datum is inferred here."],
  "Add source-reviewed dated reference metadata with annual/decadal distinction, without changing calculation offsets or claiming climate validation.");
put("S01-011",P,[...semantics,"client/src/components/download-data-button.tsx"],
  "Qualified semantic annotations and export-column details now cover additional values, while direct JSX-expression inventory exposes unannotated controls/containers/numerics. Specific known legacy warning is retained; this is not complete per-value metadata.",
  "explicit qualified annotation != coverage of all nested/dynamic display values",
  {explicitBindings:census.displayBindings.length,directExpressions:census.displayExpressionInventory.length},"Concise correct metadata adjacent to every displayed value; specific limitation warning retained",
  ["Source attributes, chart callback payloads and component-derived numeric displays remain outside complete semantic verification."],
  "Map displayed quantity/equation/unit/population to each runtime value and remove only redundant general banners.");
put("S01-012",P,semantics,
  "1000/1001 original public slots bind with equation/unit and actual finite-domain row/schema enforcement. All35 domain cases execute production row/binding expressions and survive XLSX readback including null/zero/negative values. Actual production runs handler preserves every original raw summary JSON value. Known producer leaves are precisely described separately, but historical arbitrary JSON remains unresolved. Both strict completion gates still refuse this gap.",
  "missingOriginal=1001-1000=1; all1028 original slot identities preserve frozen fingerprint; raw wire value unchanged; concrete extra columns/producer leaves are supplemental",
  {bound:1000,public:1001,remaining:1,domainReadbacks:35,unchangedOriginalSlotFingerprint:true,rawSummaryWireValueUnchanged:true},"Zero missing API/export fields and zero definitions without equation/unit",
  ["Original opaque runs[].summary historical semantics remain unknown and earn no completion credit. Supplemental chained response/custom-sheet/display scope is also incomplete; known producer metadata is not proof for unknown historical values."],
  "Establish actual historical leaf schemas with source evidence, retaining raw unknown values, then verify supplemental response/custom-sheet fields before promoting this clause.");
put("S01-013",P,["server/calculation/publicValuationContract.ts","client/src/pages/methodology.tsx","shared/outputFieldSemantics.ts",...claims],
  "Recursive API withholding and UI numeric removal are directly tested. Literal unsupported names and historical formulas remain in client types, methodology and semantic dictionaries; source checks are not proof of absence from the built bundle.",
  "API unsupported-key count=0 after filter; bundle criterion requires separate built-asset scan",
  {typedWithheld:27,builtBundleAbsenceProven:false},"Withheld fields absent from API, UI bundle and exports",
  ["Bundle contains documentation/type/formula references to withheld fields; original literal absence criterion is not fully met by hiding numeric widgets."],
  "Parent scans final built artifacts and distinguishes retained disclosure text from any executable physical-claim consumers; document exact accepted scope.");
put("S01-014",P,[...claims,"client/src/lib/export-contract.ts",...semantics],
  "Additional exact export bindings identify unit conversions and unsupported quantities; a family-qualified dictionary is not evidence of identical labels across all UI/API descriptions/exports.",
  "label(UI,id)==label(API,id)==label(export,id) for each renamed original output",
  {labelsUniformlyAudited:false,unboundOriginal:1,targetBandLabelsNowHonest:true},"Every renamed label identical across all three surfaces",
  ["Dynamic export labels now have finite schemas and honest target-band labels preserve all numeric assignments/representatives. Variable Gordon r and fixed5Gt vs requested5% still need complete cross-surface equality reconciliation."],
  "Build a label equality test using actual UI/API/export descriptors for each renamed quantity.");
put("S01-015",V,counts,
  "Dashboard and Methodology count expressions derive from the same22-key shared registry that also generates cards and server inventory used by Data Management. Unavailable Data Management data is labelled unavailable, not fabricated0. Real production export builder reads back all22 native-unit indicator columns.",
  "mainCount==methodologyCount==dataManagementRegistryCount",
  {mainDerived:22,methodologyDerived:22,registry:22,unknownInventoryCount:"Unavailable"},"All three page counts equal and derived",[],
  "Keep shared-key derivation and rendered count/data-unavailable distinctions when adding indicators.");
put("S01-016",P,["client/src/pages/methodology.tsx","shared/historicalFieldSemantics.ts","client/src/lib/types.ts","script/ui-claims.test.ts"],
  "Positive residual diagnostics are explicitly labelled not net zero in changed views; retired5% methodology contains negating explanatory net-zero text and technical netZeroYear names persist. No exhaustive positive-residual semantic text scan exists.",
  "positive residual threshold != physical net zero",
  {changedVisibleMilestones:"qualified",exhaustiveSemanticTextScan:false},"No positive residual threshold positively labelled net zero anywhere",
  ["Technical names/retired prose need a context-aware scan; current tests check selected literal patterns, not every route/export/legacy explanation."],
  "Add a context-aware all-surface text/descriptor scan with explicit negation/documentation exceptions and verify every positive residual label.");

put("S02-001",P,[...overlays,"server/snapshots/contract.ts"],
  "Immutable workbook packing and ordered content-addressed overlays exist for financial/carbon/SDG/targets, with explicit availability/cutoff/unit checks; dated driver snapshots are separate. Native null/zero and ordering survive focused tests.",
  "overlay.id=SHA256(canonical overlay); apply in supplied order where availableAt<=cutoff; source remains immutable",
  {orderedOverlayContracts:"pass",nullZeroPreservation:"pass"},"All four requested update classes immutable, ordered, complete provenance/native units/currency/hash",
  ["Not every source-approved live refresh/driver entry has complete publication/vintage/licence metadata; mutable-current source lifecycle remains unproven at HTTP boundary."],
  "Complete source-reviewed immutable publication for each material update class and exercise parent-owned authorised lifecycle.");
put("S02-002",P,manifests,
  "Canonical serialization distinguishes null/zero/string/native values and excludes administrative time from manifest identity. Seeds/settings/code/model/snapshot inputs participate; actual nine-path retained material bundles exist.",
  "manifest.id=SHA256(canonical analytical identity); createdAt excluded; nonfinite/undefined rejected",
  {canonicalHashTests:"pass",timeExcluded:true},"All production runs include complete code/model/assumption/dataset/scenario/settings/seed/member/output identities",
  ["Coverage and archival of every production run/collector are not established by manifest unit tests or nine selected company paths."],
  "Bind complete manifest identity to every actual production analysis path and monthly collection receipt without enabling public writes.");
put("S02-003",P,[...manifests,"server/dataIngestion/overrideStore.ts","script/check-overlay-concurrency-db.ts"],
  "Request-local snapshot/overlay/override contexts and cache identities are implemented; malformed explicit selectors reject rather than select current. Combined retained calculator concurrency and separate HTTP selection checks exist, but actual mutable-source HTTP lifecycle is unproven.",
  "request snapshot+ordered overlays+cutoff+driver hash fixed at entry; analytical cache key includes selected identities/settings/version",
  {requestSelectionTests:"pass",invalidSelectorFallback:false},"One manifest used throughout every request, complete cache identity, reduced/full cache separation",
  ["Need supported mutable-current workbook plus approved-source mutation with suspended HTTP request and all response/export identities."],
  "Parent completes isolated supported source-mutation/suspended-HTTP/restore harness; do not infer it from ALS context tests.");
put("S02-004",P,["server/snapshots/contract.ts","shared/financialData.ts","server/snapshots/companyOperatingReview.ts"],
  "Workbook content hashes version the packed company population and company-review logic separates identity evidence, but a complete dated denominator lifecycle with independent active/acquired/delisted and identity-review states is not demonstrated for all members.",
  "population identity must include dated membership/lifecycle separately from identity review",
  {snapshotPopulationVersioning:true,allLifecycleStatesVerified:false},"Versioned denominator plus independent lifecycle and identity-review statuses for every company",
  ["Snapshot immutability is not a reviewed lifecycle history or complete identity-state coverage."],
  "Define/review issuer lifecycle and membership evidence independent of identity adjudication and bind it to denominator hashes.");
put("S02-005",B,["server/snapshots/results.ts","server/snapshots/materialInputs.ts","server/snapshots/guards.ts"],
  "Immutable result/material archive code exists and actual development nine-path bundles are replayable; this does not establish authorised provisioning and archival for every production analysis/monthly collection.",
  "production run receipt must link manifest.id,headline output hash,material input hashes",
  {developmentNinePathBundles:true,allProductionMonthlyRunsArchived:false},"Every production run from now on archived, at least monthly",
  ["Production archive provisioning/operational authority not demonstrated; no DDL or production data mutation attempted."],
  "Owner provisions additive production archive/guards through approved migration and records first scheduled production receipt.");
put("S02-006",P,recovery,
  "Prior development copy recovery exported/restored2442 companies,470341 observations and63 indicator rows with exact three-table hashes and zero public writes. Portable no-network nine-path engineering recovery is broader software portability, not production database backup/migration rollback.",
  "COUNT and SHA256(table analytical rows) before==restored; publicWrites=0",
  {companies:2442,observations:470341,indicatorRows:63,tableHashesMatched:3,publicWrites:0},"Development migration rehearsal, production backup and tested rollback",
  ["No complete production backup plus additive schema migration/rollback rehearsal proven."],
  "Owner captures consistent authorised backup and rehearses actual additive migration/rollback on a disposable copy.");
put("S02-007",P,["script/check-overlay-concurrency-db.ts","script/combined-refresh-fixture.ts","script/verify-portable-overlay-recovery.ts","script/check-nine-http-recovery.ts"],
  "Retained combined financial/carbon/SDG/driver helper transaction covers all nine actual calculators, nonempty explicitly based target fixtures, exact old-request hashes and rollback. Separate private portable bundled recovery reproduces all nine/XLSX with network denied; HTTP repeat/stored retrieval checks cover nine routes.",
  "hash(oldSelectedAnalysis after perturbation)==baselineHash; changedRequestHash!=baselineHash; restoredHash==baselineHash",
  {calculatorPaths:9,allNinePortableXlsxMatch:true,syntheticEngineeringOnly:true,realIssuerApprovals:0},"Earlier manifest reproduces after one refresh of every requested material type through supported application lifecycle",
  ["Real reviewed publication/authorised current-workbook+approved-source HTTP mutation lifecycle and post-mutation restore remain unproven. Synthetic engineering perturbations are not real issuer/scientific approvals."],
  "Use parent-owned supported development lifecycle to mutate each source, suspend HTTP selection and restore while retaining manifest/hash evidence.");
put("S02-008",P,["script/check-overlay-concurrency-db.ts","script/combined-refresh-fixture.ts","server/dataIngestion/overrideStore.ts","server/snapshots/overlays.ts"],
  "Corrected stale gap claiming financial/carbon/driver combinations were missing: actual combined helper transaction already writes/reviews financial, carbon, SDG and driver fixtures and target evidence, suspends an old request, runs modified all-nine calculators, resumes unchanged old request and rolls back. This is not an actual HTTP mutable-current-source concurrency test.",
  "baselineHash=hash(old request after resume)=hash(restored default); hash(modified request)!=baselineHash; fixture rows after rollback=0",
  {combinedTypes:["financial","carbon","sdg","driver","target"],actualCalculatorPaths:9,modifiedRequestChanged:true,oldRequestUnchanged:true,completeRollback:true},
  "Concurrent writes cannot mix versions in any supported application request",
  ["HTTP tests compare retained/default selections of the same workbook; supported distinct mutable-current source writes during suspended HTTP requests and export identity remain unproven."],
  "Parent completes supported isolated current-source mutation/suspended-HTTP/restore journey; do not rerun unchanged calculator fixture or call it HTTP evidence.");
put("S02-009",P,["script/check-nine-http-recovery.ts","server/calculation/identity.ts","server/routes.ts"],
  "Retained nine-route HTTP report shows equal repeated responses and stored retrieval with identities; its own limits explicitly say warm repetition does not prove a cache hit. Cache key source includes calculation identity but no instrumented cold/warm hit evidence.",
  "cold.value==warm.value && cold.identity==warm.identity, with proven cold miss and warm hit",
  {httpPaths:9,repeatedResponsesEqual:true,instrumentedCacheHit:false},"Cold and warm caches return identical values and identities",
  ["Repeated GET equality alone cannot establish cold-vs-warm cache-path execution."],
  "Instrument isolated cache miss/hit paths and compare analytical payload plus dataset/model/manifest identity, without clearing production caches.");
put("S02-010",P,recovery,
  "Development export/restore preserved actual workbook and indicator counts/hashes, including immutable null/zero contracts; no proof that an actual additive migration preserved every original carbon/SDG/target table through rollback.",
  "beforeCount==afterCount and beforeHash==afterHash for each original table",
  {companies:2442,observations:470341,indicatorRows:63,matchedTableHashes:3},"Original workbook/carbon/SDG/target counts and hashes preserved by migration",
  ["Recovery-table hashes are not a full additive-migration acceptance receipt covering every original table and target metadata."],
  "Record per-table pre/post counts/content hashes across the authorised disposable migration and rollback.");
put("S02-011",B,["server/snapshots/results.ts","server/snapshots/materialInputs.ts","script/check-nine-http-recovery.ts"],
  "Development/private archives contain actual replayable selected runs; no production archive fixture is reclassified as production merely because an endpoint or portable bundle works.",
  "production archive must contain >=1 authorised production-origin manifest and complete replay material with matching output hash",
  {developmentReplayablePaths:9,provenProductionOriginRuns:0},"At least one replayable production run in the archive",
  ["Production provisioning/authorised run provenance remains absent from retained direct evidence."],
  "After owner-approved provisioning, archive and replay one production-origin run with complete receipt; no public capture bypass.");

put("S03-001",P,drivers,
  "driverEvidenceRegistry accounts for22 indicators and exposes definition/publisher/units/geography/category/retained periods/hash/update cadence. Availability is null, original publication archive unavailable and licence review required; schema presence is not complete source evidence.",
  "mandatory completeness=all required metadata present with defensible source/date/licence, not merely object keys",
  {entries:22,metadataComplete:0,centralEligible:0},"Every indicator has every mandatory sourced registry field",
  ["Observation-specific availability/vintage and licence evidence are missing; retained content hash does not establish original publication vintage."],
  "Populate reviewed source-specific availability/vintage/licence records, preserving explicit unknowns until supported.");
put("S03-002",P,drivers,
  "Registry classifies candidate mechanism/validation/context and sets centralModelEligible=false for all22. Native diagnostic explicitly uses capacity/sales as mechanism-input and context indicators do not automatically move that candidate; optional legacy engine still consumes some context quantities.",
  "only admissible mechanism-role coefficients may move accepted headline; context/validation must not be independent multipliers",
  {registryEntries:22,acceptedCentralEligible:0},"All indicators have appropriate roles and only mechanism inputs move forecast",
  ["Role schemas differ candidate-mechanism-input vs native mechanism-input; optional legacy context references are not an accepted role-governed forecast."],
  "Unify role vocabulary/admission and test each accepted forecast dependency against mechanism-role eligibility before central promotion.");
put("S03-003",P,drivers,
  "Overlap group/category and explicit missing-data policy are stored; uncertainty.status=unavailable and regionalApplicability=not-established remain honest blockers, not distributions or approved applicability.",
  "uncertainty distribution must be source-calibrated; overlap must prevent double counting",
  {uncertaintyDistribution:"unavailable",regionalApplicability:"not-established"},"Each indicator has uncertainty distribution, overlap group, regional applicability and missing method",
  ["No source-specific calibrated distribution or accepted regional applicability for every indicator."],
  "Supply source-compatible distributions and regional/overlap evidence, then integrate joint sampling without counting context twice.");
put("S03-004",P,["shared/calculationContract.ts","server/calculation/driverEvidence.ts","script/driver-evidence.test.ts","script/snapshot-contract.test.ts"],
  "quantity preserves null vs observed zero; interpolateInterior preserves zero, interpolates only bracketed interior gaps and refuses extrapolation. It reports uncertainty not-quantified; not-applicable and below-threshold are not full distinct states throughout ingestion.",
  "interior y=yL+(yR-yL)*(year-yearL)/(yearR-yearL); outside bracket=>null; zero remains0",
  {observedZeroPreserved:true,extrapolation:false,infillUncertainty:"not-quantified"},"Four missingness states distinct; interior-only infill with sampled uncertainty and no zero fill",
  ["No complete four-state source-cell schema or sampled uncertainty; legacy group aggregates still use missing scope ||0 in documented diagnostic code."],
  "Introduce reviewed source-cell states and sampled infill lineage, then remove unsupported silent-zero paths under baseline controls.");
put("S03-005",V,counts,
  "Cards are generated by authoritative shared indicatorFieldSpecs keys, with complete checked presentation config and explicit error if missing. Server acquisition inventory is generated from the same keys. Methodology/dashboard/driver count expressions derive registry.length; actual card export builder has22 registered value columns.",
  "renderedCards.keys==sharedRegistry.keys; displayedCount==registry.length",
  {serverRegistry:22,singleGeneratedClientRegistry:true,cardKeys:22},"Cards and methodology counts generated from registry",[],
  "Preserve registry-driven generation and exact configuration/key-domain tests; scientific input values were not changed.");
put("S03-006",P,drivers,
  "Every registry row has licence.status=review-required with publisher, which records an unresolved status but not reviewed licence terms or permissions for every source.",
  "accepted licence requires reviewed source terms/reference, not a common default",
  {licenceEntries:22,reviewedSourceLicences:0},"Licence status of every source recorded with source-specific review evidence",
  ["Common review-required placeholders do not establish actual licence permission/restrictions."],
  "Review each source terms/reuse licence and store dated reference/restrictions; do not fabricate permission.");
put("S03-007",P,[...drivers,"script/audit-driver-evidence.ts"],
  "Direct frozen audit reports22 rows audited,0metadata-complete,0central-eligible. The code's explicit missing availability/licence/regional/uncertainty states agree; object existence does not meet100% mandatory completion.",
  "completeness=count(fully evidenced mandatory metadata)/22",
  {complete:0,total:22,percent:0},"100% indicators have every mandatory field supported",
  ["All22 need at least reviewed information-availability evidence; additional uncertainty/licence/regional requirements remain."],
  "Resolve per-indicator missing fields from reviewed sources and rerun exact audit; retain false eligibility until all gates pass.");
put("S03-008",P,["server/calculation/driverEvidence.ts","script/driver-evidence.test.ts","script/snapshot-contract.test.ts"],
  "Negative unit test preserves observed0 and null blanks; interpolated2021 value2 from2020=0,2022=4 carries originalValue=null, sourceYears and not-quantified uncertainty; outside interval staysnull. End-to-end all-source acquisition lineage is not covered.",
  "blank!=0; interpolation provenance={originalValue:null,sourceYears:[2020,2022],method:linear-interior-diagnostic}",
  {zeroPreserved:true,interiorFixture:2,extrapolatedValue:null},"Blank source cells never become zero and every actual infill traces to original blank",
  ["Helper test does not prove every source loader/legacy aggregation/export path; absence vs explicit null and sampled provenance need end-to-end tests."],
  "Add real loader negative fixtures for blank/not-applicable/below-threshold and assert immutable cell lineage through approved input/export.");
put("S03-009",P,drivers,
  "No new central forecast is promoted; default headline is published external context. Native diagnostic uses two named mechanism inputs; registry marks all22 central-ineligible. Vacuous absence of an accepted own headline is not full implementation of a future mechanism-role gate.",
  "for each ownHeadline dependency: role includes mechanism-input && centralModelEligible",
  {acceptedOwnForecast:false,nativeDiagnosticMechanismInputs:["renewableCapacityGW","evSalesSharePct"]},"Every indicator moving the headline has a mechanism role enforced in code",
  ["No accepted own headline/model; optional legacy coefficients are not comprehensively role-gated."],
  "Enforce role eligibility at accepted-model dependency resolution and test rejection of context/validation inputs as causal multipliers.");
put("S03-010",V,counts,
  "The stale20 literal is removed. Shared22-key registry drives all card keys, server inventory and dashboard/Methodology/driver count expressions; tests compare exact server/shared/configured key sets and actual production export rows. Data Management unavailable inventory is explicit rather than zero.",
  "all UI counts==registry.length",
  {mainDerived:22,methodologyDerived:22,registry:22,cardKeys:22},"UI counts equal registry counts everywhere",[],
  "Retain shared count/key derivation and no-zero-on-read-failure behavior.");

function inspectExecution(execution:any) {
  if(!execution.log || !existsSync(execution.log)) return {...execution,log_inspected:false,
    evidence_limit:"Retained execution metadata only; local log absent, not current execution evidence"};
  const content=readFileSync(execution.log,"utf8");
  return {...execution,log_inspected:true,log_sha256:sha(content),
    evidence_limit:"Read retained artifact, did not rerun command; broad suite counts do not establish every original clause"};
}
const freshLogs=[
  "generated-artifacts/semantics-original135/focused-tests-final.log",
  "generated-artifacts/semantics-original135/stages-00-03-focused.log",
  "generated-artifacts/semantics-original135/additional-focused.log",
  "generated-artifacts/semantics-original135/finite-final.log",
];
const fresh=freshLogs.map(log=>{
  const content=readFileSync(log,"utf8");
  const count=(name:string)=>Number(content.match(new RegExp(`^# ${name} (\\d+)`,"m"))?.[1]??0);
  if(count("fail") || !count("tests")) throw new Error(`Focused evidence not passing: ${log}`);
  return {command:log.includes("stages-00-03")?
    "npx tsx --test script/ui-claims.test.ts script/driver-evidence.test.ts script/analysis-manifest.test.ts script/snapshot-request.test.ts script/snapshot-contract.test.ts script/snapshot-guards.test.ts script/overlay-replay.test.ts script/overlay-order.test.ts script/recovery-contract.test.ts script/public-valuation-contract.test.ts script/export-contract.test.ts script/release-safety.test.ts script/privileged-route-inventory.test.ts":
    log.includes("finite-final")?"npx tsx --test script/finite-export-schemas.test.ts":
    log.includes("additional-focused")?
    "npx tsx --test script/reconciliation-stages-00-03.test.ts script/output-register.test.ts script/semantics-provenance.test.ts script/native-semantics.test.ts script/output-field-semantics.test.ts":
    "npx tsx --test script/remaining-field-semantics.test.ts script/diagnostic-metadata-semantics.test.ts script/operational-field-semantics.test.ts script/target-input-semantics.test.ts script/backtest-field-semantics.test.ts script/peer-valuation-semantics.test.ts",
    executed_at:statSync(log).mtime.toISOString(),exit_code:0,
    counts:{tests:count("tests"),pass:count("pass"),fail:count("fail"),skipped:count("skipped")},
    log,log_sha256:sha(content),workspace_revision:git,worktree_dirty:true,
    scope:"Focused self-contained engineering checks only; no final fullsuite, unchanged replay, release or scientific acceptance",
    log_inspected:true};
});
const typeLog="generated-artifacts/semantics-original135/types-final.log";
const typeText=readFileSync(typeLog,"utf8");
if(typeText.trim()) throw new Error("Current compiler evidence contains diagnostics; cannot record a passing check");
const censusLog="generated-artifacts/semantics-original135/census-check.log";
const censusText=readFileSync(censusLog,"utf8"),censusCheck=JSON.parse(censusText);
if(censusCheck.fullyBoundFields!==1000||censusCheck.originalCohortComplete!==false||censusCheck.unresolved!==1)
  throw new Error("Census must honestly retain the original unresolved historical summary slot");
const oldLive=ledger.run_executions.filter((x:any)=>x.log?.includes("20261110T085410274732Z"));
const all=ledger.stages.flatMap((s:any)=>s.requirements);
if(all.length!==300) throw new Error("Original300 changed");
const originals=ledger.stages.slice(0,4).flatMap((s:any)=>s.requirements);
if(originals.length!==48 || Object.keys(reviews).length!==48) throw new Error("All48 original stage0–3 clauses must be reviewed");
const records:Record<string,unknown>={};
// Criterion-specific classifications, never derived from status or pass/fail.
const criterionCheckTypes:Record<string,"exact"|"numerical"|"operational"|"judgement">={
  "S00-001":"operational","S00-002":"operational","S00-003":"numerical",
  "S00-004":"operational","S00-005":"operational","S00-006":"operational",
  "S00-007":"numerical","S00-008":"operational","S00-009":"operational",
  "S00-010":"operational","S00-011":"operational",
  "S01-001":"judgement","S01-002":"judgement","S01-003":"exact","S01-004":"exact",
  "S01-005":"exact","S01-006":"exact","S01-007":"exact","S01-008":"judgement",
  "S01-009":"exact","S01-010":"judgement","S01-011":"judgement","S01-012":"exact",
  "S01-013":"exact","S01-014":"exact","S01-015":"numerical","S01-016":"exact",
  "S02-001":"exact","S02-002":"exact","S02-003":"exact","S02-004":"exact",
  "S02-005":"operational","S02-006":"operational","S02-007":"numerical",
  "S02-008":"operational","S02-009":"exact","S02-010":"exact","S02-011":"operational",
  "S03-001":"judgement","S03-002":"judgement","S03-003":"judgement","S03-004":"numerical",
  "S03-005":"exact","S03-006":"judgement","S03-007":"numerical","S03-008":"exact",
  "S03-009":"exact","S03-010":"numerical",
};
if(Object.keys(criterionCheckTypes).length!==48) throw new Error("Every criterion needs an explicit check_type");
const definitions=(path:string)=>{
  if(!/\.[cm]?[jt]sx?$/.test(path)) return [];
  const source=ts.createSourceFile(path,readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true);
  return source.statements.flatMap(node=>{
    if((ts.isFunctionDeclaration(node)||ts.isClassDeclaration(node))&&node.name) return [node.name.text];
    if(ts.isVariableStatement(node)) return node.declarationList.declarations.flatMap(d=>
      ts.isIdentifier(d.name)?[d.name.text]:[]);
    return [];
  });
};
for(const original of originals) {
  const review=reviews[original.id];
  if(!review) throw new Error(`Missing review ${original.id}`);
  const originalExecutions=(original.executions??[]).map(inspectExecution);
  const additional=original.id==="S00-001"?oldLive.map(inspectExecution):[];
  records[original.id]={
    ...original,status:review.status,
    check_type:criterionCheckTypes[original.id],
    check_scope:review.status===B?"production-provisioning-blocker":
      review.status===V?"exact-original-criterion-engineering-or-dated-characterization":
      "direct-code-and-focused-execution-partial-original-criterion",
    evidence_caveat:"Each original clause reviewed individually. Focused passing tests are not whole-model scientific acceptance. Dates/revisions of historical logs are retained; no new production/live verification or full regression is claimed.",
    files_functions_changed:Array.from(new Set([...(original.files_functions_changed??[]),...review.files])),
    direct_code_evidence:review.files.map(path=>({path,content_sha256:sha(readFileSync(path,"utf8")),
      functions_or_top_level_bindings:definitions(path),
      check:"Inspected source implementation and associated named test assertions; file presence alone does not satisfy criterion"})),
    behaviour_delivered_this_run:review.behavior,
    inputs_versions_assumptions:[...(original.inputs_versions_assumptions??[]),
      `Original source SHA256 ${ledger.source_sha256}; original300 requirements and their exact wording/order/origin untouched`,
      `Worktree base ${git}; parallel edits are uncommitted and not live`,
      "Latest retained live release da140f272a058d093662530e48c66dbc2266c9dc observed 2026-11-10T08:54:10Z; not a fresh live verification",
      "Private fixtures remain excluded from Git; synthetic fixtures are engineering-only, not original source/scientific approval"],
    equations_units_and_behavior:review.equation,
    executions:[...originalExecutions,...additional,...fresh],
    supplemental_checks:{
      typecheck:{command:"npx tsc --noEmit --pretty false",
        log:typeLog,executed_at:statSync(typeLog).mtime.toISOString(),exit_code:0,counts:null,
        log_sha256:sha(typeText),workspace_revision:git,scope:"Compiler check, not runtime/scientific acceptance"},
      census:{command:"npx tsx script/field-semantics-census.ts --check",
        log:censusLog,executed_at:statSync(censusLog).mtime.toISOString(),exit_code:0,
        log_sha256:sha(censusText),workspace_revision:git,originalPublicSlots:1001,
         boundOriginalSlots:1000,originalRemaining:1,originalFingerprintUnchanged:true,
         scope:"Inventory freshness check passes; NOT completion acceptance. Both strict completion gates still fail on raw historical summary, as explicitly tested.",
         finiteExportDomainCases:35,supplementalDefinitionsNotCountedAsOriginalClosure:true},
      visual:{route:"/data-management",check_type:"judgement",check_scope:"already-running-preview static screenshot",
        result:"Page renders22 indicator count, known-producer interpretation, retained raw-summary disclosure, operator-only controls and target contract without manifest layout break",
        limitation:"Static preview only; raw-summary details not opened, and dialog/download/authenticated/operator interactions and browser XLSX downloads not visually verified"},
    },
    numerical_results:[{metric:"exact_original_clause_review",actual:review.actual,
      threshold:review.threshold,decision:review.status===V?"pass":review.status===B?"blocked":"not-fully-met"}],
    scientific_acceptance:"No scientific/model/owner acceptance inferred from software characterization or metadata coverage",
    git_commit:git,
    deployment_revision:null,
    live_release_observation:{source:"retained direct build-info/health execution",
      log:"generated-artifacts/workplan-completion/20261110T085410274732Z.log",
      source_commit:"da140f272a058d093662530e48c66dbc2266c9dc",
      checked_at:"2026-11-10T08:54:10Z",new_check_during_this_task:false,
      dirty_worktree_deployed:false},
    remaining_gaps:review.gaps,next_action:review.next,
    blockers:review.status===B?["Owner-authorised production provisioning/run provenance required; no DDL or destructive/public operation attempted"]:[],
    reviewed_at:new Date().toISOString(),
  };
}
if(readFileSync(ledgerPath,"utf8")!==before) throw new Error("Shared ledger changed during review; rerun against merged ledger before using records");
writeFileSync("docs/reconciliation-stages-00-03.json",JSON.stringify(records,null,2)+"\n");
console.log(JSON.stringify({records:Object.keys(records).length,source_sha256:ledger.source_sha256,
  originalCount:all.length,ledgerUnchanged:true,counts:Object.values(reviews).reduce((acc:any,r)=>({...acc,[r.status]:(acc[r.status]??0)+1}),{})}));
