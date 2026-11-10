/** Authorized workspace CLI only; no HTTP identity or browser secret is created. */
async function main(){
 if(process.argv[2]!=="refresh")throw new Error("Expected refresh");
 const months=Number(process.argv[3]);
 if(!Number.isInteger(months)||months<1||months>24)throw new Error("Explicit months1–24 required");
 const {getClimateNewsAnalysis}=await import("../server/newsApi/newsService");
 const result=await getClimateNewsAnalysis(months,"operator-cli");
 console.log(JSON.stringify({months,dateRange:result.dateRange,status:"cached-result-ready"}));
}
main().then(()=>process.exit(0)).catch(()=>{
 console.error("Authorized news refresh failed; verify access, explicit window and provider configuration.");
 process.exit(1);
});
