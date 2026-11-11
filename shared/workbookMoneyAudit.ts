import { z } from "zod";
import type { OutputFieldSemantic } from "./outputFieldSemantics";
const count = z.number().int().nonnegative(), sha = z.string().regex(/^[a-f0-9]{64}$/);
export const workbookMoneySheetSchema = z.object({
  sheet: z.enum(["MV", "Profit"]), columns: count, dataRows: count, numericCells: count, trueZeros: count,
  providerNA: count, blank: count, other: count, explicitCurrencyCells: count, explicitMagnitudeCells: count,
  commentedCells: count, numberFormatKinds: count, firstActualSourceDate: z.string().datetime(),
  lastActualSourceDate: z.string().datetime(), unqualifiedCompanyNameUnitTokenCells: count,
}).strict();
export const workbookMoneyAuditSchema = z.object({
  version: z.literal("workbook-money-audit-2"), status: z.literal("pending-review"), capturedAt: z.string().datetime(),
  sourceHash: sha, sourceMetadataHash: sha, denominationReconciliationHash: sha, label: z.string(),
  sourceCompanyCount: count, approvedReviewCount: count, exactAcceptedIdentityCount: count,
  authorizedDatedFxCount: z.literal(0), convertedMoneyCells: z.literal(0), monetaryTotals: z.null(),
  unresolvedDenominationOrMagnitude: z.literal(true), sourceDatePolicy: z.string(), sameMonthCrossDateRowPairs: count,
  ambiguousProfitMonths: count, sheets: z.array(workbookMoneySheetSchema).length(2), limitation: z.string(), approval: z.string(),
}).strict().superRefine((report, ctx) => {
  const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
  if (new Set(report.sheets.map(s => s.sheet)).size !== 2) invalid("Exactly one MV and one Profit source sheet required");
  if (report.exactAcceptedIdentityCount > report.sourceCompanyCount || report.exactAcceptedIdentityCount > report.approvedReviewCount)
    invalid("Exact accepted identity denominator does not reconcile");
  for (const sheet of report.sheets) {
    if (sheet.columns !== report.sourceCompanyCount || sheet.numericCells + sheet.providerNA + sheet.blank + sheet.other !== sheet.columns * sheet.dataRows)
      invalid("Original full source-cell partition does not reconcile");
    if (sheet.trueZeros > sheet.numericCells || Date.parse(sheet.firstActualSourceDate) > Date.parse(sheet.lastActualSourceDate))
      invalid("Invalid observed-zero/source-date bounds");
  }
});
export type WorkbookMoneyAudit = z.infer<typeof workbookMoneyAuditSchema>;
const rootSpecs = [
  ["version", "Aggregate audit schema version", "Literal workbook-money-audit-2", "identifier"],
  ["status", "Monetary audit review status", "Literal pending-review; not currency approval", "category"],
  ["capturedAt", "Audit capture timestamp,not original publication", "Retained audit capture timestamp; never a filing availability date", "UTC timestamp"],
  ["sourceHash", "Original source workbook byte hash", "SHA256 of original uploaded source workbook; distinct from Stage10 normalized immutable workbook hash", "SHA256 hex"],
  ["sourceMetadataHash", "Retained private metadata integrity pin", "SHA256 of private-audit.json bytes; private bytes never exported", "SHA256 hex"],
  ["denominationReconciliationHash", "Retained denomination reconciliation integrity pin", "SHA256 of denomination-reconciliation.json bytes; no raw values exported", "SHA256 hex"],
  ["label", "Exact qualification of withheld monetary totals", "Retained label; unknown/unconverted money is withheld,not zero", "qualification text"],
  ["sourceCompanyCount", "Full original source company denominator", "Count company columns in original source audit; not a survivor/converted subset", "companies"],
  ["approvedReviewCount", "Existing retained identity-mapping reviews,not monetary approval", "Retained approved identity review count; does not approve workbook denomination,scale,FX or financial corpus", "reviews"],
  ["exactAcceptedIdentityCount", "Exact accepted identity count", "Retained exact-identity accepted count; identity acceptance alone never qualifies money", "companies"],
  ["authorizedDatedFxCount", "Authorized source-day FX observations", "Literal0 for this pending audit; no FX pairs inferred from quotes or nearest dates", "FX observations"],
  ["convertedMoneyCells", "Actually converted monetary source cells", "Literal0; source denomination/magnitude and required dated FX are unverified", "cells"],
  ["monetaryTotals", "Intentionally withheld unqualified monetary aggregate", "Literal null; never sum raw mixed/unknown money,default USD,assume common scale or replace missing with0", "unknown money; null"],
  ["unresolvedDenominationOrMagnitude", "Unresolved source-cell monetary qualification", "Literal true; quote/statement currency and company-name tokens do not establish workbook-cell units", "boolean"],
  ["sourceDatePolicy", "Exact source-day and alignment qualification", "Unique same-calendar-month Profit match retains actual Profit source date; no RI-day/nearest-day FX substitution", "qualification text"],
  ["sameMonthCrossDateRowPairs", "Same-month RI/Profit row pairs with different actual days", "Count matched unique same-calendar-month rows whose original dates differ; not date replacement or FX approval", "row pairs"],
  ["ambiguousProfitMonths", "Months lacking a unique Profit-date alignment", "Count months with multiple Profit rows; ambiguity must not select an arbitrary source day", "months"],
  ["limitation", "Safe aggregate and unresolved-source limitation", "Exact retained limitation; no licensed provider values/private identifiers", "qualification text"],
  ["approval", "Explicit pending-review/no-approval boundary", "Retained pending-review statement; no real approval or historical efficacy", "qualification text"],
] as const;
const sheetSpecs = [
  ["sheet", "Original source sheet", "MV or Profit; separate exact source populations", "category"],
  ["columns", "Original company columns", "Full sheet company-column count; no missing-data survivor filtering", "company columns"],
  ["dataRows", "Original dated data rows", "Count source rows excluding headers; original source dates retained", "rows"],
  ["numericCells", "Finite numeric source cells,not qualified money", "Count finite numeric source cells including true zeros; sum across MV+Profit is audit cell count,not money", "cells"],
  ["trueZeros", "Actual finite numeric source zeros", "Count source numeric value exactly0; NA/blank/other never converted to0", "cells"],
  ["providerNA", "Explicit provider-NA source cells", "Count explicit provider missing markers,not numeric0", "cells"],
  ["blank", "Blank source cells", "Count blank cells separately from provider-NA and observed0", "cells"],
  ["other", "Other nonnumeric source cells", "Count remaining source-cell kinds; no numeric coercion", "cells"],
  ["explicitCurrencyCells", "Cells with explicit source denomination evidence", "Count actual cell-level currency metadata; quote/statement currencies and name tokens excluded", "cells"],
  ["explicitMagnitudeCells", "Cells with explicit source magnitude evidence", "Count actual source-cell scale evidence; never assume units/thousands/millions", "cells"],
  ["commentedCells", "Source cells with comments", "Count actual cell comments; presence alone is not unit approval", "cells"],
  ["numberFormatKinds", "Distinct source number-format kinds", "Count distinct source formats; generic numeric formatting does not establish denomination or magnitude", "format kinds"],
  ["firstActualSourceDate", "Earliest original date of this source sheet", "Minimum actual source date; Profit date never overwritten with RI/MV date", "UTC source timestamp"],
  ["lastActualSourceDate", "Latest original date of this source sheet", "Maximum actual source date; not original filing/publication availability", "UTC source timestamp"],
  ["unqualifiedCompanyNameUnitTokenCells", "Name-token occurrences that do NOT establish cell units", "Count source audited name-token occurrences; not explicit currency/scale evidence and never used as conversion authority", "cells"],
] as const;
export const workbookMoneyRootPaths = rootSpecs.map(([path]) => path);
export const workbookMoneySheetPaths = sheetSpecs.map(([path]) => path);
export const workbookMoneyReportPaths = [...workbookMoneyRootPaths, ...workbookMoneySheetPaths.map(path => `sheets[].${path}`)];
export const workbookMoneySemantics: OutputFieldSemantic[] = [
  ...rootSpecs, ...sheetSpecs.map(([path, ...rest]) => [`sheets[].${path}`, ...rest]),
  ["auditHash", "Complete public audit disclosure identity", "SHA256(JSON.stringify(strict parsed safe summary)); HTTP header and exact JSON/XLSX download pin,not source workbook hash", "SHA256 hex"],
  ["error", "Explicit audit read/query/identity refusal", "400unsupported query;409changed pinned audit;503missing/unreadable/corrupt retained catalog. No default source,USD,FX,approval or zero money", "error text"],
].map(([path, meaning, formula, unit]) => ({
  id: `workbookMoney.${path}`, meaning, formula, unit, role: "Output", dependencies: ["Retained source workbook metadata audit and denomination reconciliation"],
  source: "Fixed existing retained safe-summary-qualified.json with both private metadata byte hashes authenticated; aggregate-only allowlist",
  period: "Original MV/Profit source dates retained separately; audit capture is not filing availability",
  geography: "Full original workbook company population,not a selected survivor subset",
  status: "Pending-review descriptive source audit; monetary totals intentionally withheld",
  missingness: "Absent/corrupt source returns503; monetaryTotals null is intentional unqualified withholding,not0; true numeric zero counts remain data",
  uncertainty: "No inferred currency,scale,dated FX,original publication availability or real approval",
  scope: "Safe counts/hashes/source-date windows only. No private identifiers/provider values. Independently reported dimensionless PE is not a monetary total and is not rejected by this audit alone.",
  asOfRule: "Exact retained audit and source-day facts; downloads pin full audit SHA256; no latest replacement for changed pins",
}));
export const workbookMoneySheetBindings = Object.fromEntries(workbookMoneySheetPaths.map(path => [
  path, { id: `workbookMoney.sheets[].${path}`, transform: "Identity of exact safe source-sheet audit count/date; no private money" },
]));
