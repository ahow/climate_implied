"""Merge disjoint requirement reviews without changing the original contract."""
import argparse
import copy
import hashlib
import json
import re
from pathlib import Path

PROTECTED = ("id", "requirement", "source_section", "origin")
STATUSES = {"verified", "partial", "not-yet-reconciled", "blocked-production-provisioning"}
CHECK_TYPES = {"exact", "numerical", "operational", "judgement"}

def contract_digest(ledger):
    contract = [{k: r.get(k) for k in PROTECTED}
                for s in ledger["stages"] for r in s["requirements"]]
    return hashlib.sha256(json.dumps(contract, sort_keys=True).encode()).hexdigest()

def merge(ledger, reviews):
    result = copy.deepcopy(ledger)
    lookup = {r["id"]: r for s in result["stages"] for r in s["requirements"]}
    seen = set()
    for records in reviews:
        for proposal in records:
            key = proposal["id"]
            if key in seen or key not in lookup:
                raise ValueError(f"Duplicate or unknown clause: {key}")
            seen.add(key)
            current = lookup[key]
            for field in PROTECTED:
                if field in proposal and proposal[field] != current.get(field):
                    raise ValueError(f"Original contract changed: {key}.{field}")
            if proposal.get("status") not in STATUSES:
                raise ValueError(f"Invalid status: {key}")
            if not proposal.get("next_action"):
                raise ValueError(f"Missing concrete next action: {key}")
            if proposal.get("check_type") not in CHECK_TYPES:
                raise ValueError(f"Invalid check classification: {key}")
            if proposal["status"] == "verified" and not proposal.get("executions"):
                raise ValueError(f"Verified clause lacks direct execution evidence: {key}")
            current.update({k: v for k,v in proposal.items() if k not in PROTECTED})
            # Preserve unknown legacy receipt values; never infer an exit status
            # or start timestamp from a prose "passed" claim.
            for execution in current["executions"]:
                if "log" not in execution:
                    logs=execution.get("logs",[])
                    execution["log"]=[entry["path"] for entry in logs]
                execution.setdefault("executed_at",execution.get("completedAt"))
                execution.setdefault("exit_code",execution.get("exitCode"))
                execution.setdefault("counts",{"tests":execution.get("count"),
                    "pass":None,"fail":None,"skipped":None})
                if execution["executed_at"] is None or execution["exit_code"] is None:
                    execution["receipt_limit"]="Missing original timestamp/exit status remains unknown; no fabricated receipt."
            text=json.dumps(proposal,ensure_ascii=False)
            paths=set(re.findall(r"(?:server|client|shared|script)/[A-Za-z0-9_./-]+\.(?:tsx|ts|mjs|js|py)",text))
            current["inspected_source_sha256"]={
                p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
                for p in sorted(paths) if Path(p).is_file()}
            current["revision_boundary"]={
                "review_baseline":"40c524b29bec455f51e0bb9ac7d3efabe0218e3e",
                "last_verified_runtime":ledger.get("current_release",{}).get("github_main"),
                "meaning":"Frozen working-tree source hashes are authoritative for new code; baseline Git/runtime receipts are not claims of new deployment."}
    if seen != set(lookup):
        raise ValueError(f"Unreviewed clauses: {sorted(set(lookup)-seen)}")
    if contract_digest(result) != contract_digest(ledger):
        raise ValueError("Original contract changed")
    return result

def matrix(ledger):
    lines = ["# Original workplan acceptance matrix", "",
             "All original criteria retained. Engineering checks do not imply scientific or owner acceptance.",
             "", "| Clause | Original criterion | Status | Check type | Direct evidence | Source / runtime boundary | Remaining gap |",
             "|---|---|---|---|---|---|---|"]
    for s in ledger["stages"]:
        for r in s["requirements"]:
            evidence = r.get("existing_evidence", []) + r.get("files_functions_changed", [])
            boundary = {"git":r.get("git_commit"),"deployment":r.get("deployment_revision"),
                        "recordSha256":hashlib.sha256(json.dumps(r,sort_keys=True,ensure_ascii=False).encode()).hexdigest(),
                        "boundary":r.get("revision_boundary"),
                        "inspectedBaseline":r.get("inspected_git_baseline"),
                        "sourceHashes":r.get("inspected_source_sha256",r.get("direct_code_evidence",[]))}
            cells = [r["id"],r["requirement"],r["status"],str(r.get("check_type","unclassified")),
                     "; ".join(map(str,evidence)),json.dumps(boundary,ensure_ascii=False),
                     "; ".join(map(str,r.get("remaining_gaps",[])))]
            lines.append("| " + " | ".join(c.replace("|", "\\|").replace("\n"," ") for c in cells) + " |")
    return "\n".join(lines)+"\n"

def partition(path, records):
    match=re.search(r"stages-(\d+)-(\d+)\.json$",str(path))
    if not match:
        raise ValueError("Review filename must declare its disjoint stage range")
    first,last=map(int,match.groups())
    if any(not first<=int(r["id"].split("-")[0][1:])<=last for r in records):
        raise ValueError("Review contains a clause outside its assigned range")
    return records

if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("reviews", nargs="+")
    parser.add_argument("--apply", action="store_true")
    args=parser.parse_args()
    target=Path("docs/workplan_completion_ledger.json")
    ledger=json.loads(target.read_text())
    reviews=[]
    for path in args.reviews:
        data=json.loads(Path(path).read_text())
        records=(data if isinstance(data,list) else
                 data["records"] if "records" in data else list(data.values()))
        reviews.append(partition(path,records))
    result=merge(ledger,reviews)
    print(json.dumps({"clauses":sum(len(s["requirements"]) for s in result["stages"]),
                      "contractHash":contract_digest(result),"applied":args.apply}))
    if args.apply:
        target.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
        Path("docs/WORKPLAN_ACCEPTANCE_MATRIX.md").write_text(matrix(result))
