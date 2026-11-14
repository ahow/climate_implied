import {transitionTransportFixture} from "./renewalTransportFixture";
import {compileDeploymentGrowth,freezeDeploymentGrowth} from "../server/calculation/deploymentGrowth";
/** Explicit synthetic engineering inputs only; no real issuer approval. */
export function fundedTransportFixture(earned=true):any{
 const x=transitionTransportFixture(),interest=183/365.25,ids=x.deployment.evidenceIds;
 Object.assign(x.deployment.specification.years[0],{interestCashUsd:interest,debtRaisedUsd:10,debtRepaidUsd:10});
 x.accounts.ledger.years[0].commonDistribution-=interest;
 x.accounts.accrual.entries.push({id:"loan-interest",on:"2025-12-31",kind:"payable",component:"interest",usd:interest,evidenceIds:ids});
 for(const component of ["interest","debtRaised","debtRepaid"])
  x.accounts.timing.push({year:2025,component,allocations:[{on:component==="debtRaised"?"2025-07-01":"2025-12-31",fraction:1,evidenceIds:ids}]});
 const input:any={...x,version:earned?"funded-finite-gregorian-join-3-earned":"funded-finite-gregorian-join-2",debt:{
  version:earned?"dated-deployment-debt-2-earned":"dated-deployment-debt-1",
  ...(earned?{recognitionLaw:"earned-service-prefix-1"}:{}),frozen:freezeDeploymentGrowth(x.deployment),growth:0,
  ledger:x.accounts.ledger,declaration:x.accounts.declaration,timing:x.accounts.timing,accrual:x.accounts.accrual,
  ownership:"full",recoveries:"none",openingObligations:"none",
  loan:{id:"conditional-loan",borrower:x.accounts.ledger.claimantId,lender:"conditional-lender",currency:"USD",
   rate:.1,basis:"ACT/365.25",priority:"contractual-before-common",rightsEvidenceId:ids[0],
   draws:[{on:"2025-07-01",usd:10}],repayments:[{on:"2025-12-31",usd:10}]}}};
 delete input.accounts;
 const cell={issuer:"42",unitId:"asset-2025",year:2025,scope:"2-location",gas:"CO2",geography:"fixture",channel:"operational"};
 const source={hash:"a".repeat(64),locator:"SYNTHETIC engineering only",publishedAt:"2025-01-01T00:00:00Z",year:2025,
  periodStart:"2025-01-01",periodEnd:"2025-12-31",geography:"fixture",unit:"kWh-charged",kind:"conditional-assumption"};
 return {version:"company-cohort-input-1",companyId:"42",cutoff:"2025-07-01T00:00:00Z",years:[2025],cells:[cell],
  scenarios:[{id:"synthetic-funded",specification:compileDeploymentGrowth(input.debt.frozen,0).specification,
   physical:[{...cell,cohortId:"asset-2025",activityChannel:"charge-energy",intensity:.01,intensityDenominator:"kWh-charged",
    intensityNumerator:"tonnes-native-gas",ownership:1,basis:"full-unit-before-ownership",activitySource:source,
    intensitySource:{...source,unit:"tonnes-CO2/kWh-charged",gas:"CO2",scope:"2-location"}}],fundedTransition:input}]};
}
