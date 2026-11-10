import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRequire} from "node:module";
import {transformSync} from "esbuild";
import * as access from "../server/newsApi/providerAccess";

test("actual public news service misses refuse before any provider or cache write",async()=>{
 let reads=0,writes=0;
 const db={select:()=>({from:()=>({where:()=>({limit:async()=>{reads++;return [];}})})}),
  insert:()=>{writes++;throw Error("Unexpected cache write");},
  update:()=>{writes++;throw Error("Unexpected cache write");}};
 const native=createRequire(import.meta.url),m={exports:{} as any};
 const source=readFileSync("server/newsApi/newsService.ts","utf8");
 const code=transformSync(source,{loader:"ts",format:"cjs"}).code;
 const requireStub=(id:string)=>{
  if(id==="../db")return {db};
  if(id==="./providerAccess")return access;
  if(id.includes("schema"))return {newsCache:{cacheKey:"cache_key"}};
  return native(id);
 };
 new Function("require","module","exports",code)(requireStub,m,m.exports);
 await assert.rejects(()=>m.exports.getClimateNewsAnalysis(12),/operator-news-refresh-required/);
 await assert.rejects(()=>m.exports.getClimateNewsAnalysis(3),/operator-news-refresh-required/);
 assert.equal(reads,2);assert.equal(writes,0);
});
