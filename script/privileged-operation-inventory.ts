import ts from "typescript";
import {createHash} from "node:crypto";
import {readFileSync,readdirSync,writeFileSync} from "node:fs";
import {join} from "node:path";

export function scanOperations(path:string,source:string){
 const file=ts.createSourceFile(path,source,ts.ScriptTarget.Latest,true);
 const rows:Array<{path:string;line:number;kind:string;callee:string;review:string}>=[];
 const add=(node:ts.Node,kind:string,callee:string)=>rows.push({
  path,line:file.getLineAndCharacterOfPosition(node.getStart(file)).line+1,kind,callee,
  review:"Candidate requiring caller/authorization review; discovery is not permission or proof of safe execution."
 });
 const visit=(node:ts.Node)=>{
  if(ts.isCallExpression(node)){
   const expr=node.expression;
   const name=ts.isPropertyAccessExpression(expr)?expr.name.text:
    ts.isIdentifier(expr)?expr.text:"dynamic";
   if(["insert","update","delete","execute","query"].includes(name))add(node,"database-or-executor-candidate",name);
   if(/(?:clear|invalidate|reset).*cache|cache.*(?:clear|invalidate|reset)/i.test(name)||
      (name==="clear"&&/cache/i.test(expr.getText(file))))add(node,"cache-mutation-candidate",name);
   if(["fetch","request","get","post","put","patch"].includes(name)){
    const text=expr.getText(file);
    if(name==="fetch"||/axios|https?|provider|client/i.test(text))add(node,"provider-or-network-candidate",name);
   }
   if(/startScheduler|runCollection|triggerCollection|setInterval|setTimeout/.test(name))add(node,"scheduler-or-timer-candidate",name);
  }
  if(ts.isTaggedTemplateExpression(node)&&/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i.test(node.template.getText(file)))
   add(node,"mutating-sql-candidate","tagged-template");
  if(ts.isPropertyAccessExpression(node)&&node.getText(file)==="process.argv")add(node,"cli-entry-candidate","process.argv");
  ts.forEachChild(node,visit);
 };
 visit(file);
 return {path,sourceSha256:createHash("sha256").update(source).digest("hex"),operations:rows};
}
export function inventory(){
 const files:string[]=[];
 const walk=(dir:string)=>{for(const e of readdirSync(dir,{withFileTypes:true})){
  const p=join(dir,e.name);
  if(e.isDirectory())walk(p);
  else if(/\.[cm]?[jt]sx?$/.test(p)&&!p.endsWith(".test.ts"))files.push(p);
 }};
 for(const dir of ["server","script"])walk(dir);
 return {
  version:"privileged-source-discovery-1",
  limits:["Static candidate census, not whole-program reachability proof.","Python/shell and dynamic indirection require separate review.","GET cache fills and paid read-provider calls are privileged candidates too.","No code executed, network called, credentials read, or permission changed by this inventory."],
  files:files.sort().map(p=>scanOperations(p,readFileSync(p,"utf8")))
 };
}
if(process.argv[1]?.endsWith("/privileged-operation-inventory.ts")){
 const result=inventory();
 if(process.argv.includes("--write"))writeFileSync("docs/privileged_operation_census.json",JSON.stringify(result,null,2)+"\n");
 console.log(JSON.stringify({files:result.files.length,candidates:result.files.reduce((n,f)=>n+f.operations.length,0),limits:result.limits}));
}
