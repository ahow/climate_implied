import type {OutputFieldSemantic} from "./outputFieldSemantics";
export const companyReviewSemantics:OutputFieldSemantic[]=[
  ["proposalId","Immutable operating/source proposal identity","SHA-256","contentHash(canonical proposal payload)"],
  ["companyId","Exact workbook issuer identifier","identifier","proposal.identity.companyId; no ticker-only match"],
  ["isin","Workbook-matched security identity, not ownership approval","ISIN","proposal.identity.isin"],
  ["kind","Source-only versus complete-input review packet","enum","company-operating-source-proposal | company-operating-proposal"],
  ["sourceArchiveIds","Resolved source archive identities","SHA-256 array","sorted deduplicated content identities retained in proposal"],
  ["remainingGaps","Explicit missing operating evidence","text array","source-only proposal.remainingGaps; absent in full proposal=>empty list, not scientific acceptance"],
  ["decision","Owner review state","enum","unique immutable decision.decision, or pending if no decision; multiple decisions reject"],
  ["decidedAt","Actual recorded approval/rejection timestamp","UTC timestamp or null","immutable transaction_timestamp from decision; pending=>null; never source publication date"],
  ["executable","Whether reviewed inputs can enter the conditional engine","boolean","kind=company-operating-proposal AND decision=approved; source-only packet always false"],
  ["scientificAcceptance","Scientific validation status","boolean","false; owner review never confers scientific acceptance"],
].map(([key,meaning,unit,formula])=>({
  id:`companyReview.${key}${["sourceArchiveIds","remainingGaps"].includes(key)?"[]":""}`,meaning,unit,formula,role:"Output",
  dependencies:[`company-operating-proposal.${key}`,"company-operating-decision"],
  source:"Immutable DEVELOPMENT/selected environment review journal; archive content hashes checked",
  period:"Review transaction time, not fiscal or forecast period",geography:"Issuer identity only; not an operating-geography mapping",
  status:"Administrative evidence status, not calibrated climate or investment output",
  missingness:"Missing/inconsistent storage rejects503; pending decision timestamp is null, never epoch/zero",
  uncertainty:"No probabilistic meaning",scope:"Current review catalogue, maximum100 records ordered by proposalId; not an as-of projection",
  asOfRule:"Historical execution separately requires both operating and financial approval timestamps <= explicit cutoff",
}));
