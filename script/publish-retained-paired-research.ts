import { retainedPairedPinSchema } from "../client/src/components/retained-paired-research-contract";
import { publishPinnedRetainedPairedResearch } from "../server/retainedPairedResearchStore";

async function main() {
  const keys = Object.keys(retainedPairedPinSchema.shape);
  const args = process.argv.slice(2);
  if (args.length !== keys.length)
    throw new Error(`Usage: authorized workspace shell: npx tsx script/publish-retained-paired-research.ts ${keys.join(" ")}`);
  const pin = retainedPairedPinSchema.parse(Object.fromEntries(keys.map((key, index) => [key, args[index]])));
  console.log(JSON.stringify(await publishPinnedRetainedPairedResearch(pin)));
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : "Retained paired publication refused");
  process.exitCode = 1;
});
