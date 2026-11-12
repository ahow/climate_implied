/** Request/result-object scoped consumed source release. No DB imports, global
 * current release, HTTP proof setter or publication authority. Pure operator
 * and CLI readers must remain portable without server DB dependencies. */
export type ReportReleaseKind = "stage10-coverage" | "track-b-publication" | "workbook-money-audit" | "company-coverage" | "indicator-detail";
const consumed = new WeakMap<object, { kind: ReportReleaseKind; source: any }>();
const failures = new WeakMap<object, string>();
export function rememberReportRelease<T extends object>(report: T, kind: ReportReleaseKind, source: unknown): T {
  consumed.set(report, { kind, source: JSON.parse(JSON.stringify(source)) }); return report;
}
export function consumedReportRelease(report: object) { return consumed.get(report); }
export function rememberReportReleaseFailure<T extends object>(report: T, reason: string) {
  failures.set(report, reason); return report;
}
export function reportReleaseFailure(report: object) { return failures.get(report); }
