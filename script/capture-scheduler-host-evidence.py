"""Read retained startup evidence only: never restart, trigger, or read secrets."""
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone

root=Path("generated-artifacts/scheduler-host-evidence")
root.mkdir(parents=True,exist_ok=True)
sources={
 "replit-production":Path("/tmp/logs/deployment_20261110_112735_823_b5b1d960.log"),
 "replit-development":Path("/tmp/logs/Start_application_20261110_112735_823_6e86428b.log"),
}
records=[]
for host,path in sources.items():
 raw=path.read_bytes()
 lines=[line for line in raw.decode().splitlines() if "[scheduler]" in line]
 assert lines,host
 records.append({"environment":host,"source_sha256":hashlib.sha256(raw).hexdigest(),
                 "scheduler_lines":lines,"source":str(path),
                 "state":"enabled" if "Started" in lines[-1] else "disabled"})
railway=json.loads((root/"railway.json").read_text())
assert railway["deploymentId"]=="e0278526-15fb-476f-a1a5-045e861b6d2e"
assert any("Disabled for this instance" in r["message"] for r in railway["deploy"])
records.append({"environment":"railway-production","state":"disabled","receipt":railway})
assert sum(r["state"]=="enabled" for r in records)==1
out={"captured_at":datetime.now(timezone.utc).isoformat(),"operation":"read-only retained logs",
     "environments":records,"known_enabled_environments":1,
     "scope":"Known Replit production/development and configured Railway deployment. Environment ownership, not one replica: autoscale can start multiple instances; shared advisory lock serializes collection.",
     "limits":["Does not enumerate unknown external hosts or prove uninterrupted configuration between startup receipts.",
               "No restart, scheduler trigger, credential read, flag or cadence change performed."]}
(root/"combined.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps({"known_enabled_environments":1,"states":[[r["environment"],r["state"]] for r in records],"receipt":str(root/"combined.json")}))
