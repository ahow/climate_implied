import { db } from "../server/db";
import { cvCompanies } from "../shared/schema";
import { reconcileIdentities } from "../server/financialData/identity";
const inputs = await db.select({ id: cvCompanies.id, isin: cvCompanies.isin }).from(cvCompanies);
// No accepted issuer reviews existed at rollout. No source records are modified.
console.log(JSON.stringify(reconcileIdentities(inputs, []), null, 2));
process.exit(0);
