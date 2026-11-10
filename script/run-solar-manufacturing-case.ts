import {readFileSync,statSync,writeFileSync} from "node:fs";
import {contentHash} from "../server/calculation/analysisManifest";
import {solarManufacturingPolicyBridge} from "../server/calculation/solarManufacturingCase";
const path="generated-artifacts/company-operating-corpus/FSLR-2025-results.md";
const text=readFileSync(path,"utf8"),availableAt=statSync(path).mtime.toISOString();
for(const marker of ["February 24, 2026","$2.10 billion to $2.19 billion","2,057,105","869,875","370,470","473,363"])
 if(!text.includes(marker))throw new Error(`Missing source locator ${marker}`);
const scenarios=[];
for(const retainedCreditFraction of [0,.5,1])for(const edge of ["low","high"]){
 const low=edge==="low";
 scenarios.push({edge,retainedCreditFraction,...solarManufacturingPolicyBridge({
  sourceHash:contentHash(text),availableAt,cutoff:availableAt,
  salesUsd:low?4.9e9:5.2e9,grossProfitUsd:low?2.4e9:2.6e9,
  operatingExpenseUsd:low?635e6:610e6,includedCreditUsd:low?2.19e9:2.1e9,retainedCreditFraction})});
}
const report={issuer:"First Solar",sourceUrl:"https://investor.firstsolar.com/news/news-details/2026/First-Solar-Inc--Announces-Fourth-Quarter-and-Full-Year-2025-Financial-Results-and-2026-Guidance/default.aspx",
 publishedDate:"2026-02-24",publishedAt:null,availableAt,sourceTextHash:contentHash(text),
 assumptions:"Cartesian credit-retention0/50/100% and guidance corners; fixed other economics, no probabilities, not five-year forecast.",
 reported2025:{operatingCashFlowUsd:2057105000,ppEUsd:869875000,netDebtFundingUsd:370470000-473363000,
  ocfLessPpePlusNetDebtUsd:2057105000-869875000+370470000-473363000,
  caveat:"Candidate OCF-to-FCFE convention only; issuer scope/capex definition and other investing/financing treatment await review. Not future cashflow."},
 scenarios,completeIssuerCases:0};
writeFileSync("generated-artifacts/company-operating-corpus/FSLR-policy-results.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
