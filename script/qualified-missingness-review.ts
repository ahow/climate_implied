import XLSX from "xlsx";
import { QualifiedMissingnessStore } from "../server/dataIngestion/qualifiedMissingnessStore";

const [action, root, selection, ...rest] = process.argv.slice(2);
if (!action || !root) throw new Error(
  "NODE_ENV=development npx tsx script/qualified-missingness-review.ts stage <generated-artifacts/private-dir> <source.json> <note> | approve/reject <dir> <proposal-sha> <note> | view <dir> [revision] | export <dir> <output.xlsx> [revision]");
const store = new QualifiedMissingnessStore(root);
if (action === "stage") console.log(JSON.stringify(store.stage(selection, rest.join(" "))));
else if (action === "approve" || action === "reject")
  console.log(JSON.stringify(store.decide(selection, action, rest.join(" "))));
else if (action === "view") console.log(JSON.stringify(store.view(selection), null, 2));
else if (action === "export") XLSX.writeFile(store.export(rest[0]), selection);
else throw new Error("Unsupported private development action");
