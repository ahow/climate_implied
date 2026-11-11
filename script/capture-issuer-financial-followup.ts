import{readFileSync,writeFileSync,mkdirSync,existsSync}from"node:fs";import{createHash}from"node:crypto";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const root="generated-artifacts/company-operating-corpus/issuer-financial-followup-v1";mkdirSync(root,{recursive:true});
const bookPath=`${root}/receipts.json`,book=existsSync(bookPath)?JSON.parse(readFileSync(bookPath,"utf8")):{version:"issuer-financial-followup-1",maximumLogicalAttempts:6,attempts:[]};
const i=process.argv.indexOf("--one"),name=process.argv[i+1],url=process.argv[i+2],field=process.argv[i+3];
if(i<0||!/^[\w.-]+$/.test(name)||!field||!["data.sec.gov","www.sec.gov","www.epa.gov","www.rrc.texas.gov"].includes(new URL(url).hostname))throw new Error("Explicit primary request only");
if(book.attempts.length>=6||book.attempts.some((a:any)=>a.url===url))throw new Error("Bound6/no repeats");
async function run(){
 const attemptedAt=new Date().toISOString();
 try{const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{"User-Agent":"PublicIssuerEvidenceReview/1.0"}});
 if(!["data.sec.gov","www.sec.gov","www.epa.gov","www.rrc.texas.gov"].includes(new URL(response.url).hostname))throw new Error("Unapproved redirect");
 const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>20000000)throw new Error("20MBceiling");
 const path=`${root}/${name}`;writeFileSync(path,bytes,{flag:"wx"});
 book.attempts.push({name,url,field,attemptedAt,capturedAt:new Date().toISOString(),status:response.status,finalUrl:response.url,
   path,sha256:createHash("sha256").update(bytes).digest("hex"),bytes:bytes.length,
   contentType:response.headers.get("content-type"),lastModified:response.headers.get("last-modified")});
 }catch(e){book.attempts.push({name,url,field,attemptedAt,error:e instanceof Error?e.message:String(e)});}
 writeFileSync(bookPath,JSON.stringify(book,null,2)+"\n");console.log(JSON.stringify(book.attempts[book.attempts.length-1]));
}run().catch(e=>{console.error(e);process.exitCode=1;});
