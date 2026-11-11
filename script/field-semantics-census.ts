import ts from "typescript";
import { existsSync,readFileSync,writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fieldSemantics } from "../shared/fieldSemantics";
import { outputFieldSemantics, bindExportColumns } from "../shared/outputFieldSemantics";
import { evidenceApiBindings } from "../shared/evidenceFieldSemantics";
import { diagnosticMetadataBindings } from "../shared/diagnosticMetadataSemantics";
import { remainingApiBindings } from "../shared/remainingFieldSemantics";
import { nativePathwayDynamicSlots, nativePathwayGasIds } from "../shared/nativePathwaySemantics";
import { finiteExportBindings,finiteExportCellDomains,finiteExportDomainCases,type FiniteExportFamily } from "../shared/finiteExportSchemas";
import { nativeExportColumns } from "../shared/nativeExport";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { execFileSync,spawnSync } from "node:child_process";
import { relative,resolve } from "node:path";
import { semanticsCompletionGateError,type SemanticsCompletionGate } from "./field-semantics-gates";
import { thresholdExportBindings } from "../client/src/lib/threshold-export";
import { supplementalSheetBindings, supplementalSheetSemantics } from "../shared/supplementalSheetBindings";
import { fetchSummarySemantics } from "../shared/fetchSummarySemantics";
import { companyAbatementSemantics } from "../shared/companyAbatementSemantics";
import { companyCoverageSemantics } from "../shared/companyCoverageSemantics";
import { gordonBaselineSemantics } from "../shared/gordonBaselineSemantics";
import { originalNominalAssessmentSemantics } from "../shared/originalNominalAssessmentSemantics";
import { thresholdDiagnosticSemantics } from "../shared/thresholdDiagnosticSemantics";
import { nativeThresholdSemantics } from "../shared/nativeThresholdSemantics";
import { nativeThresholdExportBindings, nativeThresholdExportRows } from "../client/src/lib/native-threshold-export";
import { nativeCandidateResidualDiagnostics } from "../server/calculation/nativeThresholdDiagnostics";
import { projectNativeEmissions, constantScenario } from "../server/calculation/emissionsCandidate";
import { conditionalCompanyApiSurfaces, conditionalCompanyWorkbookSurface,
  conditionalCompanyFieldSpecs, conditionalCompanySemantics } from "../shared/companyConditionalSemantics";
import { warmingReferenceFieldSpecs, warmingValidationReferenceSemantics,
  warmingReferenceExportDocument, warmingReferenceExportLeafBindings } from "../shared/warmingValidationReferenceSemantics";
import { WARMING_VALIDATION_REFERENCE } from "../shared/warmingValidationReference";
const relativeSource=(path:string)=>relative(process.cwd(),resolve(path)).split("\\").join("/");
const config=ts.readConfigFile("tsconfig.json",ts.sys.readFile);
const parsed=ts.parseJsonConfigFileContent(config.config,ts.sys,".");
const baseline=process.argv.find(x=>x.startsWith("--baseline="))?.split("=")[1];
const host=ts.createCompilerHost(parsed.options),read=host.readFile.bind(host);
if(baseline) {
  if(!/^[a-f0-9]{7,40}$/.test(baseline)) throw new Error("Explicit baseline Git revision required");
  const changed=execFileSync("git",["diff","--name-only",baseline],{encoding:"utf8"}).trim().split("\n").filter(p=>/\.(ts|tsx)$/.test(p));
  const sources=new Map(changed.flatMap(path=>{
    const result=spawnSync("git",["show",`${baseline}:${path}`],{encoding:"utf8"});
    return result.status===0?[[path,result.stdout] as const]:[];
  }));
  host.readFile=path=>sources.get(path.replace(`${process.cwd()}/`,"").replace(/^\.\//,"")) ?? read(path);
}
const program=ts.createProgram(parsed.fileNames,parsed.options,host),checker=program.getTypeChecker();
type Entry={surface:string;field:string;type:string;source:string;line:number;resolution:string};
const entries:Entry[]=[];
const supplementalTypedApiEntries:Entry[]=[];
const warmingReferenceApiSurface='API GET "/api/reference/warming-validation"';
const warmingReferenceExportSurface='API GET "/api/reference/warming-validation/export.json"';
const warmingExportLeafBindings=warmingReferenceExportLeafBindings();
const warmingApiLeafBindings=new Map<string,{id:string;transform:string}>();
const displayBindings: {source:string;line:number;id:string;expression:string;bound:boolean}[]=[];
const exportBindingMetadata: {source:string;line:number;rows:string;bindings:string;coverage:string}[]=[];
const verifiedExportBindings: {surface:string;field:string;id:string;transform:string}[]=[];
const certifiedFiniteExports:{surface:string;source:string;family:FiniteExportFamily;rowsExpression:string;settingsExpression:string;domainCases:{settings:object;columns:Record<string,{id:string;transform:string}>;cellDomains:object}[]}[]=[];
const supplementalWorkbookInventory:{source:string;line:number;sheet:string;rowExpression:string;literalLabels:string[];coverage:string}[]=[];
const workbookBuilderInventory:{source:string;line:number;builder:string;sheetExpression:string;coverage:string}[]=[];
const displayExpressionInventory:{source:string;line:number;expression:string;explicitSemanticAncestor:boolean}[]=[];
const chainedResponseInventory:{surface:string;source:string;line:number;expression:string;topLevelKeys:string[];coverage:string}[]=[];
// Broader inventories do not grant semantic closure: a source expression is not
// a runtime column domain, and an ancestor annotation is not proof of every child.
const inventorySources=new Map(program.getSourceFiles().filter(s=>!s.isDeclarationFile).map(s=>[relativeSource(s.fileName),s]));
for(const path of ts.sys.readDirectory("script",[".ts",".tsx"],undefined,["**/*"]))
  if(!inventorySources.has(relativeSource(path))) inventorySources.set(relativeSource(path),
    ts.createSourceFile(path,readFileSync(path,"utf8"),ts.ScriptTarget.Latest,true));
for(const source of Array.from(inventorySources.values()).filter(s=>
  /^(client\/src\/|server\/|script\/)/.test(relativeSource(s.fileName)))) {
  const inventory=(node:ts.Node,annotated=false):void=>{
    if(ts.isJsxElement(node)) annotated=annotated || node.openingElement.attributes.properties.some(p=>
      ts.isJsxAttribute(p)&&p.name.getText(source)==="data-field-id");
    if(ts.isJsxExpression(node)&&node.expression&&ts.isJsxElement(node.parent))
      displayExpressionInventory.push({source:relativeSource(source.fileName),
        line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,
        expression:node.expression.getText(source),explicitSemanticAncestor:annotated});
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
      ["book_append_sheet","addWorksheet"].includes(node.expression.name.text))
      workbookBuilderInventory.push({source:relativeSource(source.fileName),
        line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,
        builder:node.expression.getText(source),
        sheetExpression:node.arguments[node.expression.name.text==="book_append_sheet"?2:0]?.getText(source)??"UNRESOLVED",
        coverage:"Source-level builder inventory only; conditional/loop sheet names, serialized JSON payloads, metadata sheets and test fixtures require separate runtime domain/readback verification; no original slot closure"});
    ts.forEachChild(node,child=>inventory(child,annotated));
  };
  inventory(source);
}
// Custom workbook builders are inventoried separately from the frozen original
// API/DownloadDataButton cohort. Inventory alone never grants semantic closure.
for(const source of program.getSourceFiles().filter(s=>!s.isDeclarationFile &&
  relativeSource(s.fileName)==="server/calculation/companyProjectionReplay.ts")) {
  function inventory(node:ts.Node) {
    if(ts.isVariableDeclaration(node)&&node.name.getText(source)==="tables"&&node.initializer&&ts.isObjectLiteralExpression(node.initializer))
      for(const property of node.initializer.properties) {
        if(!ts.isPropertyAssignment(property)) continue;
        const literalLabels:string[]=[];
        if(ts.isArrayLiteralExpression(property.initializer)) for(const row of property.initializer.elements) {
          if(ts.isArrayLiteralExpression(row)&&row.elements[0]&&ts.isStringLiteral(row.elements[0]))
            literalLabels.push(row.elements[0].text);
        }
        supplementalWorkbookInventory.push({source:relativeSource(source.fileName),
          line:source.getLineAndCharacterOfPosition(property.getStart()).line+1,
          sheet:property.name.getText(source),rowExpression:property.initializer.getText(source),literalLabels,
          coverage:property.name.getText(source)==="Ledger"
            ? "Ledger has separate exact 22-column semantic bindings; not counted again here"
            : "Custom sheet structure inventory only; no original-slot closure or denominator change. Identity metadata is not scientific acceptance; FullResult contains chunked canonical JSON, not additional scalar field coverage"});
      }
    ts.forEachChild(node,inventory);
  }
  inventory(source);
}
if(!baseline) {
  const {companyReplayLedgerColumns}=await import("../shared/companyReplaySemantics");
  for(const column of companyReplayLedgerColumns) entries.push({surface:"XLSX server/calculation/companyProjectionReplay.ts:Ledger",
    field:`[].${column}`,type:"string | number | null",source:"server/calculation/companyProjectionReplay.ts",line:1,resolution:"typed-field"});
}
const resolvedResponseAliases: {surface:string;source:string;line:number;expression:string;replacement:string}[]=[];
function fields(type:ts.Type,path:string,surface:string,node:ts.Node,depth=0) {
  const source=node.getSourceFile(),where={source:relativeSource(source.fileName),line:source.getLineAndCharacterOfPosition(node.getStart()).line+1};
  if(type.isUnion()) {for(const t of type.types) if(!(t.flags&(ts.TypeFlags.Null|ts.TypeFlags.Undefined))) fields(t,path,surface,node,depth);return;}
  if(type.flags&(ts.TypeFlags.Any|ts.TypeFlags.Unknown) || depth>8) {
    entries.push({surface,field:path||"$",type:checker.typeToString(type),...where,resolution:"unresolved-type"});return;
  }
  if(type.flags&(ts.TypeFlags.StringLike|ts.TypeFlags.NumberLike|ts.TypeFlags.BooleanLike|ts.TypeFlags.Null|ts.TypeFlags.Undefined) ||
    type.getSymbol()?.name==="Date") {
    entries.push({surface,field:path||"$",type:checker.typeToString(type),...where,resolution:"typed-field"});return;
  }
  const element=checker.getIndexTypeOfType(type,ts.IndexKind.Number);
  if(element) {fields(element,`${path}[]`,surface,node,depth+1);return;}
  const dynamic=checker.getIndexTypeOfType(type,ts.IndexKind.String);
  if(dynamic) entries.push({surface,field:`${path}.*`,type:checker.typeToString(dynamic),...where,resolution:"dynamic-key-needs-explicit-binding"});
  for(const property of type.getProperties()) {
    const declaration=property.valueDeclaration ?? property.declarations?.[0] ?? node;
    fields(checker.getTypeOfSymbolAtLocation(property,declaration),path?`${path}.${property.name}`:property.name,surface,node,depth+1);
  }
}
for(const source of program.getSourceFiles().filter(s=>!s.isDeclarationFile && /(?:server\/routes|client\/src\/)/.test(s.fileName))) {
  function visit(node:ts.Node,surface="") {
    if(!baseline && ts.isJsxElement(node)) {
      const attribute=node.openingElement.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="data-field-id");
      if(attribute&&ts.isJsxAttribute(attribute)&&attribute.initializer&&ts.isStringLiteral(attribute.initializer)) {
        const id=attribute.initializer.text;
        const bound=outputFieldSemantics.some(f=>f.id===id);
        if(!bound) throw new Error(`Unmapped display semantic: ${id}`);
        displayBindings.push({source:relativeSource(source.fileName),line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,
          id,expression:node.children.map(child=>child.getText(source)).join(""),bound});
      }
    }
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
      node.expression.expression.getText(source)==="app"&&["get","post","put","patch","delete"].includes(node.expression.name.text))
      surface=`API ${node.expression.name.text.toUpperCase()} ${node.arguments[0]?.getText(source)}`;
    if(surface&&ts.isCallExpression(node)&&node.expression.getText(source)==="res.json"&&node.arguments[0]) {
      if (!baseline && surface === 'API GET "/api/calculation/company-coverage"' &&
        node.arguments[0].getText(source) === "result") {
        // Object.fromEntries has a broad TS index signature, but this NEW finite
        // contract has exact production semantic IDs and primitive-domain/export
        // readback tests. Keep it supplemental; do not expand the original cohort.
        supplementalTypedApiEntries.push(...companyCoverageSemantics.map(f => ({
          surface, field: f.id.replace(/^companyCoverage\./, ""), type: f.unit,
          source: relativeSource(source.fileName), line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          resolution: "exact-qualified-production-contract",
        })));
      } else fields(checker.getTypeAtLocation(node.arguments[0]),"",surface,node);
      const expression=node.arguments[0].getText(source);
      if(!baseline&&["projectionResultCache","categoryCacheResult","historicalTrendCacheResult","categoryHistoricalTrendCache"].includes(expression)){
        const type=checker.getTypeAtLocation(node.arguments[0]);
        if(type.flags&(ts.TypeFlags.Any|ts.TypeFlags.Unknown)) throw new Error("Cache response alias regressed to unknown");
        resolvedResponseAliases.push({surface,source:relativeSource(source.fileName),
          line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,expression,
          replacement:"Typed cached response expands to the same qualified leaves as fresh response; former $ placeholder retained in reconciliation, not silently discarded"});
      }
    }
    if(surface&&ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&
      node.expression.name.text==="json"&&node.expression.getText(source).startsWith("res.")&&
      node.expression.getText(source)!=="res.json"&&node.arguments[0]) {
      chainedResponseInventory.push({surface,source:relativeSource(source.fileName),
        line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,
        expression:node.arguments[0].getText(source),
        topLevelKeys:checker.getTypeAtLocation(node.arguments[0]).getProperties().map(p=>p.name).sort(),
        coverage:"Supplemental chained res.set/status(...).json(...) branch inventory only. Not part of frozen original direct-res.json cohort; no original closure credit. Error branches and success branches require separate qualified leaf review."});
    }
    if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(source)==="DownloadDataButton") {
      const prop=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="rows");
      if(prop&&ts.isJsxAttribute(prop)&&prop.initializer&&ts.isJsxExpression(prop.initializer)&&prop.initializer.expression) {
        let type=checker.getTypeAtLocation(prop.initializer.expression);
        const signature=type.getCallSignatures()[0];if(signature) type=checker.getReturnTypeOfSignature(signature);
        const line=source.getLineAndCharacterOfPosition(node.getStart()).line+1;
        const exportSurface=`XLSX ${relativeSource(source.fileName)}:${line}`;
        if(!baseline) {
          const binding=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="fieldBindings");
          exportBindingMetadata.push({source:relativeSource(source.fileName),line,
            rows:prop.initializer.expression.getText(source),
            bindings:binding&&ts.isJsxAttribute(binding)?binding.initializer?.getText(source)??"MISSING":"MISSING",
            coverage:"Binding expression inventory only; conditional/dynamic columns are NOT counted as bound without exact schema reconciliation"});
           const importsFiniteSchema=source.statements.some(statement=>ts.isImportDeclaration(statement)&&
             ts.isStringLiteral(statement.moduleSpecifier)&&statement.moduleSpecifier.text==="@shared/finiteExportSchemas"&&
             statement.importClause?.namedBindings&&ts.isNamedImports(statement.importClause.namedBindings)&&
             ["certifyFiniteExport","finiteExportBindings"].every(name=>statement.importClause!.namedBindings&&
               ts.isNamedImports(statement.importClause!.namedBindings)&&statement.importClause!.namedBindings.elements.some(e=>e.name.text===name)));
           const rowSymbol=checker.getSymbolAtLocation(prop.initializer.expression);
           const declaration=rowSymbol?.valueDeclaration;
           const initializer=declaration&&ts.isVariableDeclaration(declaration)?declaration.initializer:undefined;
           const bindingExpression=binding&&ts.isJsxAttribute(binding)&&binding.initializer&&ts.isJsxExpression(binding.initializer)?
             binding.initializer.expression:undefined;
           const finiteSources:Record<string,string>={
             categoryTrend:"client/src/components/category-trend-chart.tsx",
             indicatorCards:"client/src/components/indicator-cards.tsx",
             valuationPE:"client/src/pages/climate-valuation.tsx",
             indicatorDetail:"client/src/pages/data-management.tsx",
             groupGap:"client/src/pages/decarb-gap-signal.tsx",
             signalCumulative:"client/src/pages/decarb-signal.tsx",
           };
           if(importsFiniteSchema&&initializer&&ts.isCallExpression(initializer)&&
             initializer.expression.getText(source)==="certifyFiniteExport"&&initializer.arguments.length===3&&
             ts.isStringLiteral(initializer.arguments[0])&&bindingExpression&&ts.isCallExpression(bindingExpression)&&
             bindingExpression.expression.getText(source)==="finiteExportBindings"&&bindingExpression.arguments.length===2&&
             ts.isStringLiteral(bindingExpression.arguments[0])) {
             const family=initializer.arguments[0].text as FiniteExportFamily;
             const settingsExpression=initializer.arguments[2].getText(source);
             if(finiteSources[family]!==relativeSource(source.fileName)||
               bindingExpression.arguments[0].text!==family||
               settingsExpression.replace(/\s+/g,"")!==bindingExpression.arguments[1].getText(source).replace(/\s+/g,""))
               throw new Error(`Finite export rows/bindings/settings mismatch: ${exportSurface}`);
             const domainCases=finiteExportDomainCases().filter(c=>c.family===family).map(c=>({
               settings:c.settings,columns:finiteExportBindings(c.family,c.settings),
               cellDomains:finiteExportCellDomains(c.family,c.settings),
             }));
             if(!domainCases.length) throw new Error(`Empty finite export domain: ${family}`);
             certifiedFiniteExports.push({surface:exportSurface,source:relativeSource(source.fileName),family,
               rowsExpression:initializer.arguments[1].getText(source),settingsExpression,domainCases});
           }
          // Reconcile literal column bindings against the actual typed row fields,
          // not merely against a similarly named semantic. Conditional objects,
          // spreads and computed keys remain explicitly unverified here.
          if(binding && ts.isJsxAttribute(binding) && binding.initializer &&
            ts.isJsxExpression(binding.initializer) && binding.initializer.expression &&
            ts.isObjectLiteralExpression(binding.initializer.expression)) {
            const object=binding.initializer.expression;
             const literalProperties=(value:ts.Expression):ts.PropertyAssignment[]|null=>{
               if(ts.isParenthesizedExpression(value)) return literalProperties(value.expression);
               if(ts.isConditionalExpression(value)) {
                 const a=literalProperties(value.whenTrue),b=literalProperties(value.whenFalse);
                 return a&&b?[...a,...b]:null;
               }
               if(!ts.isObjectLiteralExpression(value)) return null;
               const properties:ts.PropertyAssignment[]=[];
               for(const p of value.properties) {
                 if(ts.isSpreadAssignment(p)) {
                   const nested=literalProperties(p.expression);
                   if(!nested) return null;
                   properties.push(...nested);
                 } else if(ts.isPropertyAssignment(p)) properties.push(p);
                 else return null;
               }
               return properties;
             };
             const properties=literalProperties(object);
             // Reject duplicate keys, including possible conditional-spread
             // overwrites. Computed keys remain unverified, never wildcard proof.
              const literalColumnName=(name:ts.PropertyName):string|null=>{
                if(ts.isComputedPropertyName(name)) {
                  const type=checker.getTypeAtLocation(name.expression);
                  return type.isStringLiteral()?type.value:null;
                }
                return ts.isStringLiteral(name)?name.text:name.getText(source);
              };
              const names=properties?.map(p=>literalColumnName(p.name));
             if(properties && new Set(names).size===names?.length) for(const property of properties) {
               if(!ts.isPropertyAssignment(property) ||
                !ts.isObjectLiteralExpression(property.initializer)) continue;
               const name=literalColumnName(property.name);
               if(name===null) continue;
              const values=new Map(property.initializer.properties.flatMap(p=>
                ts.isPropertyAssignment(p)&&ts.isIdentifier(p.name)&&ts.isStringLiteral(p.initializer)
                  ? [[p.name.text,p.initializer.text] as const]:[]));
              const id=values.get("id"),transform=values.get("transform");
              if(id && transform && outputFieldSemantics.some(f=>f.id===id))
                verifiedExportBindings.push({surface:exportSurface,field:`[].${name}`,id,transform});
            }
          }
          if(relativeSource(source.fileName)==="client/src/components/threshold-diagnostic-details.tsx" &&
            prop.initializer.expression.getText(source)==="diagnostics.map((d, i) => thresholdExportRow(d, contextLabels?.[i] ?? null))" &&
            node.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="fieldBindings"&&
              p.initializer?.getText(source)==="{thresholdExportBindings}"))
            for(const [column,binding] of Object.entries(thresholdExportBindings))
              verifiedExportBindings.push({surface:exportSurface,field:`[].${column}`,...binding});
          if(relativeSource(source.fileName)==="client/src/components/emissions-candidate-review.tsx" &&
            prop.initializer.expression.getText(source)==="nativeThresholdExportRows(data.residualDiagnostics.records)" &&
            node.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="fieldBindings"&&
              p.initializer?.getText(source)==="{nativeThresholdExportBindings}")) {
            // Verify actual builder keys/bindings against captured real inventory;
            // only2024 is evaluated, not a study or forecast rerun.
            const rows=nativeThresholdExportRows(nativeCandidateResidualDiagnostics(
              projectNativeEmissions(constantScenario,2024)).records);
            bindExportColumns(rows,nativeThresholdExportBindings);
            for(const [column,binding] of Object.entries(nativeThresholdExportBindings))
              verifiedExportBindings.push({surface:exportSurface,field:`[].${column}`,...binding});
          }
        }
        // Explicit schema consumed by both the actual row builder and bindings.
        // Do not infer arbitrary Object.fromEntries keys as covered.
        if(!baseline && relativeSource(source.fileName)==="client/src/components/emissions-candidate-review.tsx"
          && prop.initializer.expression.getText(source)==="data.result.trajectory.map(nativeExportRow)"
          && node.attributes.properties.some(p=>ts.isJsxAttribute(p)&&p.name.getText(source)==="fieldBindings"&&p.initializer?.getText(source)==="{nativeExportBindings}"))
          for(const column of nativeExportColumns) entries.push({surface:exportSurface,field:`[].${column.column}`,type:"number | null",source:relativeSource(source.fileName),line,resolution:"typed-field"});
        else fields(type,"",exportSurface,node);
      }
    }
    ts.forEachChild(node,child=>visit(child,surface));
  }
  visit(source);
}
// External route handler's actual typed send arguments are supplemental API
// inventory, never additions to the frozen original direct-res.json cohort.
if(!baseline) {
  const source=program.getSourceFiles().find(s=>relativeSource(s.fileName)==="server/warmingValidationReferenceApi.ts");
  if(!source) throw new Error("Missing registered warming reference handler");
  const handler=source.text;
  if(!handler.includes("res.json(WARMING_VALIDATION_REFERENCE)") ||
    !handler.includes(".json(warmingReferenceExportDocument())"))
    throw new Error("Warming reference send contract changed");
  const index=readFileSync("server/index.ts","utf8");
  if(index.indexOf("app.use(releaseSafety())")<0 ||
    index.indexOf("registerWarmingValidationReferenceRoutes(app)")<index.indexOf("app.use(releaseSafety())"))
    throw new Error("Reference handler must be registered after releaseSafety");
  const add=(surface:string,field:string,value:unknown,binding:{id:string;transform:string},resolution:string)=>{
    if(!warmingValidationReferenceSemantics.some(s=>s.id===binding.id))
      throw new Error(`Unmapped warming API leaf ${binding.id}`);
    warmingApiLeafBindings.set(`${surface}|${field}`,binding);
    supplementalTypedApiEntries.push({surface,field,type:value===null?"null":typeof value,
      source:"server/warmingValidationReferenceApi.ts",line:1,resolution});
  };
  const valueAt=(root:unknown,path:string)=>path.split(".").reduce<unknown>((v,key)=>(v as Record<string,unknown>)[key],root);
  for(const [field] of warmingReferenceFieldSpecs)
    add(warmingReferenceApiSurface,field,valueAt(WARMING_VALIDATION_REFERENCE,field),
      {id:`warmingReference.${field}`,transform:"Identity; shared immutable reference"},
      "exact-qualified-shared-reference-contract");
  for(const [field,binding] of Object.entries(warmingExportLeafBindings))
    add(warmingReferenceExportSurface,field,valueAt(warmingReferenceExportDocument(),field),binding,"exact-qualified-finite-json-serialization-contract");
  for(const surface of [warmingReferenceApiSurface,warmingReferenceExportSurface])
    add(surface,"error","The dated validation reference accepts no overrides.",{id:"warmingReference.qualification",
      transform:"HTTP400 control message: all query overrides refused; does not modify reference or grant model acceptance"},
      "exact-qualified-query-refusal-contract");
}
if(!baseline) {
  const source=program.getSourceFiles().find(s=>relativeSource(s.fileName)==="server/companyConditionalApi.ts");
  if(!source) throw new Error("Missing registered conditional company handler");
  let successBindings=0;
  const visit=(node:ts.Node):void=>{
    if(ts.isCallExpression(node)&&node.expression.getText(source)==="res.json"&&
      node.arguments[0]?.getText(source)==="summary") {
      successBindings++;
      for(const surface of conditionalCompanyApiSurfaces) {
        const start=entries.length;
        fields(checker.getTypeAtLocation(node.arguments[0]),"",surface,node);
        supplementalTypedApiEntries.push(...entries.splice(start));
      }
    }
    ts.forEachChild(node,visit);
  };
  visit(source);
  if(successBindings!==1) throw new Error("Conditional summary success response contract changed");
  for(const surface of [...conditionalCompanyApiSurfaces,conditionalCompanyWorkbookSurface])
    supplementalTypedApiEntries.push({surface,field:"error",type:"string",source:"server/companyConditionalApi.ts",
      line:source.getLineAndCharacterOfPosition(source.text.indexOf('function readIssuer')).line+1,
      resolution:"exact-qualified-query-refusal-contract"});
}
if(!baseline) for(const source of program.getSourceFiles().filter(s=>
  relativeSource(s.fileName)==="server/calculation/originalNominalAssessmentHandler.ts")) {
  const visit=(node:ts.Node):void=>{
    if(ts.isCallExpression(node)&&node.expression.getText(source)==="send"&&node.arguments[1]) {
      const start=entries.length;
      fields(checker.getTypeAtLocation(node.arguments[1]),"",
        'API GET "/api/valuation/original-nominal-assessment"',node);
      supplementalTypedApiEntries.push(...entries.splice(start));
    }
    ts.forEachChild(node,visit);
  };
  visit(source);
}
for(const entry of entries) if(entry.surface.includes("/api/cv/") &&
  entry.field.replace(/\[\]/g,"").split(".").some(part=>part &&
    Object.keys(publicValuationResult({[part]:true},entry.surface.includes("/decarb-gap")) as object).length===0))
  entry.resolution="withheld-public-field";
const unique=Array.from(new Map(entries.map(e=>[`${e.surface}|${e.field}`,e])).values())
  .sort((a,b)=>a.surface.localeCompare(b.surface)||a.field.localeCompare(b.field)||a.type.localeCompare(b.type));
const nativeDynamicDomains={
  "result.trajectory[].nativeMt.*":outputFieldSemantics.filter(f=>f.id.startsWith("native.result.trajectory[].nativeMt.")).map(f=>f.id),
  "result.trajectory[].sectorsGtCO2e.*":outputFieldSemantics.filter(f=>f.id.startsWith("native.result.trajectory[].sectorsGtCO2e.")).map(f=>f.id),
};
const isBound=(e:typeof unique[number])=>
  // Raw historical JSON stays on the wire. Known producer/container metadata is
  // not exhaustive historical leaf coverage and cannot close this original slot.
  !(e.surface==='API GET "/api/data/runs"'&&e.field==="runs[].summary")&&(
   // Exact typed SIDE-CAR map domain only. Never bind the adjacent raw summary.
   (e.surface==='API GET "/api/data/runs"'&&e.field==="summaryEvidence.*"&&
     fetchSummarySemantics.every(f=>outputFieldSemantics.some(registered=>registered.id===f.id))) ||
  certifiedFiniteExports.some(schema=>schema.surface===e.surface&&(
    e.field==="[].*" || (e.field.startsWith("[].") &&
      schema.domainCases.every(c=>Object.hasOwn(c.columns,e.field.slice(3)))))) ||
  (e.surface==='API POST "/api/emissions/validate-native-pathways"' &&
    (nativePathwayDynamicSlots.includes(e.field) || outputFieldSemantics.some(f=>f.id===`nativePathway.${e.field}`))) ||
  remainingApiBindings.some(([surface,prefix])=>e.surface===surface &&
    outputFieldSemantics.some(f=>f.id===`${prefix}.${e.field.replace(/^\[\]\./,"")}`)) ||
 ([
  ...diagnosticMetadataBindings.map(({surface,prefix})=>[surface,prefix]),
  ...evidenceApiBindings.map(({surface,prefix})=>[surface,prefix]),
  ['API GET "/api/news/climate"', "news"],
  ['API GET "/api/data/indicators"', "indicatorInventory"],
  ['API GET "/api/data/indicator/:key"', "indicatorDetail"],
  ['API GET "/api/cv/upload/:id/status"', "upload"],
  ['API GET "/api/research/driver-registry"', "driverRegistry"],
  ['API GET "/api/reference-scenarios"', "publishedReference"],
  ['API GET "/api/cv/summary"', "companySummary"],
  ['API GET "/api/cv/dimensions"', "companyDimensions"],
  ['API GET "/api/cv/backtest"', "backtest"],
  ['API GET "/api/cv/decarb-gap/summary"', "peerValuation"],
 ].some(([surface,prefix])=>e.surface===surface && outputFieldSemantics.some(f=>f.id===`${prefix}.${e.field}`))) ||
   (e.surface==='API GET "/api/cv/uploads"' && outputFieldSemantics.some(f=>f.id===`upload.${e.field.replace(/^\[\]\./,"")}`)) ||
   verifiedExportBindings.some(b=>b.surface===e.surface&&b.field===e.field&&e.resolution==="typed-field") ||
   (e.surface==="XLSX server/calculation/companyProjectionReplay.ts:Ledger" &&
  outputFieldSemantics.some(f=>f.id===`companyReplay.ledger.${e.field.replace(/^\[\]\./,"")}`)) || (e.surface.startsWith("XLSX client/src/components/emissions-candidate-review.tsx:") &&
  nativeExportColumns.some(c=>e.field===`[].${c.column}`)) || (e.surface.includes('"/api/emissions/candidate"') &&
  Object.hasOwn(nativeDynamicDomains,e.field)) || (e.surface.includes('"/api/emissions/candidate"') &&
  outputFieldSemantics.some(f=>f.id===`native.${e.field}`)) ||
  (e.surface==='API POST "/api/emissions/regional-residual-diagnostics"' &&
    outputFieldSemantics.some(f=>f.id===`native.${e.field}`)) || (e.surface.includes('"/api/projection"') &&
      outputFieldSemantics.some(f=>f.id===`projection.${e.field}`)) || (e.field.startsWith("[].") &&
    [["/api/cv/decarb-gap/timeseries","peerValuationHistory"],["/api/cv/sdg-growth","sdg"],["/api/cv/pe-comparison","pe"],["/api/indicators/historical","indicator"],["/api/projection/regions","regional"],["/api/projection/sensitivity","sensitivity"],["/api/projection/categories","category"],["/api/projection/historical-trend","historical"],["/api/projection/categories/historical-trend","categoryHistory"],["/api/calculation/company-operating/reviews","companyReview"]].some(([path,prefix])=>
      e.surface.includes(`"${path}"`) && outputFieldSemantics.some(f=>f.id===`${prefix}.${e.field.slice(3)}`))) ||
      (e.surface==='API GET "/api/cv/backtest"' && e.field.startsWith("[].") &&
         outputFieldSemantics.some(f=>f.id===`backtest.${e.field.slice(3)}`)));
const report={version:"typed-field-census-1",definitions:baseline?16:fieldSemantics.length+outputFieldSemantics.length,
  resolvedResponseAliases,
  comparableSlotAccounting:{actualUniqueSlots:unique.length,previouslyUnresolvedAliasSlots:resolvedResponseAliases.length,
    slotsIncludingReconciledAliases:unique.length+resolvedResponseAliases.length},
  fullyBoundFields:baseline?0:unique.filter(isBound).length,
  displayBindings,
  exportBindingMetadata,
  supplementalWorkbookInventory,
  workbookBuilderInventory,
  displayExpressionInventory,
  chainedResponseInventory,
  verifiedExportBindings:verifiedExportBindings.filter(b=>unique.some(e=>e.surface===b.surface&&e.field===b.field&&e.resolution==="typed-field")),
  certifiedFiniteExports,
  supplementalConcreteExportChanges:{
    indicatorCardColumns:"Now all22 registered indicator keys plus Year/Estimated; eight newly concrete columns versus14 previously configured cards (including two growth-rate columns) are supplemental changes, not extra original closure slots. Header native units come from qualified indicator definitions, not card display scaling.",
    originalSlotAccounting:"One original dynamic schema-boundary slot remains one slot. Every admitted column has a qualified ID and precise transformation; non-domain keys or row/schema disagreement fail runtime export. Concrete domain cases above are separate inventory, not added to original denominator.",
    persistedSummary:"/api/data/runs returns each original summary JSON VALUE unchanged, including all unknown historical values. Known producer container/leaf metadata is supplemental; the original opaque summary slot remains unresolved and is not completion credit.",
  },
  supplementalSummaryProducerDefinitions:outputFieldSemantics.filter(f=>f.id.startsWith("fetchSummaryProducer.")),
  supplementalQualifiedChanges:{
    warmingValidationReference:{
      definitions:warmingValidationReferenceSemantics.length,ids:warmingValidationReferenceSemantics.map(s=>s.id),
      api:{surface:warmingReferenceApiSurface,successLeaves:warmingReferenceFieldSpecs.length},
      jsonExport:{surface:warmingReferenceExportSurface,source:"shared/warmingValidationReferenceSemantics.ts",
        primitiveSerializationLeaves:Object.keys(warmingExportLeafBindings).length,
        referenceLeaves:warmingReferenceFieldSpecs.length,rowCount:warmingReferenceExportDocument().rows.length,
        columnsPerRow:Object.keys(warmingReferenceExportDocument().columnBindings).length,
        leafBindings:warmingExportLeafBindings,
        metadataQualification:"Binding and field-definition metadata is inventoried as serialization, never additional measured values or scientific definitions"},
      queryRefusalSurfaces:[warmingReferenceApiSurface,warmingReferenceExportSurface],
      typedApiFields:supplementalTypedApiEntries.filter(e=>e.surface.startsWith('API GET "/api/reference/warming-validation'))
        .map(e=>({...e,...warmingApiLeafBindings.get(`${e.surface}|${e.field}`),
          bound:outputFieldSemantics.some(s=>s.id===warmingApiLeafBindings.get(`${e.surface}|${e.field}`)?.id)})),
      display:{source:"client/src/pages/methodology.tsx",component:"WarmingValidationReference",
        ids:["headline2025.valueC","decade.meanC","decade.p05C","decade.p95C","inventory.year"].map(p=>`warmingReference.${p}`)},
      boundary:"38 new reference definitions; exact finite GET/JSON/display/export contracts only. Literal1.37 is2025 SR1.5 trend endpoint, not ordinary annual mean1.38, calculation input, offset or model acceptance. No original1001 closure credit.",
    },
    nativeResidualDiagnostics:{
      definitions:nativeThresholdSemantics.length,ids:nativeThresholdSemantics.map(f=>f.id),
      originalNativeApiFields:187,originalNativeWorkbookColumns:35,
      addedCandidateApiFields:unique.filter(e=>e.surface==='API GET "/api/emissions/candidate"'&&e.field.startsWith("residualDiagnostics.")).length,
      addedRegionalSubmittedInputApiFields:unique.filter(e=>e.surface==='API POST "/api/emissions/regional-residual-diagnostics"').length,
      separateNativeDiagnosticWorkbookColumns:Object.keys(nativeThresholdExportBindings).length,
      qualification:"Captured source-derived global2024 inventory; explicit supplied regional MODEL inputs only. No regional2024 land-use allocation fabricated; existing engine/results/archives unchanged. Not source revalidation, calibration, publication-vintage proof or physical net zero.",
      boundary:"All new typed API/export quantities are supplemental; none closes or reduces the original1001 cohort.",
    },
    thresholdDiagnostic:{definitions:thresholdDiagnosticSemantics.length,ids:thresholdDiagnosticSemantics.map(f=>f.id),
      boundary:"246 standalone/nested diagnostic and separately versioned fixed5Gt definitions. New5%-of2024 leaves never replace old fixed5Gt quantities in the frozen cohort."},
    summarySidecar:{definitions:fetchSummarySemantics.length,ids:fetchSummarySemantics.map(f=>f.id),
      typedMapDomain:{surface:'API GET "/api/data/runs"',field:"summaryEvidence.*",
        keys:"Existing fetch-run IDs",value:"FetchSummaryEvidence discriminated union; verified manifests are strict parsed/content-authenticated; unverified has null manifest and explicit reason",
        enforcement:"summaryArchive.loadFetchSummaryEvidence + bindFetchSummaryEvidence on each map value; fetch-summary-provenance tests"},
      boundary:"Run-ID-keyed authenticated sidecar has its own typed contract; all unknown/legacy raw runs[].summary JSON remains opaque and unclosed."},
    metadataSheets:{definitions:supplementalSheetSemantics.length,
      sheets:Object.fromEntries((["Field semantics","Column bindings"] as const).map(sheet=>[sheet,supplementalSheetBindings(sheet)])),
      boundary:"31 exact supplemental metadata-sheet column bindings, runtime-certified and XLSX-readback tested; no original cohort closure credit."},
    companyAbatement:{definitions:companyAbatementSemantics.length,ids:companyAbatementSemantics.map(f=>f.id),
      boundary:"43 additive qualified definitions; conditional physical ledger, no observation/scientific/financial validation or original closure credit."},
    companyCoverage:{
      definitions:companyCoverageSemantics.length,ids:companyCoverageSemantics.map(f=>f.id),
      api:{surface:'API GET "/api/calculation/company-coverage"',source:"server/routes.ts",
        fields:companyCoverageSemantics.map(f=>({field:f.id.replace(/^companyCoverage\./,""),id:f.id,bound:outputFieldSemantics.some(s=>s.id===f.id)}))},
      display:{source:"client/src/components/company-coverage.tsx",
        bindings:companyCoverageSemantics.filter(f=>
          ["sourceId","observationDate","informationCutoff","eligibilityRule","eligibilityConflicts","eligibleCompanyShare","limitations[]","scientificAcceptance"].includes(f.id.replace(/^companyCoverage\./,"")) ||
          /\.denominator$|\.mapping\..*\.(count|share)$|\.eligibleKnownValueCoverage\.|\.availableShare$|\.states\.(null|missing|conflicted|invalid)$|\.shareOfKnownValue$/.test(f.id))
          .map(f=>({id:f.id,bound:outputFieldSemantics.some(s=>s.id===f.id)})),
        limitation:"Exact finite data-field-id template domains; numeric formatting is descriptive, not calibration. Generic display controls/containers are not extra semantic leaves."},
      jsonExport:{source:"client/src/components/company-coverage.tsx",writer:"DownloadJsonButton -> central download-data-button.tsx -> prepareQualifiedJsonExport",
        filename:"company-coverage-${observationDate}.json",ids:companyCoverageSemantics.map(f=>f.id),
        payloadPath:"data",evidenceContract:"coverage",
        validation:"Strict complete company-coverage-1 schema; exact primitive semantic IDs; active selected source match; reject active overlays; observation<=cutoff",
        envelopeMetadata:{interpretation:"Existing exportNotes evidence rows: Field/Value; exportedAt is not observation time",
          dataIdentity:{algorithm:"SHA-256",hash:"hex SHA-256 of UTF-8 JSON.stringify(data,null,2)",serialization:"No normalization, sorting, flattening or null substitution"}},
        verification:"company-coverage.test.ts and export-contract.test.ts lossless JSON readback, exact primitive semantic domain, metadata inclusion and identity verification; preserves null/zero/all states, both denominators, source/cutoff/units/limitations"},
      boundary:"NEW complete finite API/display/JSON-export contract inventoried separately. No original1001 closure credit, no original denominator change; known-value coverage is not an estimate of missing values.",
    },
    gordonBaseline:{definitions:gordonBaselineSemantics.length,ids:gordonBaselineSemantics.map(f=>f.id),
      boundary:"Six additive cost-of-equity metadata leaves; no physical decarbonisation interpretation or original cohort closure credit."},
    originalNominalAssessment:{definitions:originalNominalAssessmentSemantics.length,
      ids:originalNominalAssessmentSemantics.map(f=>f.id),
      omittedUndefinedBranchProperties:Array.from(new Set(supplementalTypedApiEntries.filter(e=>e.surface.includes("original-nominal-assessment")&&e.type==="undefined").map(e=>e.field))),
      typedApiFields:Array.from(new Map(supplementalTypedApiEntries.filter(e=>e.surface.includes("original-nominal-assessment")&&e.type!=="undefined").map(e=>[e.field,e])).values()).map(e=>({
        ...e,bound:outputFieldSemantics.some(f=>f.id===`originalNominalAssessment.${e.field}`)})),
      boundary:"New read-only explicitly conditional endpoint; typed send-argument domain and input/HTTP metadata inventoried separately, never original cohort closure credit."},
    conditionalCompany:{definitions:conditionalCompanySemantics.length,ids:conditionalCompanySemantics.map(f=>f.id),
      successApiSurfaces:conditionalCompanyApiSurfaces,
      successLeavesPerApi:conditionalCompanyFieldSpecs.length,
      queryRefusalSurfaces:[...conditionalCompanyApiSurfaces,conditionalCompanyWorkbookSurface],
      typedApiFields:Array.from(new Map(supplementalTypedApiEntries.filter(e=>e.surface.includes("/company-conditional-summaries"))
        .map(e=>[`${e.surface}|${e.field}`,e])).values()).map(e=>({
        ...e,bound:outputFieldSemantics.some(f=>f.id===`conditionalCompany.${e.field}`)})),
      workbook:{surface:conditionalCompanyWorkbookSurface,sheet:"Public allowlist",
        columns:{"Allowlisted field":"conditionalCompany.export.field","JSON value (null means unknown)":"conditionalCompany.export.jsonValue"},
        payload:"Every flattened primitive binds its exact structural leaf; fact values additionally bind issuer/id-specific formula/unit semantics and exact public allowlist equality. API/JSON/XLSX runtime readback tests cover all four issuer selections.",
        coverage:"Two serialization columns are a separate supplemental workbook contract, never extra original XLSX slots"},
      boundary:"GET-only public immutable aggregates. Two typed JSON success APIs and three HTTP400 error surfaces counted separately; XLSX success is a binary download, not an invented JSON body. No original1001 closure credit."},
  },
   displayBindingScope:"Explicit data-field-id bindings and all direct JSX expression children inventoried separately; expressions include non-value controls/containers and are not claimed semantically covered. Attributes, chart callback payloads and nested component rendering still require runtime review. No original denominator additions.",
  resolvedDynamicDomains:baseline?{}:nativeDynamicDomains,
  nativePathwayDynamicDomains:baseline?{}:{years:[2030,2050,2100],gases:nativePathwayGasIds,
    infillingFields:["method","evidence","sensitivity"],slots:nativePathwayDynamicSlots,
    enforcement:"pairSchema/validateNativePair rejects unexpected/missing inventory gas keys; exact species/year semantic IDs bound by response header"},
  withheldFields:unique.filter(e=>e.resolution==="withheld-public-field"),
  unresolvedTypes:unique.filter(e=>e.resolution==="unresolved-type"),
  unresolvedDynamicKeys:unique.filter(e=>e.resolution==="dynamic-key-needs-explicit-binding"&&!isBound(e)),
  families:Array.from(new Set(unique.map(e=>e.surface))).map(surface=>{
    const fields=unique.filter(e=>e.surface===surface);
    return {surface,total:fields.length,bound:baseline?0:fields.filter(isBound).length,
      unbound:fields.filter(e=>!isBound(e)),
      unresolvedTypes:fields.filter(e=>e.resolution==="unresolved-type"),
      unresolvedDynamicKeys:fields.filter(e=>e.resolution==="dynamic-key-needs-explicit-binding"&&!isBound(e)),
      withheld:fields.filter(e=>e.resolution==="withheld-public-field")};
  }),
  scope:"Direct registered API res.json expressions and all typed DownloadDataButton rows; display-only values and dynamic response builders remain exclusions",
  exclusions:unique.filter(e=>e.resolution!=="typed-field"),fields:unique,
  completion:false,warning:"A matching bare field name is not a precise semantic binding. No generic formula placeholders counted."};
// The original cohort is the supplied 429/1001 census, not definition count.
// These pre-existing response families were wholly unbound in that cohort.
const originalClosureSurfaces = [
  'API POST "/api/emissions/validate-native-pathways"',
  ...remainingApiBindings.map(([surface])=>surface),
  ...diagnosticMetadataBindings.map(({surface})=>surface),
  ...evidenceApiBindings.map(({surface})=>surface),
  'API GET "/api/research/driver-registry"', 'API GET "/api/reference-scenarios"',
  'API GET "/api/cv/summary"', 'API GET "/api/cv/dimensions"',
  'API GET "/api/cv/backtest"',
  'API GET "/api/cv/decarb-gap/summary"', 'API GET "/api/cv/decarb-gap/timeseries"',
  'API GET "/api/news/climate"', 'API GET "/api/data/indicators"', 'API GET "/api/data/indicator/:key"',
  'API GET "/api/cv/uploads"', 'API GET "/api/cv/upload/:id/status"',
];
// These existing DownloadDataButton families were present and wholly unbound
// in the supplied cohort. Line movement does not introduce or remove a slot.
const originalExportSources=[
  "category-comparison.tsx","emissions-chart.tsx","historical-trend-chart.tsx",
  "regional-comparison.tsx","sensitivity-chart.tsx","temperature-histogram.tsx",
  "decarb-signal.tsx","decarb-gap-signal.tsx","news-sentiment.tsx",
  "data-management.tsx",
  "category-trend-chart.tsx","indicator-cards.tsx","climate-valuation.tsx",
];
const candidateOriginalClosedSlots = unique.filter(e=>(originalClosureSurfaces.includes(e.surface) ||
  (e.surface.startsWith("XLSX client/") && originalExportSources.some(file=>e.source.endsWith(`/${file}`)) &&
     (verifiedExportBindings.some(b=>b.surface===e.surface&&b.field===e.field)||
       certifiedFiniteExports.some(s=>s.surface===e.surface))))&&isBound(e))
  .map(e=>({surface:e.surface,field:e.field}));
const slotSignatures=unique.map(e=>{
  const metadata=exportBindingMetadata.find(m=>e.surface===`XLSX ${m.source}:${m.line}`);
  return `${metadata?`XLSX ${metadata.source}:${metadata.rows}`:e.surface}|${e.field}`;
}).sort();
const slotFingerprint=createHash("sha256").update(JSON.stringify(slotSignatures)).digest("hex");
const frozenOriginalSlotFingerprint="34c22e5313d2db68748af9576beb7d72c6b1817f2aa9c1ad77aa9866e1d92f79";
type FrozenSlot={key:string;surface:string;field:string;role:"originally-bound"|"original-gap"|"withheld"};
type FrozenCohort={version:string;sourceSha256:string;slotIdentityFingerprint:string;slots:FrozenSlot[]};
const cohortPath="docs/field_semantics_original_cohort.json";
const normalizedKey=(entry:{surface:string;field:string},metadata:typeof exportBindingMetadata)=>{
  const m=metadata.find(m=>entry.surface===`XLSX ${m.source}:${m.line}`);
  return `${m?`XLSX ${m.source}:${m.rows}`:entry.surface}|${entry.field}`;
};
let frozenCohort:FrozenCohort|undefined;
if(!baseline) {
  if(existsSync(cohortPath)) frozenCohort=JSON.parse(readFileSync(cohortPath,"utf8"));
  else {
    const previousText=readFileSync("docs/field_semantics_census.json","utf8");
    const previous=JSON.parse(previousText);
    if(previous.originalGapReconciliation?.slotIdentityFingerprint!==frozenOriginalSlotFingerprint ||
      previous.originalGapReconciliation?.originalPublicSlots!==1001 || previous.fields.length!==1028)
      throw new Error("Cannot initialize frozen original cohort from a changed census; restore exact reviewed original census first");
    const closed=new Set(previous.originalGapReconciliation.closedSlots.map((e:Entry)=>
      normalizedKey(e,previous.exportBindingMetadata)));
    frozenCohort={version:"original-1001-cohort-v1",sourceSha256:createHash("sha256").update(previousText).digest("hex"),
      slotIdentityFingerprint:frozenOriginalSlotFingerprint,
      slots:previous.fields.map((e:Entry)=>({
        key:normalizedKey(e,previous.exportBindingMetadata),surface:e.surface,field:e.field,
        role:e.resolution==="withheld-public-field"?"withheld":
          closed.has(normalizedKey(e,previous.exportBindingMetadata)) ||
          (e.surface==='API GET "/api/data/runs"'&&e.field==="runs[].summary")?"original-gap":"originally-bound",
      }))};
    writeFileSync(cohortPath,JSON.stringify(frozenCohort,null,2)+"\n");
  }
  if(!frozenCohort || frozenCohort.slotIdentityFingerprint!==frozenOriginalSlotFingerprint ||
    frozenCohort.slots.filter(s=>s.role!=="withheld").length!==1001 ||
    frozenCohort.slots.filter(s=>s.role==="original-gap").length!==572 ||
    frozenCohort.slots.filter(s=>s.role==="originally-bound").length!==429)
    throw new Error("Frozen original cohort identities/denominators changed");
}
// These exact label aliases preserve the OLD fixed5Gt quantity and semantic ID.
// They do not alias new5%-of2024 columns into the original fixed5Gt slots.
const quantityPreservingExportAliases=[
  {source:"client/src/components/category-comparison.tsx",oldField:"[].First year median emissions reach 5 GtCO2e"},
  {source:"client/src/components/historical-trend-chart.tsx",oldField:"[].Year median emissions reach 5 GtCO2e"},
  {source:"client/src/components/regional-comparison.tsx",oldField:"[].Legacy 5 Gt milestone"},
].map(alias=>({...alias,currentField:"[].Legacy fixed-5gt-v1 year (5 GtCO2e)"}));
const originalKeyForCurrent=(entry:Entry)=>{
  const alias=quantityPreservingExportAliases.find(a=>a.source===entry.source&&a.currentField===entry.field);
  return normalizedKey(alias?{...entry,field:alias.oldField}:entry,exportBindingMetadata);
};
const currentByOriginalKey=new Map(unique.map(e=>[originalKeyForCurrent(e),e]));
const originalSlots=(frozenCohort?.slots??[]).map(slot=>{
  const current=currentByOriginalKey.get(slot.key);
  return {...slot,present:!!current,bound:!!current&&isBound(current),
    resolution:slot.role==="withheld"?"withheld-public-field":current?.resolution??"missing-original-slot"};
});
const originalClosedSlots=baseline?candidateOriginalClosedSlots:
  originalSlots.filter(s=>s.role==="original-gap"&&s.bound).map(s=>({surface:s.surface,field:s.field}));
const originalFullyBound=originalSlots.filter(s=>s.role!=="withheld"&&s.bound).length;
const originalKeys=new Set(frozenCohort?.slots.map(s=>s.key));
const addedCurrentSlots=unique.filter(e=>!originalKeys.has(originalKeyForCurrent(e)));
const externalTypedApiFields=Array.from(new Map(supplementalTypedApiEntries.filter(e=>e.type!=="undefined")
  .map(e=>[`${e.surface}|${e.field}`,e])).values());
const externalTypedApiBound=externalTypedApiFields.filter(e=>
   warmingApiLeafBindings.has(`${e.surface}|${e.field}`)?
     outputFieldSemantics.some(f=>f.id===warmingApiLeafBindings.get(`${e.surface}|${e.field}`)!.id):
   outputFieldSemantics.some(f=>f.id===`${e.surface.includes("/company-conditional-summaries")?"conditionalCompany":
     e.surface.includes("/company-coverage")?"companyCoverage":"originalNominalAssessment"}.${e.field}`)).length;
const originalCohortFingerprint=frozenCohort?.slotIdentityFingerprint??slotFingerprint;
const reconciliation = baseline ? {} : {
  originalGapReconciliation: {
    originalPublicSlots:1001, originalBoundSlots:429, originalUnboundSlots:572,
    closedOriginalSlots:originalClosedSlots.length, remainingOriginalUnboundSlots:572-originalClosedSlots.length,
    closedSlots:originalClosedSlots,
    currentPublicSlots:unique.filter(e=>e.resolution!=="withheld-public-field").length,
    publicSlotDenominatorDelta:unique.filter(e=>e.resolution!=="withheld-public-field").length-1001,
      originalCohortComplete:originalClosedSlots.length===572&&originalFullyBound===1001,
      originalFullyBoundFields:originalFullyBound,
      originalSlots:originalSlots,
      families:Array.from(new Set(originalSlots.map(s=>s.surface))).map(surface=>{
        const fields=originalSlots.filter(s=>s.surface===surface);
        return {surface,total:fields.length,bound:fields.filter(s=>s.bound).length,
          unbound:fields.filter(s=>!s.bound),withheld:fields.filter(s=>s.role==="withheld")};
      }),
      missingOriginalSlots:originalSlots.filter(s=>!s.present),
      quantityPreservingExportAliases,
      slotIdentityFingerprint:originalCohortFingerprint,
      currentInventorySlotIdentityFingerprint:slotFingerprint,
     frozenOriginalSlotFingerprint,
      originalSlotIdentitiesUnchanged:originalSlots.every(s=>s.present),
    reconciledCacheAliases:4,
     note:"Only reviewed original API families and existing DownloadDataButton slots count as closure. Literal columns require exact qualified bindings; finite dynamic slots require actual production row-builder certification, matching settings/bindings and an explicit finite concrete column domain with runtime rejection. New concrete columns, definitions, supplemental response/JSON claims and displays are separately inventoried, never original closure additions.",
  },
  supplementalSlotAccounting:{
    addedSlots:addedCurrentSlots.length,addedPublicSlots:addedCurrentSlots.filter(e=>e.resolution!=="withheld-public-field").length,
    addedBoundSlots:addedCurrentSlots.filter(isBound).length,
    addedFields:addedCurrentSlots.map(e=>({...e,bound:isBound(e)})),
    removedOriginalSlots:originalSlots.filter(s=>!s.present),
    originalPublicDenominator:1001,
    externalTypedApiSlots:externalTypedApiFields.length,
    externalTypedApiBoundSlots:externalTypedApiBound,
    expandedApiAndDownloadPublicSlots:unique.filter(e=>e.resolution!=="withheld-public-field").length+externalTypedApiFields.length,
    expandedApiAndDownloadBoundSlots:report.fullyBoundFields+externalTypedApiBound,
    expandedPublicDeltaFromOriginal:addedCurrentSlots.filter(e=>e.resolution!=="withheld-public-field").length+externalTypedApiFields.length,
    supplementalMetadataSheetColumns:supplementalSheetSemantics.length,
    companyCoverageApiLeafSlots:companyCoverageSemantics.length,
    companyCoverageJsonExportLeafSlots:companyCoverageSemantics.length,
     conditionalCompanyApiLeafSlots:externalTypedApiFields.filter(e=>e.surface.includes("/company-conditional-summaries")).length,
     conditionalCompanySuccessLeavesPerApi:conditionalCompanyFieldSpecs.length,
     conditionalCompanyWorkbookColumns:2,
     warmingReferenceApiLeafSlots:externalTypedApiFields.filter(e=>e.surface===warmingReferenceApiSurface).length,
     warmingReferenceJsonExportLeafSlots:externalTypedApiFields.filter(e=>e.surface===warmingReferenceExportSurface).length,
    boundary:"All new typed API/export leaves and any removed original identities are separate. New definitions, authenticated sidecars and new sheets do not close the original opaque JSON slot.",
  },
};
const out=JSON.stringify({...report,...reconciliation},null,2)+"\n";
if(baseline) {
  writeFileSync("docs/field_semantics_baseline.json",out);
} else if(process.argv.includes("--check")) {
  if(readFileSync("docs/field_semantics_census.json","utf8")!==out) throw new Error("Field census stale; regenerate and reconcile new fields");
} else writeFileSync("docs/field_semantics_census.json",out);
console.log(JSON.stringify({definitions:report.definitions,typedEntries:unique.length,
  unresolved:report.unresolvedTypes.length+report.unresolvedDynamicKeys.length,
  nonScalarOrWithheldInventory:report.exclusions.length,
  surfaces:new Set(unique.map(e=>e.surface)).size,fullyBoundFields:report.fullyBoundFields,
   originalCohortComplete:!baseline&&originalClosedSlots.length===572&&originalFullyBound===1001&&originalSlots.every(s=>s.present),
  completion:false}));
for(const gate of ["--require-original-complete","--require-complete"] as SemanticsCompletionGate[]) {
  if(!process.argv.includes(gate)) continue;
  const error=semanticsCompletionGateError(gate,{
     baseline:!!baseline,closedOriginalSlots:originalClosedSlots.length,
     fullyBoundFields:gate==="--require-original-complete"?originalFullyBound:report.fullyBoundFields,
     publicSlots:gate==="--require-original-complete"?1001:unique.filter(e=>e.resolution!=="withheld-public-field").length,
     slotFingerprint:gate==="--require-original-complete"?originalCohortFingerprint:slotFingerprint,
     frozenOriginalSlotFingerprint,resolvedResponseAliases:report.resolvedResponseAliases.length,
    withheldFields:report.withheldFields.length,
  });
  if(error) throw new Error(error);
}
