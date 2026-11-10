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
const isBound=(e:typeof unique[number])=>(e.surface.startsWith("XLSX client/src/components/emissions-candidate-review.tsx:") &&
  nativeExportColumns.some(c=>e.field===`[].${c.column}`)) || (e.surface.includes('"/api/emissions/candidate"') &&
  Object.hasOwn(nativeDynamicDomains,e.field)) || (e.surface.includes('"/api/emissions/candidate"') &&
  outputFieldSemantics.some(f=>f.id===`native.${e.field}`)) || (e.surface.includes('"/api/projection"') &&
      outputFieldSemantics.some(f=>f.id===`projection.${e.field}`)) || (e.field.startsWith("[].") &&
    [["/api/cv/sdg-growth","sdg"],["/api/cv/pe-comparison","pe"],["/api/indicators/historical","indicator"],["/api/projection/regions","regional"],["/api/projection/sensitivity","sensitivity"],["/api/projection/categories","category"],["/api/projection/historical-trend","historical"],["/api/projection/categories/historical-trend","categoryHistory"],["/api/calculation/company-operating/reviews","companyReview"]].some(([path,prefix])=>
      e.surface.includes(`"${path}"`) && outputFieldSemantics.some(f=>f.id===`${prefix}.${e.field.slice(3)}`)));
const report={version:"typed-field-census-1",definitions:baseline?16:fieldSemantics.length+outputFieldSemantics.length,
  resolvedResponseAliases,
  comparableSlotAccounting:{actualUniqueSlots:unique.length,previouslyUnresolvedAliasSlots:resolvedResponseAliases.length,
    slotsIncludingReconciledAliases:unique.length+resolvedResponseAliases.length},
  fullyBoundFields:baseline?0:unique.filter(isBound).length,
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
const out=JSON.stringify(report,null,2)+"\n";
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
