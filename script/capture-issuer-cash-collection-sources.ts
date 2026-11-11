import{mkdirSync,existsSync,readFileSync,writeFileSync}from"node:fs";
import{createHash}from"node:crypto";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const dir="generated-artifacts/company-operating-corpus/issuer-cash-collections-v1";mkdirSync(dir,{recursive:true});
const receiptPath=`${dir}/receipts.json`,book=existsSync(receiptPath)?JSON.parse(readFileSync(receiptPath,"utf8")):{
  version:"issuer-cash-collections-1",maximumLogicalAttempts:14,
  priority:"XOMdeclared EnLink contract/project economics; FSLRactual dated credit collections, no repeatedCF2022orresolved kernels",attempts:[]};
const at=process.argv.indexOf("--one"),name=process.argv[at+1],url=process.argv[at+2],field=process.argv[at+3];
const hosts=["data.sec.gov","www.sec.gov","www.enlink.com","enlink.com","investor.enlink.com","www.oneok.com","investor.oneok.com","www.cfindustries.com","www.epa.gov"];
if(at<0||!/^[\w.-]+$/.test(name)||!field||!hosts.includes(new URL(url).hostname))throw new Error("Explicit primary/name/field required");
if(book.attempts.length>=14||book.attempts.some((x:any)=>x.url===url))throw new Error("Bound14/no recapture");
async function capture(){
  const attemptedAt=new Date().toISOString();
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{"User-Agent":"CompanyEvidenceReview/1.0 evidence@example.com"}});
    if(!hosts.includes(new URL(response.url).hostname))throw new Error("Unapproved redirect");
    const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>20000000)throw new Error("20MB ceiling");
    const path=`${dir}/${name}`;writeFileSync(path,bytes,{flag:"wx"});
    const row={name,url,field,attemptedAt,capturedAt:new Date().toISOString(),status:response.status,finalUrl:response.url,
      contentType:response.headers.get("content-type"),lastModified:response.headers.get("last-modified"),path,
      bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
    book.attempts.push(row);console.log(JSON.stringify(row));
  }catch(e){let row={name,url,field,attemptedAt,failedAt:new Date().toISOString(),error:e instanceof Error?e.message:String(e)};
    book.attempts.push(row);console.log(JSON.stringify(row));}
  writeFileSync(receiptPath,JSON.stringify(book,null,2)+"\n");
}
capture().catch(e=>{console.error(e);process.exitCode=1;});
