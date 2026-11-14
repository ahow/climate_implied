import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import XLSX from "xlsx";
import {economicBridgeCells} from "../shared/economicBridgeSchema";
import {readPrivateFiniteDocument} from "../client/src/lib/private-finite-reader";
import {PrivateFiniteEvidence} from "../client/src/pages/private-finite-viewer";
Object.assign(globalThis,{React});
async function main(){
 const receipt=JSON.parse(readFileSync("generated-artifacts/renewal-cash/finite-postgres.json","utf8"));
 assert.equal(receipt.passed,true);
 for(const file of Object.values(receipt.fixtureFiles) as string[])assert.ok(file.startsWith("generated-artifacts/private-exports/synthetic-finite-"));
 const a=JSON.parse(readFileSync(receipt.fixtureFiles.a,"utf8"));
 const b=JSON.parse(readFileSync(receipt.fixtureFiles.b,"utf8"));
 const workbook=XLSX.readFile(receipt.fixtureFiles.xlsx);
 const rows=XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[workbook.SheetNames[0]],{header:1,raw:true});
 const cells=economicBridgeCells(a);
 assert.deepEqual(rows.slice(1),cells.map(c=>[c.pointer,c.jsonValue]));
 for(const doc of [a,b,a]){
  const evidence=await readPrivateFiniteDocument(JSON.stringify(doc));
  const html=renderToStaticMarkup(React.createElement(PrivateFiniteEvidence,{evidence}));
  assert.ok(html.includes(doc.id));
  assert.equal((html.match(/data-testid="private-finite-cell-row"/g)||[]).length,evidence.cells.length);
  for(const c of evidence.cells){
   const escape=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#x27;");
   assert.ok(html.includes(escape(c.jsonValue)),c.pointer);
  }
  assert.ok(html.includes("assetSaleReceivableUsd"));assert.ok(html.includes("finite-cohort-accrual-4-disposition")||html.includes("finite-cohort-accrual-5-rights")||html.includes("finite-cohort-accrual-6-opening-obligations"));
 }
 console.log(JSON.stringify({passed:true,rows:cells.length,literalCells:cells.length*2,renderedSelections:3,scope:"Synthetic retained asset branch, actual component SSR/JSON/XLSX. Not browser interaction/principal/source acceptance."}));
}
main();
