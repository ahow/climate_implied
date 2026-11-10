import {Card,CardContent} from "@/components/ui/card";
export function CompanyReplayUpload(){
 return <Card><CardContent className="pt-6 space-y-3">
  <h2 className="font-semibold">Captured company replay</h2>
  <p className="text-sm text-muted-foreground">The operator replay command validates the exact captured model, runtime, settings and source claims, then exports the full conditional ledger and result to XLSX. Incompatible bundles are rejected without current-data substitution.</p>
  <p className="text-sm">This dashboard remains read-only. Bundle submission and export are operator actions; this screen does not approve inputs or run a historical efficacy study.</p>
  <code className="block text-xs break-all">npx tsx script/replay-company-projection.ts &lt;captured-bundle.json&gt; &lt;output-prefix&gt;</code>
 </CardContent></Card>;
}
