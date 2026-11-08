import { captureCurrentWorkbook } from "../server/snapshots/store";
if (process.env.NODE_ENV === "production") throw new Error("Development capture only; production needs separately authorized operator execution");
try { console.log(JSON.stringify(await captureCurrentWorkbook())); }
catch { console.error("Snapshot capture failed; verify provisioned schema, guards and source integrity. No source rows changed."); process.exitCode = 1; }
finally { process.exit(process.exitCode ?? 0); }
