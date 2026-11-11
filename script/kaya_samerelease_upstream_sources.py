"""Bounded publisher retrieval;source admission helpers added separately."""
import argparse
import hashlib
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

ROOT=Path("generated-artifacts/kaya-samerelease-upstream")
PLAN=Path("docs/kaya-samerelease-upstream-acquisition-plan.json")


def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def retrieve(name,url,cap=2000000):
    plan=json.loads(PLAN.read_text())
    ROOT.mkdir(parents=True,exist_ok=True)
    receipt=ROOT/"requests.json"
    state=json.loads(receipt.read_text()) if receipt.exists() else {"planSHA256":digest(PLAN),"requests":[]}
    if state["planSHA256"]!=digest(PLAN):
        raise ValueError("Acquisition plan changed")
    if len(state["requests"])>=plan["maximumRequests"]:
        raise ValueError("Request budget exhausted")
    if not url.startswith("https://") or "/" in name or not name:
        raise ValueError("Named HTTPS publisher source required")
    if any(r["name"]==name for r in state["requests"]):
        raise ValueError("No retries or overwrite")
    if cap>plan["maximumEachRightsQualifiedNumericBodyBytes"]:
        raise ValueError("Per-source byte cap exceeded")
    used=sum(r["bytes"] for r in state["requests"])
    if used+cap>plan["maximumTotalBodyBytes"]:
        raise ValueError("Combined byte cap exceeded")
    body=ROOT/(name+".body")
    headers=ROOT/(name+".headers")
    started=datetime.now(timezone.utc).isoformat()
    proc=subprocess.run(["curl","--silent","--show-error","--location","--max-redirs","5",
                         "--max-time","45","--max-filesize",str(cap),"-A","ClimateSourceAnalysis/1.0",
                         "--dump-header",str(headers),"--output",str(body),"-w","%{http_code}\n%{url_effective}",
                         url],capture_output=True,text=True)
    if not body.exists():
        body.touch()
    if not headers.exists():
        headers.touch()
    lines=proc.stdout.splitlines()
    row={"name":name,"url":url,"capBytes":cap,"startedUTC":started,
         "finishedUTC":datetime.now(timezone.utc).isoformat(),"curlExit":proc.returncode,
         "HTTPStatus":lines[0] if lines else None,"effectiveURL":lines[1] if len(lines)>1 else None,
         "stderr":proc.stderr,"bytes":body.stat().st_size,"body":str(body),"headers":str(headers),
         "bodySHA256":digest(body),"headersSHA256":digest(headers)}
    state["requests"].append(row)
    receipt.write_text(json.dumps(state,indent=2)+"\n")
    print(json.dumps(row,indent=2))


if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("name")
    parser.add_argument("url")
    parser.add_argument("--cap",type=int,default=2000000)
    args=parser.parse_args()
    retrieve(args.name,args.url,args.cap)
