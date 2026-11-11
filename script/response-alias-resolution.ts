import ts from "typescript";
import { relative, resolve } from "node:path";

const originalCacheAliases = new Set([
  "projectionResultCache", "categoryCacheResult",
  "historicalTrendCacheResult", "categoryHistoricalTrendCache",
]);
const wrapperName = "detachProjectionCacheResponse";
const wrapperSource = "server/calculation/projectionCacheResponse.ts";

/** Resolve only the original four aliases, optionally through the reviewed T -> T clone. */
export function resolveOriginalResponseAlias(expression: ts.Expression, checker: ts.TypeChecker) {
  const responseExpression = expression.getText();
  let transparentWrapper: { source: string; name: string } | undefined;
  if (ts.isCallExpression(expression)) {
    if (expression.arguments.length !== 1 || !ts.isIdentifier(expression.expression)) return;
    let symbol = checker.getSymbolAtLocation(expression.expression);
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.valueDeclaration;
    if (!declaration || !ts.isFunctionDeclaration(declaration) ||
      declaration.name?.text !== wrapperName ||
      relative(process.cwd(), resolve(declaration.getSourceFile().fileName)).split("\\").join("/") !== wrapperSource)
      return;
    const parameter = declaration.parameters[0], generic = declaration.typeParameters?.[0];
    const statement = declaration.body?.statements[0];
    if (declaration.parameters.length !== 1 || declaration.typeParameters?.length !== 1 ||
      !parameter || !generic || generic.constraint || generic.default ||
      !ts.isIdentifier(parameter.name) || parameter.initializer || parameter.questionToken || parameter.dotDotDotToken ||
      parameter.type?.getText() !== generic.name.text || declaration.type?.getText() !== generic.name.text ||
      declaration.body?.statements.length !== 1 || !statement || !ts.isReturnStatement(statement) ||
      !statement.expression || !ts.isCallExpression(statement.expression) ||
      !ts.isIdentifier(statement.expression.expression) || statement.expression.expression.text !== "structuredClone" ||
      statement.expression.arguments.length !== 1 ||
      statement.expression.arguments[0].getText() !== parameter.name.text)
      return;
    transparentWrapper = { source: wrapperSource, name: wrapperName };
    expression = expression.arguments[0];
  }
  if (!ts.isIdentifier(expression) || !originalCacheAliases.has(expression.text)) return;
  return { expression: expression.text, responseExpression, transparentWrapper };
}
