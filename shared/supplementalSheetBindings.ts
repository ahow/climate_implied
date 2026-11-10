import type { ExportFieldBinding, OutputFieldSemantic } from "./outputFieldSemantics";

type Spec = [string,string,string];
const definitionColumns:Spec[] = [
  ["Field","Semantic field identifier or legacy core property name","f.id for qualified fields; f.field for core fields"],
  ["Classification","Declared Input, Calculated or Output role","f.role"],
  ["Unit","Native quantity unit declared by the definition; not this metadata cell's numeric value","f.unit"],
  ["Formula","Declared equation or construction rule","f.formula"],
  ["Dependencies","Comma-separated declared dependency identifiers","f.dependencies.join(', ')"],
  ["Source","Declared source description, not independent authentication","f.source"],
  ["Vintage","Declared vintage disclosure; qualified definitions repeat source disclosure","core f.vintage; qualified f.source"],
  ["AsOf","Declared availability/selection rule, not certified publication date","core f.asOf; qualified f.asOfRule"],
  ["Meaning","Qualified semantic meaning; absent for legacy core rows","qualified f.meaning"],
  ["Period","Qualified period disclosure; absent for legacy core rows","qualified f.period"],
  ["Geography","Qualified population geography disclosure; absent for legacy core rows","qualified f.geography"],
  ["Status","Qualified evidence/status disclosure; absent for legacy core rows","qualified f.status"],
  ["Missingness","Qualified missingness disclosure; absent for legacy core rows","qualified f.missingness"],
  ["Uncertainty","Qualified uncertainty disclosure; absent for legacy core rows","qualified f.uncertainty"],
];
const semanticProperties:Spec[] = [
  ["id","Qualified identifier of the bound output quantity","requireOutputSemantic(binding.id).id"],
  ["meaning","Meaning of the bound quantity","requireOutputSemantic(binding.id).meaning"],
  ["role","Declared semantic role","requireOutputSemantic(binding.id).role"],
  ["formula","Declared equation for the native quantity","requireOutputSemantic(binding.id).formula"],
  ["dependencies","Comma-separated declared dependencies","requireOutputSemantic(binding.id).dependencies.join(', ')"],
  ["unit","Native quantity unit before the separately declared export transformation","requireOutputSemantic(binding.id).unit"],
  ["source","Declared source description","requireOutputSemantic(binding.id).source"],
  ["period","Declared period","requireOutputSemantic(binding.id).period"],
  ["geography","Declared population geography","requireOutputSemantic(binding.id).geography"],
  ["status","Declared evidence/status boundary","requireOutputSemantic(binding.id).status"],
  ["missingness","Declared native missingness; export blank handling is separate","requireOutputSemantic(binding.id).missingness"],
  ["uncertainty","Declared uncertainty disclosure","requireOutputSemantic(binding.id).uncertainty"],
  ["scope","Declared inference scope","requireOutputSemantic(binding.id).scope"],
  ["asOfRule","Declared source availability/selection rule","requireOutputSemantic(binding.id).asOfRule"],
];
const bindingColumns:Spec[] = [
  ["Column","Exact concrete exported data-column label","Object.keys(normalized export rows)"],
  ["FieldID","Qualified semantic ID explicitly selected by the download call site","fieldBindings[column].id"],
  ["Transformation","Explicit native-to-export transformation; not executed by this metadata sheet","fieldBindings[column].transform"],
  ...semanticProperties,
];
export type SupplementalSheet = "Field semantics"|"Column bindings";
const columns = {"Field semantics":definitionColumns,"Column bindings":bindingColumns};
const prefix = {"Field semantics":"supplementalSheet.definitions","Column bindings":"supplementalSheet.bindings"};
const context = {
  role:"Output" as const,dependencies:["semanticRows","bindExportColumns","DownloadDataButton"],
  source:"shared/fieldSemantics.ts semanticRows; shared/outputFieldSemantics.ts bindExportColumns; client/src/components/download-data-button.tsx",
  period:"Export time; inherited field definitions describe their own observation periods",
  geography:"Metadata about the exported data; no additional population inference",
  status:"Supplemental dictionary/binding metadata only; not scientific or source acceptance",
  missingness:"Core dictionary rows omit the six qualified-only disclosures. No absent metadata is replaced with zero or invented text.",
  uncertainty:"Metadata carries the underlying definition's disclosure, not a new uncertainty estimate",
  scope:"Concrete metadata worksheet cells only. Does not certify arbitrary Interpretation notes, replay JSON leaves, custom callback payloads or every displayed value.",
  asOfRule:"Definitions resolved at export time; does not reconstruct definitions available historically",
};
export const supplementalSheetSemantics:OutputFieldSemantic[] =
  (Object.keys(columns) as SupplementalSheet[]).flatMap(sheet=>columns[sheet].map(([column,meaning,formula])=>({
    id:`${prefix[sheet]}.${column}`,meaning,formula,unit:"metadata text",...context,
  })));
export function supplementalSheetBindings(sheet:SupplementalSheet):Record<string,ExportFieldBinding> {
  return Object.fromEntries(columns[sheet].map(([column])=>[
    column,{id:`${prefix[sheet]}.${column}`,transform:"Identity of the already constructed metadata text; omitted optional cells stay absent"},
  ]));
}
/** Production row-builder guard. Same array/objects in, same array/objects out:
 * no changes to exported cells and no envelope pretending to bind JSON leaves.
 */
export function certifySupplementalSheetRows<T extends Record<string,unknown>>(sheet:SupplementalSheet,rows:T[]):T[] {
  const allowed=new Set(columns[sheet].map(([column])=>column));
  const required=sheet==="Field semantics" ? definitionColumns.slice(0,8).map(([column])=>column) :
    bindingColumns.map(([column])=>column);
  for(const row of rows) {
    if(Object.keys(row).some(key=>!allowed.has(key)) || required.some(key=>!(key in row)))
      throw new Error(`Unmapped or missing supplemental worksheet column: ${sheet}`);
    if(Object.values(row).some(value=>typeof value!=="string"))
      throw new Error(`Supplemental worksheet metadata must be explicit text: ${sheet}`);
    if(sheet==="Column bindings" && (row.FieldID!==row.id || !row.Transformation))
      throw new Error("Conflicting supplemental worksheet binding identity/transformation");
  }
  return rows;
}
