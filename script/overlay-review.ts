/** Existing workspace operator boundary; no public approval or paid provider call. */
import { readFileSync } from "node:fs";
import { stageOverlayReview, decideOverlayReview } from "../server/snapshots/overlayReview";
const [action, argument] = process.argv.slice(2);
try {
  if (action === "stage") console.log(await stageOverlayReview(JSON.parse(readFileSync(argument, "utf8"))));
  else if (action === "approve" || action === "reject")
    console.log(await decideOverlayReview(argument, action === "approve" ? "approved" : "rejected"));
  else throw new Error("Usage: overlay-review.ts stage <entries.json> | approve <id> | reject <id>");
  process.exit(0);
} catch (e) { console.error(e instanceof Error ? e.message : "Review failed"); process.exit(1); }
