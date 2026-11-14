import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {readFileSync} from "node:fs";
import assert from "node:assert/strict";
import {readPrivateFiniteDocument} from "../client/src/lib/private-finite-reader";
import {PrivateFiniteEvidence} from "../client/src/pages/private-finite-viewer";
Object.assign(globalThis,{React});
const receipts=[];
for(const file of process.argv.slice(2)){
 const raw=readFileSync(file,"utf8"),evidence=await readPrivateFiniteDocument(raw);
 const html=renderToStaticMarkup(React.createElement(PrivateFiniteEvidence,{evidence}));
 const document=JSON.parse(raw);
 assert.ok(html.includes(document.id));
 assert.ok(html.includes("opening-obligations-2-recovery"));
 assert.ok(html.includes("recoveryReceivableUsd"));
 assert.ok(html.includes("newExpenseUsd"));
 assert.ok(html.includes("Conditional finite project distributions"));
 receipts.push({id:document.id,rendered:true,mode:document.retrievalMode});
}
console.log(JSON.stringify({receipts,scope:"Actual new synthetic PG documents, local parser and SSR only; not interactive browser/principal/issuer acceptance"}));
