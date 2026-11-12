/** Offline diagnostic operator CLI. No public writes, source approval, provider
 * calls, persistence activation or historical backdating. Outputs stay private. */
import {readFileSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import assert from "node:assert/strict";
import {freezeCohortGrowthDeck,invertCohortGrowthDeck,evaluateCohortGrowthDeck} from "../server/calculation/cohortGrowthInverse";
import {readCalculationSourceArtifact} from "../server/snapshots/materialInputs";
import {contentHash} from "../server/calculation/analysisManifest";
async function main(){
 const input=process.argv[2],parameter=process.argv[3];
 if(!input||!parameter)throw Error("Usage: tsx script/cohort-continuation-run.ts PRIVATE_DECK.json ONE_PLUS_GROWTH");
 const deck=JSON.parse(readFileSync(input,"utf8"));
 const freeze=freezeCohortGrowthDeck(deck); // declaration is made before any inverse/point result
 const result={inversion:invertCohortGrowthDeck(freeze),point:evaluateCohortGrowthDeck(freeze,parameter)};
 const source=readCalculationSourceArtifact();
 const report={version:"cohort-diagnostic-run-1",freeze,result,identity:{
  material:contentHash(deck),declaration:freeze.hash,code:source.id,result:contentHash(result),
  sourceAuthenticated:false,ownerApproved:false,marketImplied:false}};
 const id=contentHash(report),folder=resolve("generated-artifacts/cohort-continuation/private",id);
 mkdirSync(folder,{recursive:true});
 writeFileSync(`${folder}/result.json`,JSON.stringify(report,null,2)+"\n");
 const rows:[string,string][]=[];
 function visit(value:any,path:string){
  rows.push([path,JSON.stringify(value)]);
  if(value&&typeof value==="object")Object.entries(value).forEach(([k,v])=>visit(v,`${path}/${k.replace(/~/g,"~0").replace(/\//g,"~1")}`));
 }
 visit(report,"");
 const book=new ExcelJS.Workbook(),sheet=book.addWorksheet("Diagnostic only");
 sheet.addRow(["Pointer","Literal JSON"]);rows.forEach(row=>sheet.addRow(row));
 const bytes=Buffer.from(await book.xlsx.writeBuffer());
 const read=XLSX.read(bytes,{type:"buffer"});
 assert.deepEqual(XLSX.utils.sheet_to_json(read.Sheets["Diagnostic only"],{header:1}).slice(1),rows);
 writeFileSync(`${folder}/result.xlsx`,bytes);
 console.log(JSON.stringify({id,folder,rows:rows.length,literalReadback:true,
  qualifiedIssuer:false,scientificAcceptance:false}));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Diagnostic refused");process.exitCode=1;});
