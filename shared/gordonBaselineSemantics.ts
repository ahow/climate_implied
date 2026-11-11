import type { OutputFieldSemantic } from "./outputFieldSemantics";
import { GORDON_DEFINITION } from "./quantityDescriptors";

/** Exactly the six additive SDG/target API metadata leaves; no census credit. */
export const gordonBaselineSemantics: OutputFieldSemantic[] = (["sdg", "targetTerciles"] as const).flatMap(prefix => {
  const context = {
    role: "Output" as const,
    source: "server/calculation/publicValuationContract.ts:gordonBaselineMetadata; effective calculator costOfEquity argument",
    period: "Annual cost-of-equity assumption for the row's workbook observation date",
    geography: "Same selected workbook population/geography as the containing row",
    status: "Descriptive steady-state valuation assumption; not a physical inference or forecast",
    missingness: "Only emitted on eligible nonempty calculator rows. Invalid nonfinite or out-of-domain r is rejected, never silently defaulted by this metadata producer.",
    uncertainty: "No calibrated uncertainty. An explicit rate is an assumption, not an empirically verified cost of capital.",
    scope: "Same selected workbook and ordered overlays as the containing row; no new financial source or issuer approval",
    asOfRule: "Query/calculator setting, not a publication-vintage observation; original source availability is not certified",
  };
  return [
    {
      ...context, id: `${prefix}.costOfEquity`,
      meaning: "Actual decimal cost of equity used for the row's Gordon comparator",
      unit: "fraction/year",
      formula: "Effective validated calculator argument costOfEquity in (0,1]; default0.08 only when omitted",
      dependencies: ["costOfEquity"],
    },
    {
      ...context, id: `${prefix}.gordonBaselineLabel`,
      meaning: "Actual-r Gordon label shared with the visible UI and valuation workbook notes",
      unit: "label",
      formula: "'Gordon baseline (r = ' + Number((costOfEquity*100).toPrecision(12)) + '%)'",
      dependencies: [`${prefix}.costOfEquity`],
    },
    {
      ...context, id: `${prefix}.gordonDefinition`,
      meaning: "Descriptive Gordon interpretation, not five-year reverse-DCF growth or physical decarbonisation",
      unit: "text",
      formula: `'${GORDON_DEFINITION}'`,
      dependencies: [`${prefix}.costOfEquity`, "priceEarnings"],
    },
  ];
});
