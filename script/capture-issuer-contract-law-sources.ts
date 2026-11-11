import{mkdirSync,existsSync,readFileSync,writeFileSync}from"node:fs";
import{createHash}from"node:crypto";
if(!process.argv.includes("--private-primary")||process.env.NODE_ENV==="production")throw new Error("Private-primary only");
const dir="generated-artifacts/company-operating-corpus/issuer-contract-law-v1";
mkdirSync(dir,{recursive:true});const path=`${dir}/receipts.json`;
const book=existsSync(path)?JSON.parse(readFileSync(path,"utf8")):{
  version:"issuer-contract-law-1",maximumLogicalAttempts:24,policy:"Official discovery/declared filings; no failed slug retries, paid providers or state changes",attempts:[]};
const at=process.argv.indexOf("--one"),name=process.argv[at+1],url=process.argv[at+2],field=process.argv[at+3];
const bi=process.argv.indexOf("--read-news-json"),body=bi>=0?process.argv[bi+1]:undefined;
const hosts=["www.cfindustries.com","www.sec.gov","data.sec.gov","www.gov.uk","environment.data.gov.uk",
  "manage-emissions-reporting.service.gov.uk",
  "mets.environment-agency.gov.uk","assets.publishing.service.gov.uk","consult.environment-agency.gov.uk",
  "www.irs.gov","www.govinfo.gov","uscode.house.gov","www.congress.gov","www.federalregister.gov"];
if(at<0||!/^[\w.-]+$/.test(name)||!field||!hosts.includes(new URL(url).hostname))throw new Error("Official source/name/field required");
if(body){let q=JSON.parse(body);
  if(url!=="https://www.cfindustries.com/api/v1/news/get"||Object.keys(q).sort().join(",")!=="newsCategoryId,newsLandingPageId,pageIndex"||
    q.newsLandingPageId!==9||![q.newsCategoryId,q.pageIndex].every(n=>Number.isInteger(n)&&n>=0))
    throw new Error("Only documented read-only issuer news POST allowed");}
if(book.attempts.length>=24||book.attempts.some((r:any)=>r.url===url&&r.requestBody===body))throw new Error("24bound/no recapture");
async function capture(){
  const attemptedAt=new Date().toISOString(),base={name,url,field,method:body?"POST":"GET",requestBody:body,attemptedAt};
  try{
    const response=await fetch(url,{method:body?"POST":"GET",body,signal:AbortSignal.timeout(30000),
      headers:{"User-Agent":"CompanyEvidenceReview/1.0 evidence@example.com",...(body?{"Content-Type":"application/json"}:{})}});
    if(!hosts.includes(new URL(response.url).hostname))throw new Error(`Unapproved final host ${response.url}`);
    const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>25000000)throw new Error("25MB ceiling");
    const file=`${dir}/${name}`;writeFileSync(file,bytes,{flag:"wx"});
    const row={...base,capturedAt:new Date().toISOString(),status:response.status,finalUrl:response.url,
      contentType:response.headers.get("content-type"),lastModified:response.headers.get("last-modified"),
      path:file,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")};
    book.attempts.push(row);console.log(JSON.stringify(row));
  }catch(e){const row={...base,failedAt:new Date().toISOString(),error:e instanceof Error?e.message:String(e)};book.attempts.push(row);console.log(JSON.stringify(row));}
  writeFileSync(path,JSON.stringify(book,null,2)+"\n");
}
capture().catch(e=>{console.error(e);process.exitCode=1;});
