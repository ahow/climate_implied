import {useReadQuery as useQuery} from "@/lib/use-read-query";
import {Card,CardContent} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
type Review={proposalId:string;companyId:string;isin:string;kind:string;sourceArchiveIds:string[];
  remainingGaps:string[];decision:"pending"|"approved"|"rejected";decidedAt:string|null;executable:boolean;scientificAcceptance:false};
export function CompanyOperatingReview(){
  const query=useQuery<Review[]>({queryKey:["/api/calculation/company-operating/reviews"]});
  return <Card><CardContent className="pt-6 space-y-3">
    <h2 className="font-semibold">Company operating-input review</h2>
    <p className="text-sm text-muted-foreground">Source packets are not executable climate-linked cases. Approval remains an operator action; this screen cannot approve issuers or assumptions.</p>
    {query.isLoading?<p>Loading review packets…</p>:query.isError?<div role="alert">Review records unavailable. <Button variant="outline" onClick={()=>void query.refetch()}>Retry</Button></div>:
      !query.data?.length?<p>No operating review packets available.</p>:
      query.data.map(row=><details key={row.proposalId} className="border rounded p-3">
        <summary className="cursor-pointer">
          <span data-field-id="companyReview.isin">{row.isin??"Identity unavailable"}</span>{" · "}
          <span data-field-id="companyReview.decision">{row.decision??"Decision unavailable"}</span>{" · "}
          <span data-field-id="companyReview.executable">{row.executable===true?"Conditional execution eligible":row.executable===false?"Not executable":"Execution eligibility unavailable — not returned"}</span>
        </summary>
        <dl className="mt-3 text-sm space-y-2">
          <dt>Proposal</dt><dd data-field-id="companyReview.proposalId" className="break-all">{row.proposalId}</dd>
          <dt>Packet type</dt><dd data-field-id="companyReview.kind">{row.kind}</dd>
          <dt>Decision time, not publication date</dt><dd data-field-id="companyReview.decidedAt">{row.decidedAt??"No decision"}</dd>
          <dt>Source archive IDs</dt><dd data-field-id="companyReview.sourceArchiveIds[]" className="break-all">{row.sourceArchiveIds?.length?row.sourceArchiveIds.join("; "):"No source archive IDs returned"}</dd>
          <dt>Scientific acceptance</dt><dd data-field-id="companyReview.scientificAcceptance">Not established</dd>
        </dl>
        {row.remainingGaps?.length?<ul className="mt-3 list-disc pl-5 text-sm" data-field-id="companyReview.remainingGaps[]">{row.remainingGaps.map(gap=><li key={gap}>{gap}</li>)}</ul>:<p className="text-sm">No gap details returned; completeness and scientific acceptance are not established.</p>}
      </details>)}
  </CardContent></Card>;
}
