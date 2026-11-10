import {z} from "zod";
import {contentHash} from "./analysisManifest";
/**
 * First Solar industrial alternative: an issuer-guidance policy channel,
 * not an invented five-year issuer forecast. Credit retention is a stress
 * parameter, not a probability or assertion that law changes on a given date.
 */
const schema=z.object({
 sourceHash:z.string().regex(/^[a-f0-9]{64}$/),availableAt:z.string().datetime(),
 cutoff:z.string().datetime(),salesUsd:z.number().positive(),grossProfitUsd:z.number().finite(),
 operatingExpenseUsd:z.number().nonnegative(),includedCreditUsd:z.number().nonnegative(),
 retainedCreditFraction:z.number().min(0).max(1),
}).strict();
export function solarManufacturingPolicyBridge(input:unknown){
 const x=schema.parse(input);
 if(Date.parse(x.availableAt)>Date.parse(x.cutoff))throw new Error("Future source");
 const excludedCredit=x.includedCreditUsd*(1-x.retainedCreditFraction);
 const conditionalGrossProfit=x.grossProfitUsd-excludedCredit;
 return {status:"conditional-guidance-policy-sensitivity",sourceHash:x.sourceHash,
  inputHash:contentHash(x),conditionalGrossProfit,
  conditionalGrossMargin:conditionalGrossProfit/x.salesUsd,
  conditionalOperatingProfit:conditionalGrossProfit-x.operatingExpenseUsd,
  excludedCredit,fcfe:null,valuationPairing:"unavailable-five-year-cashflow-bridge-missing",
  scienceAccepted:false,ownerApproved:false,
  boundary:"One-year 2026 disclosed guidance, not historical as-of availability or realized results. Hold non-credit costs/prices/volume fixed; no secondary demand or tax response.",
  limitations:["Recognized credit is already included in gross profit; subtract only once.",
   "Credit transfer discounts and cash timing are separate from recognized benefit.",
   "No customer-use Scope3 savings or issuer abatement assigned to module shipments.",
   "Endpoints are Cartesian stress corners, not issuer joint guidance or probabilities."]};
}
