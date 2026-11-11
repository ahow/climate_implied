import {mkdirSync,existsSync,readFileSync,writeFileSync} from "node:fs";
import {createHash} from "node:crypto";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private read-only source capture required");
const dir="generated-artifacts/company-operating-corpus/xom-source-inputs-v1";
mkdirSync(dir,{recursive:true});
const receiptPath=`${dir}/receipts.json`;
const book=existsSync(receiptPath)?JSON.parse(readFileSync(receiptPath,"utf8")):{
  version:"xom-source-inputs-1",maximumNewPublicAttempts:16,priorAttemptPacksReviewed:[
    "issuer-original-v3/funding-sources/receipts.json","xom-climate-liability-v1/sources/receipts.json"],attempts:[]};
const args=process.argv,at=args.indexOf("--one"),name=args[at+1],url=args[at+2],field=args[at+3];
const allowed=["investor.exxonmobil.com","corporate.exxonmobil.com","www.cfindustries.com","www.linde.com",
  "www.sec.gov","data.sec.gov","www.legislation.gov.uk","www.gov.uk","environment.data.gov.uk",
  "assets.publishing.service.gov.uk","consult.environment-agency.gov.uk","reports.view-emissions-trading-registry.service.gov.uk"];
if(at<0||!/^[a-zA-Z0-9_.-]+$/.test(name)||!field||!allowed.includes(new URL(url).hostname))throw new Error("Explicit source filename/allowed primary URL/field required");
if(book.attempts.length>=book.maximumNewPublicAttempts||book.attempts.some((a:any)=>a.url===url))
  throw new Error("No recapture; bounded16 NEW public requests");
const attemptedAt=new Date().toISOString();
async function capture(){
try{
  const response=await fetch(url,{signal:AbortSignal.timeout(30000),headers:{"User-Agent":"CompanyEvidenceReview/1.0 evidence@example.com"}});
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>20000000)throw new Error("Bounded payload too large");
  const path=`${dir}/${name}`;writeFileSync(path,bytes,{flag:"wx"});
  const receipt={name,url,field,attemptedAt,capturedAt:new Date().toISOString(),status:response.status,finalUrl:response.url,
    contentType:response.headers.get("content-type"),lastModified:response.headers.get("last-modified"),path,
    bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
  book.attempts.push(receipt);console.log(JSON.stringify(receipt));
}catch(error){const receipt={name,url,field,attemptedAt,failedAt:new Date().toISOString(),error:error instanceof Error?error.message:String(error)};
  book.attempts.push(receipt);console.log(JSON.stringify(receipt));}
writeFileSync(receiptPath,JSON.stringify(book,null,2)+"\n");
}
capture().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
