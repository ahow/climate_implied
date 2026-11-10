/** Read-only capability report. Never imports the DB, starts a server or mutates data. */
import { operatorLifecyclePreflight } from "../server/operatorContract";
console.log(JSON.stringify(operatorLifecyclePreflight(process.env.NODE_ENV), null, 2));
