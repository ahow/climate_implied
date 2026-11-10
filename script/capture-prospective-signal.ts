import {readFileSync} from "node:fs";
import {captureProspectiveSignal} from "../server/snapshots/prospectiveSignal";
const path=process.argv[2];
if(!path)throw new Error("Usage: tsx script/capture-prospective-signal.ts signal-request.json (submitted, not automatically reviewed)");
captureProspectiveSignal(JSON.parse(readFileSync(path,"utf8"))).then(x=>{
 console.log(JSON.stringify({id:x.id,capturedAt:x.payload.capturedAt,repeated:x.repeated,scientificAcceptance:false}));
 process.exit(0);
}).catch(e=>{console.error(e.message);process.exit(1)});
