import type { OutputFieldSemantic } from "./outputFieldSemantics";
/** Exact proposal serialization from indicatorSourceMetadataProposal. Null is
 * bound separately for the nineteen indicators without a retained proposal. */
export const driverSourceProposalSpecs: [string, string, string, string][] = [
  ["indicators[].sourceMetadataProposal", "No retained source-metadata proposal for this indicator", "indicatorSourceMetadataProposal(key) returns null when no proposal matches; not approval or zero evidence", "null when absent"],
  ...([
    ["indicatorKey", "Exact registered indicator key", "admitted.indicatorKey", "indicator identifier"],
    ["registeredPublisher", "Publisher checked against the registered indicator", "admitted.registeredPublisher; must equal getIndicatorDef(key).source", "publisher label"],
    ["sourceRelationship", "Registered NOAA product versus unconfirmed survey candidate", "admitted.sourceRelationship; registered-product for NOAA keys, unconfirmed-survey-candidate for sacrificeWillingnessPct", "relationship classification"],
    ["scope", "Proposal is source-product metadata, not curated-value verification", "literal source-product-metadata-only", "scope label"],
    ["ownerReview", "Owner review has not been requested or supplied", "literal pending-not-requested", "review label"],
    ["centralModelEligible", "No proposal qualifies the central scientific model", "literal false", "boolean"],
    ["originalObservationAvailableAt", "Original retained-observation availability remains unknown", "literal null; current file creation and retrieval timestamps are not original observation availability", "unknown original date"],
    ["originalVintage", "No original curated-observation vintage is supplied", "literal null; metadata capture hashes are not source-vintage identifiers", "unknown original vintage"],
    ["admission", "Structural source linkage is not owner or scientific acceptance", "literal metadata-proposal-only after admitIndicatorSourceMetadataProposal", "admission label"],
    ["captureHashMeaning", "Exact meaning of document SHA256 digests", "literal sha256-utf8-webFetch-markdown-not-source-vintage", "hash scope disclosure"],
    ["evidencePath", "Public-safe incremental source-metadata evidence receipt location", "literal docs/indicator-source-fields-increment-evidence.json", "document path"],
  ] as [string, string, string, string][]).map(([key, meaning, formula, unit]): [string, string, string, string] =>
    [`indicators[].sourceMetadataProposal.${key}`, meaning, formula, unit]),
  ...["informationAvailability", "licence", "regionalApplicability", "uncertainty", "calibration"].flatMap(field =>
    ([
      ["status", `Qualification of the ${field} source-product finding, not approval of curated values`, `admitted.fields.${field}.status; source-product-qualified | candidate-only | attempted-unavailable; unconfirmed survey never source-product-qualified`, "qualification label"],
      ["sourceIds[]", `Explicit public source-document IDs supporting ${field}`, `admitted.fields.${field}.sourceIds; all IDs must resolve in indicatorSourceDocuments with the same NOAA/Pew family`, "source document identifier"],
      ["locator", `Exact section/header locator for the ${field} finding`, `admitted.fields.${field}.locator; required nonempty text`, "source locator"],
      ["finding", `Paraphrased ${field} qualification and explicit remaining evidence limits`, `admitted.fields.${field}.finding; no private dataset or original observation acceptance`, "source finding disclosure"],
    ] as [string, string, string, string][]).map(([key, meaning, formula, unit]): [string, string, string, string] =>
      [`indicators[].sourceMetadataProposal.fields.${field}.${key}`, meaning, formula, unit])),
  ...([
    ["id", "Public source-document identity", "indicatorSourceDocuments[].id selected by admitted field.sourceIds", "source document identifier"],
    ["url", "Public source page or product URL", "indicatorSourceDocuments[].url", "HTTPS URL"],
    ["sha256", "SHA256 of captured UTF8 webFetch markdown, not original release bytes", "indicatorSourceDocuments[].sha256; does not authenticate original observation vintage or grant redistribution rights", "SHA-256"],
    ["bytes", "Captured UTF8 markdown byte length, not the size of an original publication", "indicatorSourceDocuments[].bytes", "UTF8 bytes"],
  ] as [string, string, string, string][]).map(([key, meaning, formula, unit]): [string, string, string, string] =>
    [`indicators[].sourceMetadataProposal.documents[].${key}`, meaning, formula, unit]),
];

// Exact new driver-registry leaves: none is accepted by a wildcard/default
// semantic binding. Status distinguishes a code-consumer trace from evidence.
export const driverConsumerFieldSpecs: [string, string, string, string, string][] = [
  ["indicators[].actualConsumers.legacy.classification", "Legacy equations are diagnostic, not a calibrated central forecast", 'driverConsumerTrace(key).legacy.classification = "legacy-diagnostic-not-calibrated-central"', "classification label", "Preserved legacy diagnostic; not central calibration"],
  ["indicators[].actualConsumers.legacy.consumer", "Actual legacy trajectory implementation that reads or validates adapter fields", 'literal "server/calculation/forwardProjection.ts:calculateEmissionsTrajectory"', "qualified source/function path", "Implementation location, not causal evidence"],
  ["indicators[].actualConsumers.legacy.historicalAdapters[]", "Named transformations from curated indicators into legacy trajectory arguments", 'literal ["getCurrentIndicatorsFromHistorical","categoryHistoricalTrend.convertToIndicatorData"]', "function identifier", "Legacy adapter trace; transformations do not establish calibration"],
  ["indicators[].actualConsumers.legacy.categoryConsumer", "Separate category comparator applies stylized shocks rather than calibrated observation effects", 'literal "server/calculation/categoryProjections.ts:applyCategoryModifications (stylized shocks)"', "qualified source/function path and caveat", "Illustrative category diagnostic, not observed-driver attribution"],
  ["indicators[].actualConsumers.legacy.fields[]", "Exact legacy IndicatorData argument names reached from this curated key; empty when no adapter/observation field is consumed", "driverConsumptionTrace legacy[key].fields; includes validated-but-unused globalGDP/atmosphericCO2ppm and derived netZeroTargetsCoverage where applicable", "IndicatorData field identifier", "Code-path inventory only; presence does not imply a numerical equation effect"],
  ["indicators[].actualConsumers.legacy.mechanism", "Driver-specific implemented equation or explicit non-consumption: capacity displacement, sales-to-fleet, policy/corporate/finance heuristics, baseline/anchor/threshold, validation-only or absent observation consumer", "driverConsumptionTrace legacy[key].mechanism; exact keyed equation descriptions for all 22 curated indicators; GDP and atmospheric CO2 validate only, survey/divestment/budget observations have no emissions equation consumer", "equation/non-consumption description", "Actual legacy equation trace; not incremental causal identification"],
  ["indicators[].actualConsumers.legacy.registryGateEnforced", "Registry eligibility flags do not gate preserved legacy equations", "literal false; legacy calculateEmissionsTrajectory is not dispatched through the registered Stage5 consumer", "boolean", "Explicit enforcement limitation; legacy must not be labelled registered central"],
  ["indicators[].actualConsumers.legacy.acceptedForecastUse", "Accepted-central and accepted-sensitivity requests are refused by the legacy calculator boundary; retained diagnostic use is not calibrated admission", 'driverConsumerTrace(key).legacy.acceptedForecastUse = "refused-at-calculator-boundary"; calculateEmissionsTrajectory calls assertLegacyComparatorUse; the native source-linked registry gate remains separate', "use-refusal classification", "Enforced refusal of accepted forecast use; no original scientific closure or distribution promotion"],
  ["indicators[].actualConsumers.legacy.caveat", "Legacy-only use gate rejects accepted forecasts without transferring native registry eligibility", 'literal "Preserved comparator equations; explicit legacy-only use gate rejects central/accepted sensitivity. No native registry eligibility is transferred."', "limitation text", "Known legacy enforcement boundary, separately labelled diagnostic"],
  ["indicators[].actualConsumers.stage5.consumer", "Actual registered native regional call chain, dispatched by the existing Stage5 CLI registered-native sensitivity mode", 'literal "consumeRegionalParameterRegistry -> projectRegionalMember -> projectInventoryEmissions"', "function call chain", "Registered native conditional-engine consumer; not scientific acceptance"],
  ["indicators[].actualConsumers.stage5.implicitCuratedIndicatorConsumption", "Curated indicators are not silently copied into native regional scenario parameters", "literal false; native consumption requires exact explicitly bound source-verified joint registry rows", "boolean", "No implicit curated-to-native bridge or default central substitution"],
  ["indicators[].actualConsumers.stage5.gate", "Every actual scenario parameter leaf must be a canonical mechanism input with permitted use and source-verified exact region/path binding; central joint rows and native inventory also require pinned review", "consumeRegionalParameterRegistry: assertParameterUse for every binding, verifyParameterSources for every used evidence record, identical coverage for every row, assertRegionalDistributionUse for central distribution/inventory sign-off; no accepted central pin exists", "enforcement rule text", "Implemented registered-consumer gate; role alone, caller hash or baseline point winner cannot promote a distribution"],
  ["indicators[].actualConsumers.stage5.directCuratedDistribution", "No accepted directly compatible native parameter distribution exists for this curated indicator", "literal null; retained generation-share bootstrap distributions are separate sensitivities, not this curated driver's native regional coefficients", "null; unavailable distribution", "Unavailable, not zero, fitted prior or calibrated central parameter"],
  ["indicators[].actualConsumers.stage5.missingBridge", "Discloses the absent approved source-compatible curated-to-native parameter mapping", 'literal "No approved source-compatible mapping from this curated driver to native regional parameter distributions"', "evidence-gap text", "Unresolved bridge; no accepted real six-region central joint registry"],
  ["indicators[].parameterDistribution.status", "This curated indicator lacks an approved directly compatible parameter distribution", 'literal "unavailable"; does not relabel the separate retained adoption sensitivity distributions', "availability status label", "Unavailable curated-driver distribution; no central promotion"],
  ["indicators[].parameterDistribution.registryVersion", "Version identifier of the source-linked Stage4 distribution registry contract", 'literal "stage4-source-linked-1"; returned by retainedAdoptionParameterRegistry', "version identifier", "Versioned registry engineering contract, not a scientific calibration status"],
  ["indicators[].parameterDistribution.loader", "Fixed retained adoption distribution loader; not a caller-controlled file path", 'literal "retainedAdoptionParameterRegistry"; loader verifies pinned report/source/protocol/registry hashes', "function identifier", "Fixed source-verified loader; separate generation-share sensitivities only"],
  ["indicators[].parameterDistribution.reason", "Solar/wind generation-share bootstrap distributions cannot be substituted for this curated indicator", 'literal "Retained solar/wind generation-share bootstrap distributions are separately sensitivity-only; not distributions for this curated indicator"', "source-compatibility limitation text", "Sensitivity-only retained adoption evidence; curated native distribution unavailable"],
];

// Each tuple identifies a concrete response leaf and its implemented derivation.
export const driverFieldSpecs: [string, string, string, string][] = [
  ...driverSourceProposalSpecs,
  ["status", "Evidence disclosure status", 'literal "evidence-gaps-explicit"', "label"],
  ["indicators[].id", "Retained indicator identifier", "INDICATORS[].key", "identifier"],
  ["indicators[].definition", "Registry indicator label, not a causal effect", "INDICATORS[].label", "text"],
  ["indicators[].publisher", "Registry source attribution", "INDICATORS[].source", "text"],
  ["indicators[].rawUnit", "Registry input unit", "INDICATORS[].unit", "unit label"],
  ["indicators[].transformedUnit", "Unchanged registry unit; no transformation applied here", "INDICATORS[].unit", "unit label"],
  ["indicators[].geography", "Declared global coverage", 'literal "global"', "label"],
  ["indicators[].category", "Registry category", "INDICATORS[].category", "label"],
  ["indicators[].role", "Canonical causal-use role, shared with native diagnostics; not admission", 'curatedDriverRole(key): six mechanism-input candidates, three validation-targets, remaining context', "canonical driver-role label"],
  ["indicators[].legacyRole", "Explicit previous registry vocabulary for API compatibility; not an eligibility override", 'role === "mechanism-input" ? "candidate-mechanism-input" : role; use canonical role for new consumers', "deprecated role label"],
  ["indicators[].admission", "Role assignment does not admit any curated input to accepted forecasts", 'literal "not-admitted"; centralModelEligible remains false for all 22', "admission label"],
  ["indicators[].centralModelEligible", "No indicator is promoted to the central model", "literal false", "boolean"],
  ["indicators[].reason", "Role-specific evidence limitation", "mechanism-input: incomplete regional calibration/uncertainty; validation-target: outcome check; otherwise no identified incremental causal coefficient", "text"],
  ["indicators[].observationPeriod.firstYear", "First retained curated year", "min(HISTORICAL_INDICATORS.map(row => row.year))", "calendar year"],
  ["indicators[].observationPeriod.lastYear", "Last retained curated year", "max(HISTORICAL_INDICATORS.map(row => row.year))", "calendar year"],
  ["indicators[].observationPeriod.meaning", "Revised observations/estimates caveat", "literal retained curated row-period warning; not verification of original observations", "text"],
  ["indicators[].informationAvailableAt", "Unknown original information availability", "literal null; no file/fetch date substitution", "unknown date"],
  ["indicators[].vintage", "Content-addressed retained-history label", '"retained-curated-history:" + contentHash(HISTORICAL_INDICATORS.map(row => ({year:row.year,value:row[key]})))', "identifier"],
  ["indicators[].sourceProvenance.retainedInputHash", "Hash of retained years and values for this indicator", "contentHash(HISTORICAL_INDICATORS.map(row => ({year:row.year,value:row[key]})))", "SHA-256"],
  ["indicators[].sourceProvenance.recordCount", "Retained row count including estimated rows", "HISTORICAL_INDICATORS.length", "rows"],
  ["indicators[].sourceProvenance.sourceFile", "Retained input source location", 'literal "server/calculation/historicalIndicators.ts"', "path"],
  ["indicators[].sourceProvenance.originalPublicationArchive", "Original archive availability", 'literal "unavailable"', "label"],
  ["indicators[].sourceProvenance.publicationDateMeaning", "Original release date is unknown", "literal warning that file time and fetch time do not substitute for release date", "text"],
  ["indicators[].sourceProvenance.derivation.formula", "Documented supplied-series derivation, not an executed coefficient", "derived[key].formula: capacity_t/capacity_t-1 - 1; salesShare_t/salesShare_t-1 - 1; fossilCO2GtPerYear/gdpTrillionUSD; otherwise retained supplied series with no causal coefficient inferred", "formula text"],
  ["indicators[].sourceProvenance.derivation.dependencies[]", "Inputs named by documented derived series", "derived[key].dependencies or []; capacity for renewable growth, sales share for EV growth, fossil CO2 and GDP for intensity", "indicator identifier"],
  ["indicators[].sourceProvenance.frozenStudies[]", "Existing frozen study document paths", "studies[key] or []; EV protocols/results for EV share/growth, driver protocol for renewable capacity/growth", "path"],
  ["indicators[].sourceProvenance.calibrationDecision", "No central promotion from retained studies", "studies[key] ? existing frozen evidence retained, not central promotion : no source-compatible frozen causal calibration", "text"],
  ["indicators[].updateCadence", "Declared existing collection/review process", 'literal "existing-monthly-collection-review-approval"', "label"],
  ["indicators[].uncertainty.status", "No established uncertainty distribution", 'literal "unavailable"', "label"],
  ["indicators[].uncertainty.reason", "Source-specific uncertainty limitation", 'literal "Source-specific uncertainty distribution not established"', "text"],
  ["indicators[].licence.status", "Reuse approval remains unresolved", 'literal "review-required"', "label"],
  ["indicators[].licence.publisher", "Publisher for licence review", "INDICATORS[].source", "text"],
  ["indicators[].overlapGroup", "Category used to disclose potential overlap", "INDICATORS[].category", "label"],
  ["indicators[].regionalApplicability", "Regional applicability not established", 'literal "not-established"', "label"],
  ["indicators[].missingData", "Declared null/interpolation policy, not interpolation performed here", 'literal "preserve-null; interior interpolation only when explicitly requested and labelled"', "text"],
  ["indicators[].evidenceState", "Evidence remains unavailable", 'literal "Unavailable"', "label"],
  ...driverConsumerFieldSpecs.map(([field, meaning, formula, unit]): [string, string, string, string] =>
    [field, meaning, formula, unit]),
];

export const referenceFieldSpecs: [string, string, string, string][] = [
  ["version", "Pinned CAT release identifier", "catReferences.version", "identifier"],
  ["status", "External-reference classification", "catReferences.status = published-external-reference", "label"],
  ["temperatureMetric", "Published median 2100 warming above pre-industrial", "catReferences.temperatureMetric", "metric label"],
  ["climateModel", "CAT MAGICC7 attribution; not dashboard or FaIR", "catReferences.climateModel", "text"],
  ["emissionsUnit", "Published aggregate emissions unit", "catReferences.emissionsUnit = GtCO2e/year", "unit label"],
  ["comparisonCaveat", "No rebasing, probability-interval or native-gas equivalence claim", "catReferences.comparisonCaveat", "text"],
  ["refreshPolicy", "Pinned manually reviewed reference, not refreshed by analysis", "catReferences.refreshPolicy", "text"],
  ["source.name", "Publisher name", "catReferences.source.name", "text"],
  ["source.publishedAt", "Pinned publication date, not request time", "catReferences.source.publishedAt = 2025-11-13", "ISO date"],
  ["source.url", "Publisher pathway publication link", "catReferences.source.url", "URL"],
  ["source.workbookUrl", "Original CAT COP30 public-data workbook link", "catReferences.source.workbookUrl", "URL"],
  ["source.sha256", "Recorded source workbook content digest", "catReferences.source.sha256; not recomputed by this endpoint", "SHA-256"],
  ["source.attribution", "Required Climate Analytics/NewClimate attribution", "catReferences.source.attribution", "text"],
  ["source.copyright", "Publisher retained rights notice", "catReferences.source.copyright", "text"],
  ["source.licence", "Non-commercial-use restriction with attribution requirement", "catReferences.source.licence", "text"],
  ["scenarios[].id", "Current-policy or all-announced-commitments scenario key", "catReferences.scenarios[].id", "identifier"],
  ["scenarios[].label", "Dashboard label for the published conditional scenario", "catReferences.scenarios[].label", "text"],
  ["scenarios[].publishedName", "Original CAT scenario name", "catReferences.scenarios[].publishedName", "text"],
  ["scenarios[].definition", "Policy/pledge delivery assumption; not equal scenario likelihood", "catReferences.scenarios[].definition", "text"],
  ["scenarios[].temperatureMedianC", "Published median 2100 warming, not dashboard simulation", "catReferences.scenarios[].temperatureMedianC; policies 2.6, optimistic commitments 1.9", "deg C above pre-industrial"],
  ["scenarios[].emissions[].year", "Published emissions milestone year", "catReferences.scenarios[].emissions[].year in {2030,2035,2050,2100}", "calendar year"],
  ["scenarios[].emissions[].low", "Low current-policy pathway, NOT a probability quantile", "catReferences.scenarios[id=current-policies].emissions[year].low", "GtCO2e/year"],
  ["scenarios[].emissions[].high", "High current-policy pathway, NOT a probability quantile", "catReferences.scenarios[id=current-policies].emissions[year].high", "GtCO2e/year"],
  ["scenarios[].emissions[].value", "Optimistic all-commitments pathway emissions", "catReferences.scenarios[id=all-announced-commitments].emissions[year].value", "GtCO2e/year"],
  ["supportingSources[].name", "Supporting IEA/NGFS reference name", "catReferences.supportingSources[].name", "text"],
  ["supportingSources[].role", "Supporting comparison use, not additional model input", "catReferences.supportingSources[].role", "text"],
  ["supportingSources[].url", "Supporting publication link", "catReferences.supportingSources[].url", "URL"],
  ["supportingSources[].caveat", "Supporting scenario coverage and vintage limitations", "catReferences.supportingSources[].caveat", "text"],
];

export const researchFieldSemantics: OutputFieldSemantic[] = [
  ...driverFieldSpecs.map(([field,meaning,formula,unit]): OutputFieldSemantic => ({
    id:`driverRegistry.${field}`,meaning,formula,unit,role:"Output",
    dependencies:["INDICATORS", "HISTORICAL_INDICATORS", "driverEvidenceRegistry"],
    source:"server/calculation/driverEvidence.ts: driverEvidenceRegistry",
    period:"Retained curated historical row span; not a projection horizon",geography:"Global",
    status:driverConsumerFieldSpecs.find(spec => spec[0] === field)?.[4] ??
      "Research disclosure only; centralModelEligible=false",
    missingness:"Original informationAvailableAt is null; absent derivations/studies have empty arrays; unavailable evidence is explicit",
    uncertainty:"Source-specific distributions unavailable; no calibrated causal claim",
    scope:"Retained revised history and research metadata, not original-vintage evidence",
    asOfRule:"Content hash identifies retained input rows; original publication availability unknown",
  })),
  ...referenceFieldSpecs.map(([field,meaning,formula,unit]): OutputFieldSemantic => ({
    id:`publishedReference.${field}`,meaning,formula,unit,role:"Output",
    dependencies:[`catReferences.${field}`],
    source:"server/calculation/data/catReferences.json; CAT November 2025 public workbook, recorded source SHA-256",
    period:"Pinned 2025-11-13 release; emissions milestones 2030/2035/2050/2100; temperature 2100",geography:"Global",
    status:"Published external reference, not dashboard forecast or model validation",
    missingness:"low/high exist only for current policies; value exists only for commitments; absent counterpart is not zero",
    uncertainty:"Policy low/high pathways are not probability intervals; published temperature median only",
    scope:"Independent published scenarios; no inventory rebasing or native-gas conversion",
    asOfRule:"Pinned publication date 2025-11-13; manual source review required for update",
  })),
];
