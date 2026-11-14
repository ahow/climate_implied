import {contentHash} from "./analysisManifest";
import {freezeDeploymentDebt,executeDeploymentDebt,type DeploymentDebt} from "./deploymentDebt";
import {validateTransitionBoundary,joinExecutedDeployment,type TransitionBoundaryInput} from "./deploymentTransition";
export interface FundedDeploymentTransition extends Omit<TransitionBoundaryInput,"version"|"accounts">{
 version:"funded-finite-gregorian-join-2"|"funded-finite-gregorian-join-3-earned";
 debt:DeploymentDebt;
}
function boundary(p:FundedDeploymentTransition):TransitionBoundaryInput{
 const d=p.debt;
 return {...p,accounts:{definitionHash:d.frozen.definitionHash,growth:d.growth,
  ledger:d.ledger,declaration:d.declaration,timing:d.timing,accrual:d.accrual}};
}
export function freezeFundedDeploymentTransition(input:FundedDeploymentTransition){
 const p=structuredClone(input);
 if(!["funded-finite-gregorian-join-2","funded-finite-gregorian-join-3-earned"].includes(p.version)||
  contentHash(p.deployment)!==contentHash(p.debt.frozen.protocol)||p.growth!==p.debt.growth)
  throw Error("Exact funded transition version/physical source/domain required");
 if(p.debt.version!==(p.version==="funded-finite-gregorian-join-3-earned"?"dated-deployment-debt-2-earned":"dated-deployment-debt-1"))
  throw Error("Funded join and recognition versions mismatch");
 freezeDeploymentDebt(p.debt);
 validateTransitionBoundary(boundary(p));
 return {definitionHash:contentHash(p),input:p};
}
export function evaluateFundedDeploymentTransition(f:ReturnType<typeof freezeFundedDeploymentTransition>){
 if(contentHash(f.input)!==f.definitionHash)throw Error("Changed frozen funded transition");
 freezeFundedDeploymentTransition(f.input);
 const finite=executeDeploymentDebt(freezeDeploymentDebt(f.input.debt));
 const joined=joinExecutedDeployment(boundary(f.input),finite,f.definitionHash);
 return {...joined,loanYears:finite.loanYears,
  qualification:"Conditional fixed-rate finite financing settled before funded periodic boundary; no perpetual refinancing, recovery, partial claim, whole-equity or market identification"};
}
