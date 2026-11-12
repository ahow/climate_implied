import test from "node:test";
import assert from "node:assert/strict";
import {buildSync} from "esbuild";
import {mkdtempSync,readFileSync} from "node:fs";
import {resolve,join} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
test("actual CommonJS paired producer uses explicit checkout root; missing source refuses",()=>{
 const root=process.cwd(),directory=mkdtempSync(resolve("generated-artifacts/paired-cjs-"));
 const file=join(directory,"producer.cjs");
 buildSync({entryPoints:["server/retainedPairedResearchProjection.ts"],outfile:file,
  bundle:true,platform:"node",format:"cjs",packages:"external",logLevel:"silent"});
 const script=`const m=require(${JSON.stringify(file)});m.pairedProjectionCodeEntries(${JSON.stringify(root)}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.message);process.exitCode=1})`;
 const child=spawnSync(process.execPath,["-e",script],{cwd:directory,encoding:"utf8",timeout:30000});
 assert.equal(child.status,0,child.stderr);
 const entries=JSON.parse(child.stdout);assert.equal(entries.length,11);
 for(const entry of entries)assert.equal(entry.hash,createHash("sha256").update(readFileSync(resolve(root,entry.module))).digest("hex"));
 const absent=spawnSync(process.execPath,["-e",`require(${JSON.stringify(file)}).pairedProjectionCodeEntries().then(()=>process.exitCode=2).catch(e=>{console.log(e.code);process.exitCode=0})`],
  {cwd:directory,encoding:"utf8",timeout:30000});
 assert.equal(absent.status,0);assert.match(absent.stdout,/ENOENT/);
});
