import{mkdirSync,existsSync,readFileSync,writeFileSync}from"node:fs";
import{createHash}from"node:crypto";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const dir="generated-artifacts/company-operating-corpus/xom-contract-permit-v1";
mkdirSync(dir,{recursive:true});
const receiptPath=`${dir}/receipts.json`;
const book=existsSync(receiptPath)?JSON.parse(readFileSync(receiptPath,"utf8")):{
  version:"xom-contract-permit-1",maximumLogicalAttempts:18,
  priorPackUnchanged:"xom-source-inputs-v1",policy:"Official discovery/index links only; no repeated failed guesses; no paid calls; no scoring",attempts:[]};
const at=process.argv.indexOf("--one"),name=process.argv[at+1],url=process.argv[at+2],field=process.argv[at+3];
const bodyAt=process.argv.indexOf("--read-news-json"),body=bodyAt>=0?process.argv[bodyAt+1]:undefined;
if(body){
  const q=JSON.parse(body);
  if(url!=="https://www.cfindustries.com/api/v1/news/get"||Object.keys(q).sort().join(",")!=="newsCategoryId,newsLandingPageId,pageIndex"||
    ![q.newsCategoryId,q.pageIndex].every(n=>Number.isInteger(n)&&n>=0)||q.newsLandingPageId!==9)
    throw new Error("Only discovered issuer read-only news-list POST accepted");
}
const hosts=["www.cfindustries.com","cfindustries.com","ir.cfindustries.com","cfindustries.q4ir.com","www.sec.gov","data.sec.gov",
  "environment.data.gov.uk","www.gov.uk","assets.publishing.service.gov.uk","consult.environment-agency.gov.uk"];
if(at<0||!/^[\w.-]+$/.test(name)||!field||!hosts.includes(new URL(url).hostname))throw new Error("Explicit official source required");
if(book.attempts.length>=book.maximumLogicalAttempts||book.attempts.some((x:any)=>x.url===url&&x.requestBody===body))throw new Error("Bound18/no recapture");
async function capture(){
  const attemptedAt=new Date().toISOString();
  try{
    const response=await fetch(url,{method:body?"POST":"GET",body,signal:AbortSignal.timeout(30000),
      headers:{"User-Agent":"CompanyEvidenceReview/1.0 evidence@example.com",...(body?{"Content-Type":"application/json"}:{})}});
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length>20000000)throw new Error("Payload ceiling");
    if(!hosts.includes(new URL(response.url).hostname))throw new Error(`Unapproved redirect ${response.url}`);
    const path=`${dir}/${name}`;writeFileSync(path,bytes,{flag:"wx"});
    const row={name,url,field,method:body?"POST":"GET",requestBody:body,attemptedAt,capturedAt:new Date().toISOString(),status:response.status,finalUrl:response.url,
      contentType:response.headers.get("content-type"),lastModified:response.headers.get("last-modified"),
      path,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
    book.attempts.push(row);console.log(JSON.stringify(row));
  }catch(error){
    const row={name,url,field,method:body?"POST":"GET",requestBody:body,attemptedAt,failedAt:new Date().toISOString(),error:error instanceof Error?error.message:String(error)};
    book.attempts.push(row);console.log(JSON.stringify(row));
  }
  writeFileSync(receiptPath,JSON.stringify(book,null,2)+"\n");
}
capture().catch(e=>{console.error(e);process.exitCode=1;});
