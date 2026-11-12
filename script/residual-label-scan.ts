import ts from "typescript";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const mention = /net[\s-]?zero/gi;
export type LabelOccurrence = {
  file: string; line: number; start: number; kind: string; text: string;
  context: string;
  classification: "technical-name" | "local-negation" | "reviewed-exception" | "violation" | "unknown";
  reason: string;
};
/** Exceptions bind one exact source text and file, not an entire file, route or
 * keyword. A changed exception becomes unused and fails the review gate. */
export const residualTextExceptions: { file: string; text: string; reason: string }[] = [
  { file: "client/src/components/category-comparison.tsx", text: "Identity; fixed-5gt-v1; null preserved; not 5% or net zero", reason: "Individual export transform explicitly negates both percentage equivalence and net zero; year remains fixed5Gt." },
  { file: "client/src/components/historical-trend-chart.tsx", text: "Identity; fixed-5gt-v1; null preserved; not 5% or net zero", reason: "Individual historical export transform explicitly negates both percentage equivalence and net zero." },
  { file: "client/src/components/regional-comparison.tsx", text: "Identity; fixed-5gt-v1; null preserved; not 5% or net zero", reason: "Individual regional export transform explicitly negates both percentage equivalence and net zero." },
  { file: "shared/downloadClaims.ts", text: "Control/illustrative/dashboard inputs are not approved calibrated policy forecasts. Published inventory uncertainty is not forecast uncertainty; retained hashes are not publication-vintage proof. Separate residual diagnostics use5% of the same captured2024 native-gas baseline, not CO2e or physical net zero; no crossing is censored at the actual simulated horizon.", reason: "Exact native export caveat negates CO2e/physical-net-zero interpretation; it does not label the5% residual net zero. Moved verbatim from client/src/lib/export-contract.ts to the shared authoritative claim registry." },
  { file: "client/src/lib/ui-claim-register.ts", text: "P/E rows only. Temperature, carbon-price, physical-rate and net-zero exports removed.", reason: "Exact UI claim register states these exports were removed, not that a residual is net zero." },
  { file: "client/src/pages/climate-valuation.tsx", text: "Temperature, carbon price, net-zero year and physical decarbonization rates: unavailable. No defensible valuation-to-activity mapping has been established. No numeric substitutes are shown or exported.", reason: "Exact adjacent list explicitly says unavailable and forbids numeric substitutes." },
  { file: "client/src/pages/methodology.tsx", text: "The separate native candidate review can use its pinned, captured source-derived2024 inventory cells as a conditional baseline: species masses remain in Mt of that same gas, with fossil/industrial CO2 and net land-use CO2 separated. These are not GWP-weighted CO2e residuals, a calibrated forecast or physical net zero. Supplied regional-member diagnostics use explicit captured MODEL initial conditions; no missing regional2024 land-use observation is fabricated.", reason: "Exact native-method paragraph negates calibrated-forecast and physical-net-zero interpretations; species-mass conditional residuals remain separate." },
  { file: "client/src/pages/methodology.tsx", text: "Climate Action Tracker (CAT), published 13 November 2025, is the main external reference: “Policies &amp; action” represents current policies; “Optimistic scenario (net-zero pledges)” assumes all announced commitments are delivered. The latter is a conditional optimistic case, not an equally likely forecast. Temperatures are published median warming in 2100 above pre-industrial levels from CAT MAGICC7, not our dashboard calculation or FaIR.", reason: "Exact CAT publication scenario title/pledge scope, not a positive-residual crossing label or dashboard forecast." },
  { file: "client/src/pages/methodology.tsx", text: "IEA World Energy Outlook 2025 supports energy, electricity, transport and industry checks: CPS covers enacted policies, STEPS also considers intentions, and WEO 2025 has no updated Announced Pledges Scenario. NGFS Phase V, version 5.1 supports detailed pathways and model comparisons, but uses a March 2024 policy/pledge cut-off; its NDCs exclude long-term net-zero pledges. Neither source is an additional calculation input or a replacement for CAT’s full-commitments comparison.", reason: "Exact external-reference policy cut-off/pledge exclusion, not a residual labelled zero." },
  { file: "client/src/pages/methodology.tsx", text: "Net Zero Tracker", reason: "Exact publisher proper name in the indicator-source table; not a quantity label." },
  { file: "server/calculation/driverConsumptionTrace.ts", text: "coverage * uncertain implementation * elapsed-time heuristic; derived netZeroTargetsCoverage is validated but unused", reason: "Exact code-field trace documents an unused derived coverage field, not a net-zero date." },
  { file: "server/calculation/nativeThresholdDiagnostics.ts", text: "Source-derived captured candidate2024 native inventory; future trajectory is conditional, not calibrated or scientifically promoted. Hashes identify actual captured input, not output self-authentication. Retained source records were not independently redownloaded in this run. No CO2e/mass conversion or physical-net-zero claim.", reason: "Exact native-diagnostic qualification expressly says no physical-net-zero claim; protected source is read, not rewritten." },
  { file: "server/dataIngestion/indicatorRegistry.ts", text: "Net-Zero Policy Coverage", reason: "Exact indicator name measures announced national policy coverage, not a residual crossing year." },
  { file: "server/dataIngestion/indicatorRegistry.ts", text: "percentage of global emissions covered by national net-zero targets for the most recent year, per Climate Action Tracker or Net Zero Tracker", reason: "Exact provider prompt requests policy coverage and names its sources; not a zero-emissions calculation." },
  { file: "server/dataIngestion/indicatorRegistry.ts", text: "share of announced net-zero targets that are enshrined in law or policy (as a fraction between 0 and 1) for the most recent year, per Climate Action Tracker", reason: "Exact provider prompt requests target-implementation share, not a residual date." },
  { file: "server/newsApi/newsService.ts", text: "net zero", reason: "Exact news-search keyword, not a displayed analytical milestone." },
  { file: "server/newsApi/newsService.ts", text: "net zero target", reason: "Exact news topic-classification keyword, not a displayed analytical milestone." },
  { file: "server/routes.ts", text: "net-zero-summary", reason: "Exact named provider prompt key for a policy-target indicator summary; no positive residual value is labelled by it." },
  { file: "shared/finiteExportSchemas.ts", text: "Identity; null/undefined -> blank; fixed5Gt threshold is not5% or net zero", reason: "Exact category-history export transform explicitly negates both percentage equivalence and net zero." },
  { file: "shared/indicatorFieldSemantics.ts", text: "Global emissions covered by announced national net-zero targets", reason: "Exact indicator definition refers to national announced target coverage, not emissions reaching zero." },
  { file: "shared/researchFieldSemantics.ts", text: "driverConsumptionTrace legacy[key].fields; includes validated-but-unused globalGDP/atmosphericCO2ppm and derived netZeroTargetsCoverage where applicable", reason: "Exact diagnostic field trace identifies validated-but-unused inputs/derived coverage, not a positive-residual label." },
  { file: "shared/targetInputSemantics.ts", text: "literal scope1+scope2; no scope 3 or scope 1-only substitution, no assumption of net zero", reason: "Exact target-scope metadata explicitly says no assumption of net zero." },
  { file: "shared/thresholdDiagnostic.ts", text: "/** Versioned residual diagnostic, deliberately separate from physical net zero. */", reason: "Exact module comment distinguishes residual diagnostic from physical net zero." },
  { file: "shared/thresholdDiagnosticSemantics.ts", text: "Explicit positive residual / physical-net-zero separation", reason: "Exact boolean-definition text describes separation rather than equivalence." },
  { file: "shared/thresholdDiagnosticSemantics.ts", text: "first annual p50<=5, else null at selected horizon; NOT5% or net zero", reason: "Exact fixed5Gt-year formula explicitly negates percentage equivalence and net zero." },
  { file: "server/calculation/data/catReferences.json", text: "Optimistic scenario (net-zero pledges)", reason: "Exact retained CAT published scenario name; commitment scenario title, not a residual crossing-year label." },
  { file: "server/calculation/data/catReferences.json", text: "Assumes governments achieve all announced targets, including long-term net-zero announcements and proposals. An optimistic conditional case, not an equally likely forecast.", reason: "Exact CAT scenario definition describes conditional fulfilment of pledges, not a5% or5Gt milestone." },
  { file: "shared/referenceScenarioLabels.ts", text: "Optimistic scenario (net-zero pledges)", reason: "Exact reviewed CAT publication title reused by the label-identity guard; identical to retained catReferences.json, not a residual crossing-year label." },
  { file: "shared/referenceScenarioLabels.ts", text: "Assumes governments achieve all announced targets, including long-term net-zero announcements and proposals. An optimistic conditional case, not an equally likely forecast.", reason: "Exact reviewed CAT national long-term-pledge definition reused by the identity guard; identical to retained catReferences.json, not a5% or5Gt milestone." },
  { file: "server/calculation/data/catReferences.json", text: "March 2024 policy/pledge cut-off; NDCs excludes long-term net-zero pledges. Not the main user-facing reference or a replacement for the full-commitments comparison.", reason: "Exact NGFS source-vintage/pledge-exclusion caveat, not dashboard physical net-zero acceptance." },
];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? files(join(dir, entry.name)) : /\.(?:ts|tsx|json)$/.test(entry.name) ? [join(dir, entry.name)] : []);
}
export function classifyResidualText(text: string, technical = false, context = ""): Pick<LabelOccurrence, "classification" | "reason"> {
  if (technical) return { classification: "technical-name", reason: "Code/attribute identifier, not a rendered quantity label" };
  const normalized = text.replace(/\s+/g, " ").trim();
  const matches = [...normalized.matchAll(mention)];
  if (matches.every(match => {
    const before = normalized.slice(Math.max(0, match.index! - 95), match.index);
    const after = normalized.slice(match.index! + match[0].length, match.index! + match[0].length + 95);
    return /(?:\bnot(?:\s+(?:physical|a|policy|true))*|\bneither residual diagnostic is)\s*$/i.test(before) ||
      /^[\s,;:\w-]{0,65}?\b(?:is|are|remain|remains)\s+(?:withheld|unavailable|unsupported|superseded)\b/i.test(after);
  })) return { classification: "local-negation", reason: "Each occurrence has its own adjacent negation or explicit withheld/unavailable qualification" };
  if (/(?:5\s*%|five.percent|5\s*Gt|fixed.?5|positive.residual|residual.threshold)/i.test(`${normalized} ${context}`))
    return { classification: "violation", reason: "Positive residual and unnegated net-zero text share one literal/JSX text/comment; individual review required" };
  return { classification: "unknown", reason: "Unnegated net-zero text requires an exact individual source-context exception or correction" };
}
export function residualLabelScan() {
  const sourceFiles = ["client/src", "server", "shared"].flatMap(files).sort();
  const occurrences: LabelOccurrence[] = [];
  const routes: { file: string; line: number; method: string; pathExpression: string }[] = [];
  const exports: { file: string; line: number; writer: string }[] = [];
  const used = new Set<number>();
  for (const file of sourceFiles) {
    const text = readFileSync(file, "utf8");
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true,
      file.endsWith(".json") ? ts.ScriptKind.JSON : file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const add = (start: number, value: string, kind: string, technical = false) => {
      if (!/net[\s-]?zero/i.test(value)) return;
      const context = text.slice(Math.max(0, start - 260), start + value.length + 260).replace(/\s+/g, " ").trim();
      const exceptionIndex = residualTextExceptions.findIndex(e => e.file === file && e.text === value.replace(/\s+/g, " ").trim());
      const decision = exceptionIndex >= 0
        ? { classification: "reviewed-exception" as const, reason: residualTextExceptions[exceptionIndex].reason }
        : classifyResidualText(value, technical, context);
      if (exceptionIndex >= 0) used.add(exceptionIndex);
      occurrences.push({ file, line: source.getLineAndCharacterOfPosition(start).line + 1, start, kind, text: value, context, ...decision });
    };
    const walk = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const receiver = node.expression.expression.getText(source), method = node.expression.name.text;
        if (["app", "router"].includes(receiver) && ["get", "post", "put", "patch", "delete"].includes(method))
          routes.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            method: method.toUpperCase(), pathExpression: node.arguments[0]?.getText(source) ?? "UNRESOLVED" });
        if (["book_append_sheet", "writeFile", "attachment"].includes(method))
          exports.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, writer: node.expression.getText(source) });
      }
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(source);
        if (tag === "Route") {
          const attr = node.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === "path") as ts.JsxAttribute | undefined;
          routes.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
            method: "PAGE", pathExpression: attr?.initializer?.getText(source) ?? "FALLBACK" });
        }
        if (["DownloadDataButton", "DownloadJsonButton"].includes(tag) ||
          node.attributes.properties.some(p => ts.isJsxAttribute(p) && p.name.getText(source) === "download"))
          exports.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, writer: tag });
      }
      if (ts.isIdentifier(node) && /netzero/i.test(node.text)) add(node.getStart(source), node.text, "identifier", true);
      if (ts.isJsxText(node)) add(node.getStart(source), node.text.trim(), "JSX text");
      if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
        let ancestor: ts.Node | undefined = node.parent;
        while (ancestor && !ts.isJsxAttribute(ancestor) && !ts.isJsxElement(ancestor) && !ts.isJsxSelfClosingElement(ancestor))
          ancestor = ancestor.parent;
        const attribute = ancestor && ts.isJsxAttribute(ancestor) ? ancestor.name.getText(source) : "";
        const technical = ["data-testid", "id", "aria-labelledby"].includes(attribute) ||
          /^(?:notNetZero|netZero(?:[A-Z]\w*)?|[A-Za-z][\w.[\]-]*\.netZeroYear)$/.test(node.text);
        add(node.getStart(source), node.text, "string/template", technical);
      }
      ts.forEachChild(node, walk);
    };
    walk(source);
    // The lexical scanner includes comments not represented as AST children.
    const scanner = ts.createScanner(ts.ScriptTarget.Latest, false, ts.LanguageVariant.Standard, text);
    for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan())
      if (token === ts.SyntaxKind.SingleLineCommentTrivia || token === ts.SyntaxKind.MultiLineCommentTrivia)
        add(scanner.getTokenPos(), scanner.getTokenText(), "comment");
  }
  return {
    scope: "Every TypeScript/TSX/JSON source under client/src,server,shared, including all runtime route/API descriptions, export builders, legacy methodology, shipped publication records and comments. AST identifiers and UI-test attributes are inventoried separately from rendered text. No file/route whitelist.",
    limitations: "Static runtime-source/context scan, not execution of arbitrary dynamic strings, external provider/article content, archived opaque JSON, database rows, unrelated operator/study CLI artifacts or built minified artifacts. Those remain unknown, not silently accepted.",
    sourceFiles,
    surfaceInventory: { routes, exports },
    counts: Object.fromEntries(["technical-name", "local-negation", "reviewed-exception", "violation", "unknown"].map(kind =>
      [kind, occurrences.filter(o => o.classification === kind).length])),
    unusedExceptions: residualTextExceptions.filter((_, i) => !used.has(i)),
    occurrences,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = residualLabelScan();
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ files: report.sourceFiles.length, counts: report.counts,
    review: report.occurrences.filter(o => ["violation", "unknown"].includes(o.classification)) }, null, 2));
}
