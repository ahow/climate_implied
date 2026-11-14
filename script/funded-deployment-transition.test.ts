import {test} from "node:test";
import assert from "node:assert/strict";
import {transitionTransportFixture as transitionFixture} from "./renewalTransportFixture";
import {freezeDeploymentGrowth} from "../server/calculation/deploymentGrowth";
import {freezeFundedDeploymentTransition,evaluateFundedDeploymentTransition} from "../server/calculation/fundedDeploymentTransition";
import {projectCompanyCohorts} from "../server/calculation/companyCohortProjection";
test("dated temporary debt settles before the exact funded periodic boundary without second debt deduction",()=>{
 const x=transitionFixture(),interest=183/365.25,ids=x.deployment.evidenceIds;
 Object.assign(x.deployment.specification.years[0],{interestCashUsd:interest,debtRaisedUsd:10,debtRepaidUsd:10});
 x.accounts.ledger.years[0].commonDistribution-=interest;
 x.accounts.accrual.entries.push({id:"loan-interest",on:"2025-12-31",kind:"payable",component:"interest",usd:interest,evidenceIds:ids});
 for(const component of ["interest","debtRaised","debtRepaid"])
  x.accounts.timing.push({year:2025,component,allocations:[{on:component==="debtRaised"?"2025-07-01":"2025-12-31",fraction:1,evidenceIds:ids}]});
 const input:any={...x,version:"funded-finite-gregorian-join-2",debt:{
  version:"dated-deployment-debt-1",frozen:freezeDeploymentGrowth(x.deployment),growth:0,
  ledger:x.accounts.ledger,declaration:x.accounts.declaration,timing:x.accounts.timing,accrual:x.accounts.accrual,
  ownership:"full",recoveries:"none",openingObligations:"none",
  loan:{id:"conditional-loan",borrower:x.accounts.ledger.claimantId,lender:"conditional-lender",currency:"USD",
   rate:.1,basis:"ACT/365.25",priority:"contractual-before-common",rightsEvidenceId:ids[0],
   draws:[{on:"2025-07-01",usd:10}],repayments:[{on:"2025-12-31",usd:10}]}}};
 delete input.accounts;
 const frozen=freezeFundedDeploymentTransition(input),r=evaluateFundedDeploymentTransition(frozen);
 const finiteExpected=(10*184/365*8.75-interest)/1.1**(183/365.25)-10;
 assert.ok(Math.abs(r.finite.cash.finiteCommonCashPvUsd-finiteExpected)<1e-8);
 assert.ok(Math.abs(r.conditionalProjectValueUsd-finiteExpected-r.periodic.conditionalPeriodicProjectValueUsd/1.1**(184/365.25))<1e-8);
 assert.equal(r.join.financial.debt,0);assert.equal(r.join.paidCapital,10);
 assert.equal(r.loanYears[0].closing,0);assert.equal(r.marketImplied,false);assert.equal(r.inverse,null);
 const cell={issuer:"synthetic",unitId:"asset-2025",year:2025,scope:"2-location" as const,gas:"CO2",geography:"fixture",channel:"operational" as const};
 const source={hash:"a".repeat(64),locator:"SYNTHETIC engineering only",publishedAt:"2025-01-01T00:00:00Z",year:2025,
  periodStart:"2025-01-01",periodEnd:"2025-12-31",geography:"fixture",unit:"kWh-charged",kind:"conditional-assumption" as const};
 const company=projectCompanyCohorts({version:"company-cohort-input-1",companyId:"synthetic",cutoff:"2025-07-01T00:00:00Z",
  years:[2025],cells:[cell],scenarios:[{id:"conditional-funded",specification:r.finite.physical.specification,
   physical:[{...cell,cohortId:"asset-2025",activityChannel:"charge-energy",intensity:.01,intensityDenominator:"kWh-charged",
    intensityNumerator:"tonnes-native-gas",ownership:1,basis:"full-unit-before-ownership",activitySource:source,
    intensitySource:{...source,unit:"tonnes-CO2/kWh-charged",gas:"CO2",scope:"2-location"}}],fundedTransition:input}]});
 assert.equal(company.members[0].fundedTransition.definitionHash,r.definitionHash);
 assert.equal(company.members[0].fundedTransition.conditionalProjectValueUsd,r.conditionalProjectValueUsd);
 assert.equal(company.marketIdentified,false);assert.equal(company.scientificAcceptance,false);
 const swapped=structuredClone(input);swapped.debt.growth=.1;
 assert.throws(()=>freezeFundedDeploymentTransition(swapped),/domain/);
 frozen.input.debt.loan.rate=.2;assert.throws(()=>evaluateFundedDeploymentTransition(frozen),/Changed/);
});
