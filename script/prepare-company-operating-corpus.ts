/** Public issuer evidence only; emits incomplete review packets, never model coefficients. */
import {readFile,writeFile} from "node:fs/promises";
import {eq} from "drizzle-orm";
import {db} from "../server/db";
import {cvCompanies} from "../shared/schema";
import {contentHash} from "../server/calculation/analysisManifest";
import {packCompanySource} from "../server/calculation/companySourceArchive";
import {stageCompanySourcePacket} from "../server/snapshots/companyOperatingReview";
if(process.env.NODE_ENV==="production") throw new Error("Development preparation only");
const root="generated-artifacts/company-operating-corpus";
const definitions=[
 {symbol:"NEE",isin:"US65339F1012",publisher:"NextEra Energy",file:"source-1.md",date:"2026-01-27T00:00:00Z",
  url:"https://www.investor.nexteraenergy.com/~/media/Files/N/NEE-IR/reports-and-fillings/quarterly-earnings/2025/Q4%202025/2026-0127%20NEEQ42025News%20Release%20vF.pdf",
  claim:{name:"FPL2025CapitalInvestmentUSD",value:8.9e9,unit:"nominal USD, approximate",period:"FY2025",geography:"Florida/FPL",
    locator:"FPL section: full-year capital investments approximately $8.9 billion",match:"approximately $8.9 billion"},
  link:"Issuer describes solar/storage additions and Florida PSC four-year rate agreement. Backlog GW and regulatory capital are not revenue/FCFE growth.",
  gaps:["Operating-geography revenue weights separating FPL/NEER","Approved rate-order revenue mechanics and annual solar/storage commissioning schedule","Five annual segment margins, capex, working capital, financing and tax bridge","Scope1/2 liability/pass-through allocation and Scope3 non-duplication"]},
 {symbol:"XOM",isin:"US30231G1022",publisher:"ExxonMobil",file:"source-0.md",date:"2025-12-09T00:00:00Z",
  url:"https://investor.exxonmobil.com/company-information/press-releases/detail/1198/exxonmobil-raises-its-2030-plan-transformation",
  claim:{name:"CorporateCashFlowGrowthTo2030USD",value:35e9,unit:"USD at company constant-price/margin assumptions; not FCFE",period:"2030 versus2024",geography:"Corporate/global",
    locator:"2030 plan: $35 billion cash flow growth versus2024, constant prices/margins",match:"$35 billion"},
  link:"Issuer emissions-intensity plans and lower-emission businesses are conditional on markets/policy; corporate cash-flow growth is not climate-attributable FCFE.",
  gaps:["Original definition and reconciliation of corporate cash flow to FCFE/FCFF","Annual geographic/segment activity and climate-attributable revenue bridge","Capex allocation between ordinary operations and lower-emission projects","Policy-dependent CCS volumes/prices/costs and Scope1/2/3 overlap","Annual working capital/financing and nominal currency conversion"]},
 {symbol:"CAT",isin:"US1491231015",publisher:"Caterpillar",file:"source-3.md",date:"2025-10-29T00:00:00Z",
  url:"https://investors.caterpillar.com/news/news-details/2025/Caterpillar-Reports-Third-Quarter-2025-Results/default.aspx",
  claim:{name:"PowerGeneration2025Q3SalesUSD",value:2.634e9,unit:"USD sales, quarterly; source table USD millions",period:"2025Q3",geography:"Power Generation application/global",
    locator:"Sales by Application: Power Generation2,634; prior2,011; increase623 (31%)",match:"2,634"},
  link:"Issuer attributes generation sales growth primarily to data-center applications. This is activity exposure, NOT proof of a climate-policy causal increment.",
  gaps:["Separate data-center demand from climate-policy effects using a dated causal scenario","Segment/geography exposure weights and annual order-to-revenue conversion","Five-year margins/capex/working-capital/financing assumptions","Product-use Scope3 treatment distinct from direct Scope1/2 carbon costs"]},
];
async function main(){
 const receipts=[];
 for(const d of definitions){
  const [company]=await db.select().from(cvCompanies).where(eq(cvCompanies.isin,d.isin));
  if(!company) throw new Error(`Workbook identity unavailable:${d.symbol}`);
  const text=await readFile(`${root}/${d.file}`,"utf8");
  if(!text.includes(d.claim.match)||!text.includes(d.publisher.split(" ")[0])) throw new Error(`Source locator mismatch:${d.symbol}`);
  const retrievedAt=new Date().toISOString();
  const identity={companyId:String(company.id),isin:d.isin};
  const source=packCompanySource({version:"company-operating-source-1",...identity,url:d.url,publisher:d.publisher,
    publishedAt:null,publishedDate:d.date.slice(0,10),retrievedAt,content:text,contentHash:contentHash(text),
    licence:"Public issuer disclosure; retained privately for review, no redistribution grant assumed",
    claims:[{path:`/evidence/${d.claim.name}`,value:d.claim.value,valueHash:contentHash(d.claim.value),
      locator:d.claim.locator,unit:d.claim.unit,period:d.claim.period,geography:d.claim.geography,
      basis:"revised-history",availableAt:retrievedAt,method:d.link,dependencies:[d.url]}]});
  const remainingGaps=[...d.gaps,"Owner identity/fiscal approval; no issuer is approved by this preparation",
    "Same-horizon nominal currency and FCFE/FCFF pairing; no historical origin claimed",
    "Source extraction may be partial; validate full original. Only publication calendar date known; no midnight timestamp fabricated",
    "Justified joint uncertainty is missing; no invented probability distribution"];
  const packet={identity,sources:[source.payload],remainingGaps};
  const filename=`${root}/${d.symbol}-${source.id}.json`;
  await writeFile(filename,JSON.stringify(packet,null,2),{flag:"wx"});
  const proposalId=await stageCompanySourcePacket(identity,packet.sources,remainingGaps);
  receipts.push({symbol:d.symbol,isin:d.isin,sourceArchiveId:source.id,proposalId,url:d.url,
    reportedPublicationDate:d.date.slice(0,10),availableAt:retrievedAt,sourceTextHash:source.payload.contentHash,
    status:"pending-source-review; not executable climate-linked case",remainingGaps});
  console.log(d.symbol,proposalId,"pending; no approval or projection");
 }
 await writeFile("docs/company_operating_source_receipts.json",JSON.stringify(receipts,null,2)+"\n");
 process.exit(0);
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Corpus preparation failed");process.exit(1)});
