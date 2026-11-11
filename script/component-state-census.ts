import ts from "typescript";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { routeInventory } from "./rendered-state-inventory.mjs";
import { contractFor, focusedRenderComponents } from "./component-state-contracts";

/** Engineering source census: counts real JSX consumers, not invented registry slots.
 * UI primitives are excluded; their analytical props remain expressions on the
 * containing domain component. Source locations and guards are evidence, not
 * proof that every branch has been exercised.
 */
export function componentStateCensus() {
  const files = new Map<string, Set<string>>();
  function resolve(from: string, specifier: string) {
    const base = specifier.startsWith("@/") ? `client/src/${specifier.slice(2)}`
      : specifier.startsWith(".") ? normalize(join(dirname(from), specifier)) : null;
    if (!base || base.includes("/ui/")) return null;
    return ["", ".tsx", ".ts", "/index.tsx", "/index.ts"].map(suffix => base + suffix).find(path => existsSync(path) && /\.(tsx|ts)$/.test(path)) ?? null;
  }
  function visitFile(path: string, route: string) {
    const routes = files.get(path) ?? new Set<string>();
    if (routes.has(route)) return;
    routes.add(route); files.set(path, routes);
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, path.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    for (const node of source.statements) if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const dependency = resolve(path, node.moduleSpecifier.text);
      if (dependency) visitFile(dependency, route);
    }
  }
  const app = ts.createSourceFile("client/src/App.tsx", readFileSync("client/src/App.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports = new Map<string, string>();
  const entrypoints: { file: string; component: string; route: string }[] = [];
  for (const node of app.statements) if (ts.isImportDeclaration(node) && node.importClause?.name && ts.isStringLiteral(node.moduleSpecifier)) {
    const path = resolve("client/src/App.tsx", node.moduleSpecifier.text);
    if (path) imports.set(node.importClause.name.text, path);
  }
  function routes(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(app) === "Route") {
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
      const route = attrs.find(attr => attr.name.getText(app) === "path")?.initializer;
      const component = attrs.find(attr => attr.name.getText(app) === "component")?.initializer;
      if (component && ts.isJsxExpression(component) && component.expression) {
        const path = imports.get(component.expression.getText(app));
        if (path) {
          const routePath = route && ts.isStringLiteral(route) ? route.text : "/__engineering_missing_route__";
          visitFile(path, routePath);
          entrypoints.push({ file: path, component: "default", route: routePath });
        }
      }
    }
    ts.forEachChild(node, routes);
  }
  routes(app);
  const globalComponents = { "analysis-selection.tsx": "AnalysisSelectionControl", "valuation-notice.tsx": "ValuationNotice", "app-sidebar.tsx": "AppSidebar", "theme-toggle.tsx": "ThemeToggle", "theme-provider.tsx": "ThemeProvider" };
  for (const route of routeInventory) for (const [name, component] of Object.entries(globalComponents)) {
    const file = `client/src/components/${name}`;
    visitFile(file, route.path); entrypoints.push({ file, component, route: route.path });
  }
  const declarations: any[] = [];
  const importsByFile = new Map<string, Map<string, { file: string; component: string }>>();
  for (const [path, routes] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    if (!path.endsWith(".tsx") || path.includes("/ui/")) continue;
    const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const imported = new Map<string, { file: string; component: string }>();
    for (const declaration of source.statements) if (ts.isImportDeclaration(declaration) && ts.isStringLiteral(declaration.moduleSpecifier)) {
      const file = resolve(path, declaration.moduleSpecifier.text);
      if (!file) continue;
      if (declaration.importClause?.name) imported.set(declaration.importClause.name.text, { file, component: "default" });
      const bindings = declaration.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) for (const binding of bindings.elements) {
        imported.set(binding.name.text, { file, component: binding.propertyName?.text ?? binding.name.text });
      }
    }
    importsByFile.set(path, imported);
    function component(node: ts.Node) {
      const name = (ts.isFunctionDeclaration(node) && node.name?.text) ||
        (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) && node.name.text);
      if (name && /^[A-Z]/.test(name)) {
        const expressions: any[] = [], bindings = new Set<string>(), fields = new Set<string>(), children = new Set<string>(), branches: any[] = [];
        let jsx = false;
        function walk(child: ts.Node) {
          if (child !== node && (ts.isFunctionDeclaration(child) || ts.isVariableDeclaration(child) &&
            ts.isIdentifier(child.name) && /^[A-Z]/.test(child.name.text) && child.initializer && (ts.isArrowFunction(child.initializer) || ts.isFunctionExpression(child.initializer)))) return;
          if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) jsx = true;
          if (ts.isJsxSelfClosingElement(child) || ts.isJsxOpeningElement(child)) children.add(child.tagName.getText(source));
          if (ts.isJsxExpression(child) && child.expression) {
            const expression = child.expression;
            // Include all expressions, including forwarded props/control handlers.
            const guards: string[] = [];
            for (let parent = child.parent; parent && parent !== node; parent = parent.parent) {
              if (ts.isConditionalExpression(parent)) guards.push(parent.condition.getText(source));
              if (ts.isBinaryExpression(parent) && parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) guards.push(parent.left.getText(source));
            }
            expressions.push({
              line: source.getLineAndCharacterOfPosition(child.getStart(source)).line + 1,
              span: [expression.getStart(source), expression.getEnd()],
              kind: ts.SyntaxKind[expression.kind],
              expression: expression.getText(source).replace(/\s+/g, " ").slice(0, 180),
              guards: guards.map(guard => guard.replace(/\s+/g, " ").slice(0, 180)),
            });
          }
          if (ts.isJsxAttribute(child) && child.name.getText(source) === "data-field-id" && child.initializer) bindings.add(child.initializer.getText(source));
          if (ts.isPropertyAccessExpression(child) || ts.isElementAccessExpression(child)) fields.add(child.getText(source));
          if (ts.isConditionalExpression(child)) branches.push({
            line: source.getLineAndCharacterOfPosition(child.getStart(source)).line + 1,
            condition: child.condition.getText(source).replace(/\s+/g, " ").slice(0, 180),
            whenTrue: child.whenTrue.getText(source).replace(/\s+/g, " ").slice(0, 180),
            whenFalse: child.whenFalse.getText(source).replace(/\s+/g, " ").slice(0, 180),
          });
          ts.forEachChild(child, walk);
        }
        walk(node);
        if (jsx) declarations.push({
          id: `${path}#${name}`, component: name, file: path, routes: [],
          sourceSha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
          defaultExport: ts.isFunctionDeclaration(node) && node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword),
          children: [...children].sort(),
          dynamicExpressionCount: expressions.length, expressions, fieldBindings: [...bindings].sort(), consumedAccessPaths: [...fields].sort(), branches,
          contract: expressions.length ? contractFor(path, name) : null,
        });
      }
      ts.forEachChild(node, component);
    }
    component(source);
  }
  function find(file: string, name: string) {
    return declarations.find(declaration => declaration.file === file &&
      (name === "default" ? declaration.defaultExport : declaration.component === name));
  }
  function reach(file: string, name: string, route: string) {
    const declaration = find(file, name);
    if (!declaration || declaration.routes.includes(route)) return;
    declaration.routes.push(route);
    for (const child of declaration.children) {
      const local = find(file, child);
      if (local) reach(file, child, route);
      else {
        const imported = importsByFile.get(file)?.get(child);
        if (imported) reach(imported.file, imported.component, route);
      }
    }
  }
  for (const entry of entrypoints) reach(entry.file, entry.component, entry.route);
  const components = declarations.filter(declaration => declaration.routes.length && declaration.dynamicExpressionCount)
    .map(({ defaultExport, ...declaration }) => ({ ...declaration, routes: declaration.routes.sort() }));
  return {
    boundary: "Source-derived engineering census; expressions/guards are not rendered branch coverage, scientific acceptance or S16-010 re-verification.",
    scope: "Domain JSX declarations reachable by actual component tags from actual route/page entrypoints plus five shared application surfaces. UI primitives excluded; forwarded props counted at consumer. Conditional child components count as reachable, not necessarily mounted. Sibling exports are not assigned routes merely because their module is imported.",
    routes: routeInventory.map(route => route.path), componentCount: components.length,
    dynamicExpressionCount: components.reduce((sum, component) => sum + component.dynamicExpressionCount, 0),
    fieldBindingExpressionCount: components.reduce((sum, component) => sum + component.fieldBindings.length, 0),
    denominatorMeaning: "Dynamic expressions include values, control handlers and style/forwarded props. Field-binding expressions include templates, not expanded semantic registry rows. Neither denominator is a count of scientifically validated outputs.",
    focusedRenderedComponentCount: components.filter(component => focusedRenderComponents.has(component.component)).length,
    individuallyUnrenderedComponentIds: components.filter(component => !focusedRenderComponents.has(component.component)).map(component => component.id),
    fieldBranchCoverage: "Not claimed: a focused rendered component is not proof of every expression, tooltip, modal, download or selection branch. Full source spans make this census reproducible.",
    components,
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = componentStateCensus();
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
  else console.log(JSON.stringify({ componentCount: report.componentCount, dynamicExpressionCount: report.dynamicExpressionCount, components: report.components.map(({ id, routes, dynamicExpressionCount }) => ({ id, routes, dynamicExpressionCount })) }, null, 2));
}
