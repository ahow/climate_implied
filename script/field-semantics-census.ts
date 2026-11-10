import ts from "typescript";
import { readFileSync,writeFileSync } from "node:fs";
import { fieldSemantics } from "../shared/fieldSemantics";
import { outputFieldSemantics } from "../shared/outputFieldSemantics";
import { nativeExportColumns } from "../shared/nativeExport";
import { publicValuationResult } from "../server/calculation/publicValuationContract";
import { execFileSync,spawnSync } from "node:child_process";
import { relative,resolve } from "node:path";
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
const displayBindings: {source:string;line:number;id:string;expression:string;bound:boolean}[]=[];
const exportBindingMetadata: {source:string;line:number;rows:string;bindings:string;coverage:string}[]=[];
const verifiedExportBindings: {surface:string;field:string;id:string;transform:string}[]=[];
const supplementalWorkbookInventory:{source:string;line:number;sheet:string;rowExpression:string;literalLabels:string[];coverage:string}[]=[];
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
      fields(checker.getTypeAtLocation(node.arguments[0]),"",surface,node);
      const expression=node.arguments[0].getText(source);
      if(!baseline&&["projectionResultCache","categoryCacheResult","historicalTrendCacheResult","categoryHistoricalTrendCache"].includes(expression)){
        const type=checker.getTypeAtLocation(node.arguments[0]);
        if(type.flags&(ts.TypeFlags.Any|ts.TypeFlags.Unknown)) throw new Error("Cache response alias regressed to unknown");
        resolvedResponseAliases.push({surface,source:relativeSource(source.fileName),
          line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,expression,
          replacement:"Typed cached response expands to the same qualified leaves as fresh response; former $ placeholder retained in reconciliation, not silently discarded"});
      }
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
          // Reconcile literal column bindings against the actual typed row fields,
          // not merely against a similarly named semantic. Conditional objects,
          // spreads and computed keys remain explicitly unverified here.
          if(binding && ts.isJsxAttribute(binding) && binding.initializer &&
            ts.isJsxExpression(binding.initializer) && binding.initializer.expression &&
            ts.isObjectLiteralExpression(binding.initializer.expression)) {
            const object=binding.initializer.expression;
            if(!object.properties.some(ts.isSpreadAssignment)) for(const property of object.properties) {
              if(!ts.isPropertyAssignment(property) || ts.isComputedPropertyName(property.name) ||
                !ts.isObjectLiteralExpression(property.initializer)) continue;
              const name=ts.isStringLiteral(property.name)?property.name.text:property.name.getText(source);
              const values=new Map(property.initializer.properties.flatMap(p=>
                ts.isPropertyAssignment(p)&&ts.isIdentifier(p.name)&&ts.isStringLiteral(p.initializer)
                  ? [[p.name.text,p.initializer.text] as const]:[]));
              const id=values.get("id"),transform=values.get("transform");
              if(id && transform && outputFieldSemantics.some(f=>f.id===id))
                verifiedExportBindings.push({surface:exportSurface,field:`[].${name}`,id,transform});
            }
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
const isBound=(e:typeof unique[number])=>([
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
  outputFieldSemantics.some(f=>f.id===`native.${e.field}`)) || (e.surface.includes('"/api/projection"') &&
      outputFieldSemantics.some(f=>f.id===`projection.${e.field}`)) || (e.field.startsWith("[].") &&
    [["/api/cv/decarb-gap/timeseries","peerValuationHistory"],["/api/cv/sdg-growth","sdg"],["/api/cv/pe-comparison","pe"],["/api/indicators/historical","indicator"],["/api/projection/regions","regional"],["/api/projection/sensitivity","sensitivity"],["/api/projection/categories","category"],["/api/projection/historical-trend","historical"],["/api/projection/categories/historical-trend","categoryHistory"],["/api/calculation/company-operating/reviews","companyReview"]].some(([path,prefix])=>
      e.surface.includes(`"${path}"`) && outputFieldSemantics.some(f=>f.id===`${prefix}.${e.field.slice(3)}`))) ||
      (e.surface==='API GET "/api/cv/backtest"' && e.field.startsWith("[].") &&
        outputFieldSemantics.some(f=>f.id===`backtest.${e.field.slice(3)}`));
const report={version:"typed-field-census-1",definitions:baseline?16:fieldSemantics.length+outputFieldSemantics.length,
  resolvedResponseAliases,
  comparableSlotAccounting:{actualUniqueSlots:unique.length,previouslyUnresolvedAliasSlots:resolvedResponseAliases.length,
    slotsIncludingReconciledAliases:unique.length+resolvedResponseAliases.length},
  fullyBoundFields:baseline?0:unique.filter(isBound).length,
  displayBindings,
  exportBindingMetadata,
  supplementalWorkbookInventory,
  verifiedExportBindings:verifiedExportBindings.filter(b=>unique.some(e=>e.surface===b.surface&&e.field===b.field&&e.resolution==="typed-field")),
  displayBindingScope:"Explicit data-field-id JSX elements only; separately counted, not additions to the original API/XLSX slot denominator. Unannotated display expressions remain unenumerated.",
  resolvedDynamicDomains:baseline?{}:nativeDynamicDomains,
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
];
const originalClosedSlots = unique.filter(e=>(originalClosureSurfaces.includes(e.surface) ||
  (e.surface.startsWith("XLSX client/") && originalExportSources.some(file=>e.source.endsWith(`/${file}`)) &&
    verifiedExportBindings.some(b=>b.surface===e.surface&&b.field===e.field)))&&isBound(e))
  .map(e=>({surface:e.surface,field:e.field}));
const reconciliation = baseline ? {} : {
  originalGapReconciliation: {
    originalPublicSlots:1001, originalBoundSlots:429, originalUnboundSlots:572,
    closedOriginalSlots:originalClosedSlots.length, remainingOriginalUnboundSlots:572-originalClosedSlots.length,
    closedSlots:originalClosedSlots,
    currentPublicSlots:unique.filter(e=>e.resolution!=="withheld-public-field").length,
    publicSlotDenominatorDelta:unique.filter(e=>e.resolution!=="withheld-public-field").length-1001,
    reconciledCacheAliases:4,
    note:"Only explicitly reviewed original API families and typed literal columns from existing DownloadDataButton families count as closure. Export closures require matching typed row column, qualified semantic ID and literal transformation; spreads/computed/conditional keys remain unverified. Withheld claims, new definitions, displays and unverified binding expressions are not original slot closure.",
  },
};
const out=JSON.stringify({...report,...reconciliation},null,2)+"\n";
if(baseline) {
  writeFileSync("docs/field_semantics_baseline.json",out);
} else if(process.argv.includes("--check")) {
  if(readFileSync("docs/field_semantics_census.json","utf8")!==out) throw new Error("Field census stale; regenerate and reconcile new fields");
} else writeFileSync("docs/field_semantics_census.json",out);
console.log(JSON.stringify({definitions:report.definitions,typedEntries:unique.length,unresolved:report.exclusions.length,
  surfaces:new Set(unique.map(e=>e.surface)).size,fullyBoundFields:report.fullyBoundFields,completion:false}));
if(process.argv.includes("--require-complete")) {
  const publicFields=unique.filter(e=>e.resolution!=="withheld-public-field");
  if(report.fullyBoundFields!==publicFields.length)
    throw new Error(`SEMANTICS INCOMPLETE: ${report.fullyBoundFields}/${publicFields.length} public field slots bound; display-only expressions additionally unenumerated`);
}
